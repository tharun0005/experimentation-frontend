from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional
import os
from .clients.litellm import fetch_models

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/api/config")
async def get_config():
    return {
        "backendUrl": os.getenv("BACKEND_URL","http://localhost:8001"),
        "litellmUrl": os.getenv("LITELLM_URL", "http://localhost:4000"),
        "frontendUrl": f"http://localhost:{os.getenv('FRONTEND_PORT', '8000')}"
    }

@router.get("/", response_class=HTMLResponse)
async def prompts_ui(request: Request):
    context = {
        "request": request,
    }
    return templates.TemplateResponse("index.html", context)

@router.get("/api/litellm/models")
async def fetch_chat_models(
    api_key: Optional[str] = Query(None),
    timeout: float = Query(5.0)
):
    data = await fetch_models(api_key, timeout)
    if data["error"]:
        raise HTTPException(status_code=500, detail=data["error"])
    return JSONResponse(content=data)

@router.get("/health")
async def health_check():
    return JSONResponse(content={
        "status": "healthy"
    })
