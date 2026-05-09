"""
Sarvam Bot - AI Voice Agent Platform
FastAPI backend entry point.
"""
import logging
import os
import re
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

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

async def _seed_admin() -> None:
    """Create the default admin user if it doesn't exist."""
    import uuid
    from passlib.context import CryptContext
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models import User

    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    async with AsyncSessionLocal() as db:
        async with db.begin():
            result = await db.execute(select(User).where(User.username == "admin"))
            if not result.scalar_one_or_none():
                db.add(User(
                    id=str(uuid.uuid4()),
                    username="admin",
                    email="admin@converse.ai",
                    password_hash=pwd.hash("converse1"),
                ))
                logger.info("Default admin created — username: admin / password: converse1")


async def _load_custom_flows() -> None:
    """Load all custom flows from DB into the in-memory FLOWS registry on startup."""
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models import CustomFlow
    from app.flows.flow_definitions import FLOWS

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CustomFlow))
        rows = result.scalars().all()
        for row in rows:
            FLOWS[row.id] = row.flow_data
        if rows:
            logger.info(f"Loaded {len(rows)} custom flow(s) from database into FLOWS registry.")


def _warm_up_pipecat() -> None:
    """Pre-load the Smart Turn ONNX model at startup so the first session doesn't pay the ~0.5s cost."""
    try:
        from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
        LocalSmartTurnAnalyzerV3()
        logger.info("Pipecat Smart Turn model pre-warmed.")
    except Exception as e:
        logger.warning(f"Pipecat warm-up skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting Sarvam Bot backend...")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Database: {settings.get_async_db_url()[:50]}...")

    try:
        await create_tables()
        logger.info("Database tables created/verified.")
        await _seed_admin()
        await _load_custom_flows()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        logger.warning("Continuing without confirmed DB connection...")

    _warm_up_pipecat()

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

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.customers import router as customers_router
from app.api.conversations import router as conversations_router
from app.api.campaigns import router as campaigns_router
from app.api.analytics import router as analytics_router
from app.api.voice import router as voice_router

app.include_router(auth_router)
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
    """Serve frontend index or API info."""
    index = os.path.join(os.path.dirname(__file__), "..", "static", "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"name": "Sarvam Bot API", "version": "1.0.0", "docs": "/docs"}


# ── Catch-all: serve Next.js static export with SPA fallback ─────────────
# StaticFiles(html=True) was replaced because it serves 404.html as a Response
# (not an exception), bypassing FastAPI exception handlers. This catch-all
# explicitly falls back to index.html for navigation routes.
_static_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "static"))

# Matches /conversations/{id} and /conversations/{id}/... sub-paths
_CONV_RE = re.compile(r'^conversations/([^/]+)(/(.*))?$')


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if not os.path.isdir(_static_dir):
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    # Guard against path traversal
    candidate = os.path.realpath(os.path.join(_static_dir, full_path))
    if not (candidate == _static_dir or candidate.startswith(_static_dir + os.sep)):
        return JSONResponse(status_code=400, content={"detail": "Invalid path"})

    # Exact file match
    if os.path.isfile(candidate):
        return FileResponse(candidate)

    # Directory → try index.html inside it
    idx = os.path.join(candidate, "index.html")
    if os.path.isfile(idx):
        return FileResponse(idx)

    # Static assets and Next.js internals that don't exist → 404
    _, ext = os.path.splitext(full_path.rstrip("/"))
    is_asset = ext.lower() in {
        ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
        ".woff", ".woff2", ".ttf", ".otf", ".map", ".json",
    } or full_path.startswith("_next/") or full_path.startswith("static/")
    if is_asset:
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    # Conversation detail routes: serve the placeholder prerender so Next.js
    # loads ConversationDetail (not the root landing page). Real ID is read
    # client-side via useParams(). Also handles RSC payload requests (.txt).
    m = _CONV_RE.match(full_path.lstrip("/"))
    if m:
        conv_id = m.group(1)
        sub = m.group(3) or ""
        if conv_id != "placeholder":
            placeholder_dir = os.path.join(_static_dir, "conversations", "placeholder")
            # RSC payload: /conversations/{id}/index.txt
            if sub in ("index.txt",):
                rsc = os.path.join(placeholder_dir, "index.txt")
                if os.path.isfile(rsc):
                    return FileResponse(rsc)
            # HTML shell
            ph = os.path.join(placeholder_dir, "index.html")
            if os.path.isfile(ph):
                return FileResponse(ph)

    # SPA fallback for all other paths (navigation routes, RSC payload misses, etc.)
    spa = os.path.join(_static_dir, "index.html")
    if os.path.isfile(spa):
        return FileResponse(spa)

    return JSONResponse(status_code=404, content={"detail": "Not found"})


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
