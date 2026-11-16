import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api.ws_manager import ws_manager
from app.api import (
    api_auth,
    api_emergency,
    api_hazards,
    api_routing,
    api_building,
    api_notifications,
    api_iot,
    api_analytics
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evacroute.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing EvacRoute Emergency Response Backend...")
    init_db()
    logger.info("Database and building graph initialized successfully.")
    yield
    logger.info("EvacRoute Emergency Response Backend shutdown.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-Time Emergency Alert and Voice-Guided Evacuation System API",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api
api_prefix = settings.API_V1_STR
app.include_router(api_auth.router, prefix=api_prefix)
app.include_router(api_emergency.router, prefix=api_prefix)
app.include_router(api_hazards.router, prefix=api_prefix)
app.include_router(api_routing.router, prefix=api_prefix)
app.include_router(api_building.router, prefix=api_prefix)
app.include_router(api_notifications.router, prefix=api_prefix)
app.include_router(api_iot.router, prefix=api_prefix)
app.include_router(api_analytics.router, prefix=api_prefix)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "connected_clients": ws_manager.get_connected_count()
    }

@app.websocket("/ws/emergency")
async def websocket_emergency_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Receive client messages, pings, or location updates
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)
