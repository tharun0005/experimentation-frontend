import os
import httpx
from typing import List, Optional, Dict, Any


async def fetch_models(api_key: Optional[str] = None, timeout: float = 5.0) -> Dict[str, Any]:
    """Fetch chat models from LiteLLM proxy with proper error handling."""
    litellm_url = os.getenv('LITELLM_URL', 'http://localhost:4000')
    litellm_key = api_key or os.getenv('LITELLM_API_KEY')

    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {litellm_key}" if litellm_key else None,
    }
    if not headers["Authorization"]:
        del headers["Authorization"]

    url = f"{litellm_url.rstrip('/')}/v1/model/info"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        models = data.get("data", [])
        chat_models = [
            m.get("model_name")
            for m in models
            if m.get("model_info", {}).get("mode") == "chat"
        ]

        return {
            "service": "litellm",
            "base_url": litellm_url,
            "models": chat_models,
            "error": None
        }

    except httpx.HTTPStatusError as exc:
        return {
            "service": "litellm",
            "base_url": litellm_url,
            "models": [],
            "error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        }
    except httpx.RequestError as exc:
        return {
            "service": "litellm",
            "base_url": litellm_url,
            "models": [],
            "error": f"Connection failed: {str(exc)}"
        }
    except Exception as exc:
        return {
            "service": "litellm",
            "base_url": litellm_url,
            "models": [],
            "error": f"{type(exc).__name__}: {str(exc)}"
        }
