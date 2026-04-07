"""
Voice API: WebRTC signaling, session management, WebSocket events,
and flow retrieval endpoints.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, AsyncSessionLocal
from app.flows.flow_definitions import FLOWS
from app.models import CallSession, Customer
from app.schemas import (
    VoiceSessionCreate, VoiceSessionResponse,
    SDPOfferRequest, ICECandidateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# ─────────────────────────── In-Memory State ─────────────────────────────
# Stores active pipeline instances keyed by session_id
_active_pipelines: Dict[str, Any] = {}

# Stores WebSocket connections keyed by session_id
_ws_connections: Dict[str, List[WebSocket]] = {}

# Stores pending SDP offers
_pending_offers: Dict[str, Dict[str, Any]] = {}


# ─────────────────────────── WebSocket Event Emitter ─────────────────────

async def ws_emit(session_id: str, event: Dict[str, Any]) -> None:
    """Emit a JSON event to all WebSocket clients watching this session."""
    connections = _ws_connections.get(session_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(event)
        except Exception as e:
            logger.warning(f"[WS] Dead connection for session {session_id}: {e}")
            dead.append(ws)
    for d in dead:
        connections.remove(d)


# ─────────────────────────── ICE Servers ─────────────────────────────────

@router.get("/ice-servers")
async def get_ice_servers() -> Dict[str, Any]:
    """Return TURN/STUN server configuration for WebRTC clients."""
    return {
        "iceServers": _build_ice_servers(),
        "stun_only": not bool(settings.TURN_URL),
    }


# ─────────────────────────── Create Voice Session ────────────────────────

@router.post("/sessions", response_model=VoiceSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_voice_session(
    payload: VoiceSessionCreate,
    db: AsyncSession = Depends(get_db),
) -> VoiceSessionResponse:
    """
    Create a new voice call session.
    Returns session_id and ICE server configuration.
    """
    # Validate flow
    if payload.flow_id not in FLOWS:
        raise HTTPException(status_code=400, detail=f"Unknown flow_id: {payload.flow_id}")

    # Resolve customer: DB lookup if customer_id given, else use inline AgentConfig fields
    customer = None
    if payload.customer_id:
        customer_result = await db.execute(
            select(Customer).where(Customer.id == payload.customer_id)
        )
        customer = customer_result.scalar_one_or_none()

    # Build customer context — prefer DB record, fall back to inline fields
    if customer:
        customer_context = {
            "name": customer.name,
            "phone": customer.phone,
            "loan_amount": str(customer.loan_amount),
            "outstanding_amount": str(customer.outstanding_amount),
            "dpd": customer.dpd,
            "due_date": str(customer.due_date) if customer.due_date else "N/A",
            "loan_id": customer.loan_id or "",
            "preferred_language": customer.preferred_language or "hi",
            "segment": customer.segment,
        }
    else:
        # Testing / demo mode — use fields from AgentConfig directly
        customer_context = {
            "name": payload.customer_name or "Test Customer",
            "phone": "",
            "loan_amount": str(payload.loan_amount or 0),
            "outstanding_amount": str(payload.outstanding_amount or 0),
            "dpd": payload.dpd or 0,
            "due_date": payload.due_date or "N/A",
            "loan_id": "",
            "preferred_language": (payload.language or "hi-IN").split("-")[0],
            "segment": "test",
        }

    # Create DB session record (only when a real customer_id is present)
    session_id = str(uuid.uuid4())
    flow_def = FLOWS[payload.flow_id]

    if payload.customer_id:
        db_session = CallSession(
            id=session_id,
            customer_id=payload.customer_id,
            campaign_id=payload.campaign_id,
            agent_type=payload.agent_type,
            flow_id=payload.flow_id,
            tier=flow_def.get("tier", "tier_1"),
            status="active",
            start_time=datetime.now(timezone.utc),
        )
        db.add(db_session)
        await db.flush()

    # Initialize pipeline based on agent_type
    pipeline = _create_pipeline(
        agent_type=payload.agent_type,
        session_id=session_id,
        customer_id=payload.customer_id,
        flow_id=payload.flow_id,
        customer_context=customer_context,
        db_session=db,
        voice_id=payload.voice_id or "priya",
        llm_provider=payload.llm_provider or "groq",
        llm_max_tokens=payload.llm_max_tokens or 300,
    )

    _active_pipelines[session_id] = pipeline
    _ws_connections[session_id] = []

    # ICE servers — deduplicate TURN URLs to avoid browser "5+ servers" warning
    ice_servers = _build_ice_servers()

    logger.info(f"[Voice] Created session {session_id} for customer {customer_context['name']} ({payload.agent_type})")

    return VoiceSessionResponse(
        session_id=session_id,
        ice_servers=ice_servers,
        status="created",
    )


def _build_ice_servers() -> List[Dict[str, Any]]:
    """Build deduplicated ICE server list (max 1 turn: + 1 turns: URL to avoid browser warning)."""
    if not settings.TURN_URL:
        return [{"urls": "stun:stun.l.google.com:19302"}]
    all_urls = [u.strip() for u in settings.TURN_URL.split(",") if u.strip()]
    kept: List[str] = []
    has_turn = has_turns = False
    for url in all_urls:
        if url.startswith("turns:") and not has_turns:
            kept.append(url); has_turns = True
        elif url.startswith("turn:") and not has_turn:
            kept.append(url); has_turn = True
    return [{"urls": kept or all_urls[:2], "username": settings.TURN_USERNAME, "credential": settings.TURN_CREDENTIAL}]


def _create_pipeline(
    agent_type: str,
    session_id: str,
    customer_id: Optional[str],
    flow_id: str,
    customer_context: Dict[str, Any],
    db_session: AsyncSession,
    voice_id: str = "priya",
    llm_provider: str = "groq",
    llm_max_tokens: int = 300,
) -> Any:
    """Instantiate the correct pipeline class based on agent_type."""
    if agent_type == "sarvam":
        from app.pipelines.sarvam_pipecat_pipeline import SarvamPipecatPipeline
        return SarvamPipecatPipeline(
            session_id=session_id,
            customer_id=customer_id,
            flow_id=flow_id,
            customer_context=customer_context,
            db_session=db_session,
            ws_emit=ws_emit,
            voice_id=voice_id,
            llm_provider=llm_provider,
            llm_max_tokens=llm_max_tokens,
        )
    elif agent_type == "whisper_edge":
        from app.pipelines.whisper_edge_pipeline import WhisperEdgePipeline
        return WhisperEdgePipeline(
            session_id=session_id,
            customer_id=customer_id,
            flow_id=flow_id,
            customer_context=customer_context,
            db_session=db_session,
            ws_emit=ws_emit,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown agent_type: {agent_type}")


# ─────────────────────────── SDP Offer ───────────────────────────────────

@router.post("/sessions/{session_id}/offer")
async def process_sdp_offer(
    session_id: str,
    payload: SDPOfferRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Accept WebRTC SDP offer from browser and return SDP answer.
    Starts the voice pipeline.
    """
    pipeline = _active_pipelines.get(session_id)
    if not pipeline:
        # Try to reconstruct from DB
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Store the offer
    _pending_offers[session_id] = {
        "sdp": payload.sdp,
        "type": payload.type,
    }

    try:
        answer_sdp = await pipeline.run(payload.sdp)
        return {
            "sdp": answer_sdp,
            "type": "answer",
            "session_id": session_id,
        }
    except Exception as e:
        logger.error(f"[Voice] SDP processing error for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"SDP processing failed: {str(e)}")


# ─────────────────────────── ICE Candidate ───────────────────────────────

@router.post("/sessions/{session_id}/ice")
async def add_ice_candidate(
    session_id: str,
    payload: ICECandidateRequest,
) -> Dict[str, str]:
    """Add ICE candidate to the active peer connection."""
    pipeline = _active_pipelines.get(session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")

    if hasattr(pipeline, "process_ice_candidate"):
        try:
            await pipeline.process_ice_candidate(
                candidate=payload.candidate,
                sdp_mid=payload.sdpMid or "0",
                sdp_mline_index=payload.sdpMLineIndex or 0,
            )
        except Exception as e:
            logger.error(f"[Voice] ICE error for {session_id}: {e}")

    return {"status": "ok", "session_id": session_id}


# ─────────────────────────── End Session ─────────────────────────────────

@router.post("/sessions/{session_id}/end")
async def end_voice_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Gracefully end a voice session."""
    pipeline = _active_pipelines.get(session_id)

    if pipeline:
        try:
            await pipeline.end_session(status="completed")
        except Exception as e:
            logger.error(f"[Voice] End session error for {session_id}: {e}")

        if hasattr(pipeline, "cleanup"):
            try:
                await pipeline.cleanup()
            except Exception:
                pass

        _active_pipelines.pop(session_id, None)
    else:
        # Update DB directly if pipeline is gone (skip for testing sessions with no DB record)
        result = await db.execute(select(CallSession).where(CallSession.id == session_id))
        session = result.scalar_one_or_none()
        if session and session.status == "active":
            session.status = "completed"
            session.end_time = datetime.now(timezone.utc)
            await db.flush()

    # Clean up WebSocket connections
    _ws_connections.pop(session_id, None)
    _pending_offers.pop(session_id, None)

    return {"status": "ended", "session_id": session_id}


# ─────────────────────────── Session Status ──────────────────────────────

@router.get("/sessions/{session_id}/status")
async def get_session_status(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get current session status including active flow node and metrics."""
    pipeline = _active_pipelines.get(session_id)

    if pipeline:
        return pipeline.get_status()

    # Fallback to DB
    result = await db.execute(
        select(CallSession).where(CallSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "status": session.status,
        "outcome": session.outcome,
        "duration_seconds": session.duration_seconds,
        "is_running": False,
        "is_ended": True,
    }


# ─────────────────────────── Flows API ───────────────────────────────────

@router.get("/flows")
async def list_flows() -> Dict[str, Any]:
    """Return all flow definitions with full node/edge data for ReactFlow."""
    return {
        "flows": list(FLOWS.values()),
        "count": len(FLOWS),
    }


@router.get("/flows/{flow_id}")
async def get_flow(flow_id: str) -> Dict[str, Any]:
    """Return a specific flow definition."""
    if flow_id not in FLOWS:
        raise HTTPException(
            status_code=404,
            detail=f"Flow '{flow_id}' not found. Available: {list(FLOWS.keys())}"
        )
    return FLOWS[flow_id]


# ─────────────────────────── WebSocket Handler ───────────────────────────

async def websocket_voice_handler(
    websocket: WebSocket,
    session_id: str,
) -> None:
    """
    WebSocket endpoint for real-time voice session events.

    Emits JSON events:
    - {type: 'transcript', speaker, text, latency_ms, turn_index, timestamp}
    - {type: 'node_change', from_node, to_node, node, turn_count}
    - {type: 'metrics', stt_latency_ms, llm_latency_ms, tts_latency_ms, total_latency_ms}
    - {type: 'dtmf', digit, next_node}
    - {type: 'ended', status, outcome, duration_seconds}
    - {type: 'error', message}
    - {type: 'status', status, current_node}
    - {type: 'audio_level', level}

    Receives JSON messages:
    - {type: 'ping'} → responds with {type: 'pong'}
    - {type: 'dtmf', digit} → triggers DTMF handling
    - {type: 'end'} → gracefully ends session
    """
    await websocket.accept()
    logger.info(f"[WS] Client connected to session {session_id}")

    # Register this connection
    if session_id not in _ws_connections:
        _ws_connections[session_id] = []
    _ws_connections[session_id].append(websocket)

    # Send initial status
    pipeline = _active_pipelines.get(session_id)
    if pipeline:
        await websocket.send_json({
            "type": "status",
            "session_id": session_id,
            "is_running": pipeline.is_running,
            "flow_state": pipeline.flow_manager.get_state(),
        })
    else:
        await websocket.send_json({
            "type": "status",
            "session_id": session_id,
            "is_running": False,
            "message": "Pipeline not active",
        })

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
                continue
            except WebSocketDisconnect:
                break

            msg_type = data.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "dtmf":
                digit = data.get("digit", "")
                pipeline = _active_pipelines.get(session_id)
                if pipeline and digit:
                    asyncio.ensure_future(pipeline._handle_dtmf(digit))

            elif msg_type == "end":
                pipeline = _active_pipelines.get(session_id)
                if pipeline:
                    asyncio.ensure_future(
                        pipeline.end_session(status="completed", outcome=data.get("outcome"))
                    )
                await websocket.send_json({
                    "type": "ended",
                    "session_id": session_id,
                    "status": "completed",
                })
                break

            elif msg_type == "get_status":
                pipeline = _active_pipelines.get(session_id)
                if pipeline:
                    await websocket.send_json({
                        "type": "status",
                        **pipeline.get_status(),
                    })

    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"[WS] Error in session {session_id}: {e}")
    finally:
        # Clean up this connection
        conns = _ws_connections.get(session_id, [])
        if websocket in conns:
            conns.remove(websocket)
        logger.info(f"[WS] Connection closed for session {session_id}")
