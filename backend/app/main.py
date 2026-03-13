"""
Sarvam Bot - AI Voice Agent Platform
FastAPI backend entry point.
"""
import logging
import sys
from contextlib import asynccontextmanager

import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import create_tables

# ─────────────────────────── Logging Setup ───────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ─────────────────────────── App Lifespan ────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting Sarvam Bot backend...")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Database: {settings.get_async_db_url()[:50]}...")

    try:
        await create_tables()
        logger.info("Database tables created/verified.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        # Don't crash on startup — DB might connect later
        logger.warning("Continuing without confirmed DB connection...")

    yield

    logger.info("Shutting down Sarvam Bot backend...")
    # Clean up active pipelines
    from app.api.voice import _active_pipelines
    for session_id, pipeline in list(_active_pipelines.items()):
        try:
            if hasattr(pipeline, "cleanup"):
                await pipeline.cleanup()
        except Exception as e:
            logger.error(f"Cleanup error for session {session_id}: {e}")
    _active_pipelines.clear()
    logger.info("Shutdown complete.")


# ─────────────────────────── FastAPI App ─────────────────────────────────

app = FastAPI(
    title="Sarvam Bot - AI Voice Agent Platform",
    description=(
        "Production backend for an Indian loan collection AI voice agent platform. "
        "Supports Sarvam AI and Whisper+Edge TTS pipelines with Pipecat-style conversation flows."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ─────────────────────────── CORS ────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.APP_ENV == "development" else [
        "https://sarvam-bot.onrender.com",
        "https://*.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────── Routers ─────────────────────────────────────

from app.api.dashboard import router as dashboard_router
from app.api.customers import router as customers_router
from app.api.conversations import router as conversations_router
from app.api.campaigns import router as campaigns_router
from app.api.analytics import router as analytics_router
from app.api.voice import router as voice_router

app.include_router(dashboard_router)
app.include_router(customers_router)
app.include_router(conversations_router)
app.include_router(campaigns_router)
app.include_router(analytics_router)
app.include_router(voice_router)


# ─────────────────────────── WebSocket Endpoint ──────────────────────────

@app.websocket("/ws/voice/{session_id}")
async def websocket_voice_endpoint(websocket: WebSocket, session_id: str):
    """
    Real-time WebSocket endpoint for a voice call session.

    Events emitted to client:
    - transcript: Live STT/TTS transcript lines
    - node_change: Flow node transitions
    - metrics: STT/LLM/TTS latency per turn
    - dtmf: DTMF keypress events
    - ended: Session ended with outcome
    - error: Pipeline errors
    - status: Current session state
    """
    from app.api.voice import websocket_voice_handler
    await websocket_voice_handler(websocket, session_id)


# ─────────────────────────── Health & Root ───────────────────────────────

@app.get("/health", tags=["system"])
async def health_check():
    """Health check for Render deployment."""
    return {
        "status": "healthy",
        "service": "sarvam-bot-backend",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@app.get("/", tags=["system"])
async def root():
    """Serve frontend or return API info."""
    frontend_index = os.path.join(os.path.dirname(__file__), "..", "static", "index.html")
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index)
    return {
        "name": "Sarvam Bot API",
        "version": "1.0.0",
        "description": "AI Voice Agent Platform for Loan Collection",
        "docs": "/docs",
        "health": "/health",
    }


# Mount Next.js static export — must be after all API routes
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="frontend")


# ─────────────────────────── Error Handlers ──────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found", "path": str(request.url.path)},
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )


# ─────────────────────────── Dev Runner ──────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_ENV == "development",
        log_level="info",
    )
