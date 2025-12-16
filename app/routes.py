from fastapi import APIRouter, Request, HTTPException, Query, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from typing import Optional
import os
import logging
from jose import JWTError, jwt
from dotenv import load_dotenv
from .clients.litellm import fetch_models

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

router = APIRouter()
templates = Jinja2Templates(directory="templates")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "access_token")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")

logger.info(f"Experimentation Service - JWT Config: Algorithm={ALGORITHM}, Cookie Domain={COOKIE_DOMAIN}")


async def get_current_user(request: Request):
    """Verify JWT from cookie or Authorization header"""
    logger.info(f"Auth attempt from {request.client.host} for {request.url.path}")

    # Try to get token from cookie
    token = request.cookies.get(ACCESS_TOKEN)
    if token:
        logger.info(f"Token found in cookie: {ACCESS_TOKEN}")
    else:
        logger.warning(f"No token found in cookie: {ACCESS_TOKEN}")

    # Try Authorization header if no cookie
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            if auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                logger.info("Token found in Authorization header")
            else:
                logger.warning(f"Invalid Authorization header format: {auth_header[:20]}...")
        else:
            logger.warning("No Authorization header present")

    if not token:
        logger.error(f"Authentication failed: No token provided from {request.client.host}")
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        # Decode token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user_id = payload.get("id")

        logger.info(f"Token decoded successfully: user_id={user_id}, email={email}")

        if not email or not user_id:
            logger.error(f"Invalid token payload: email={email}, user_id={user_id}")
            raise HTTPException(status_code=401, detail="Invalid token payload")

        logger.info(f"User authenticated successfully: {email} (ID: {user_id})")
        return {"email": email, "id": user_id}

    except JWTError as e:
        logger.error(f"JWT validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication error")


@router.post("/auth")
async def authenticate(
        token: str = Form(...),
        user_id: int = Form(...)
):
    """Receive JWT token from auth service, validate it, and set cookie"""
    logger.info(f"Auth endpoint called for user_id: {user_id}")

    try:
        # Decode and validate the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        decoded_email = payload.get("sub")
        decoded_user_id = payload.get("id")

        logger.info(f"Token decoded: email={decoded_email}, user_id={decoded_user_id}")

        # Verify the user_id matches
        if decoded_user_id != user_id:
            logger.error(f"User ID mismatch: expected={user_id}, got={decoded_user_id}")
            raise HTTPException(status_code=400, detail="User ID mismatch")

        logger.info(f"User {decoded_email} (ID: {decoded_user_id}) authenticated successfully")

        # Create response with redirect to service home
        response = RedirectResponse(url="/", status_code=303)

        # Set cookie with the JWT token
        cookie_params = {
            "key": ACCESS_TOKEN,
            "value": token,
            "httponly": True,
            "secure": COOKIE_SECURE,
            "samesite": COOKIE_SAMESITE
        }

        if COOKIE_DOMAIN:
            cookie_params["domain"] = COOKIE_DOMAIN

        response.set_cookie(**cookie_params)

        logger.info(f"Cookie set for user {decoded_user_id}, redirecting to homepage")
        return response

    except JWTError as e:
        logger.error(f"Invalid token received: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed with error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/api/config")
async def get_config(user: dict = Depends(get_current_user)):
    """API config - requires authentication"""
    logger.info(f"Config requested by user {user['id']}")
    return {
        "backendUrl": os.getenv("BACKEND_URL", "http://localhost:8001"),
        "litellmUrl": os.getenv("LITELLM_URL", "http://localhost:4000"),
        "frontendUrl": f"http://localhost:{os.getenv('FRONTEND_PORT', '8000')}",
        "user_id": user["id"]
    }


@router.get("/", response_class=HTMLResponse)
async def prompts_ui(
        request: Request,
        user: dict = Depends(get_current_user)
):
    """Homepage - requires authentication"""
    logger.info(f"Homepage accessed by user {user['id']} ({user['email']})")
    context = {
        "request": request,
        "user": user
    }
    return templates.TemplateResponse("index.html", context)


@router.get("/api/litellm/models")
async def fetch_chat_models(
        request: Request,
        api_key: Optional[str] = Query(None),
        timeout: float = Query(5.0),
        user: dict = Depends(get_current_user)
):
    """Fetch models - requires authentication"""
    logger.info(f"Models fetch requested by user {user['id']}, timeout={timeout}")

    try:
        data = await fetch_models(api_key, timeout)
        if data["error"]:
            logger.error(f"Error fetching models for user {user['id']}: {data['error']}")
            raise HTTPException(status_code=500, detail=data["error"])

        # Add user_id to response for tracking
        data["user_id"] = user["id"]
        logger.info(f"Successfully fetched models for user {user['id']}")
        return JSONResponse(content=data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching models for user {user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch models")


@router.get("/health")
async def health_check():
    """Public health check - no auth required"""
    logger.debug("Health check called")
    return JSONResponse(content={
        "status": "healthy",
        "service": "experimentation"
    })
