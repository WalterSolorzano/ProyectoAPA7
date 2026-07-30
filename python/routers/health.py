from fastapi import APIRouter
from models import HealthResponse
import time

router = APIRouter(tags=["health"])

_START_TIME = time.time()

@router.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Endpoint básico de health-check."""
    return HealthResponse(status="ok", version="1.0.0", app="WordAPA7")

@router.get("/api/version")
async def get_version():
    """Retorna información detallada de la versión y uptime."""
    uptime_seconds = int(time.time() - _START_TIME)
    return {
        "version": "1.0.0",
        "app": "WordAPA7",
        "uptime_seconds": uptime_seconds,
        "environment": "production"
    }

@router.get("/api/ai/health")
async def get_ai_health():
    """Retorna el estado de los rate limits (bucket de tokens) de IA."""
    from modules.ai_client import get_ai_system_health
    return get_ai_system_health()
