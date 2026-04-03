"""
SarvamPipecatPipeline: Pipecat-based voice pipeline for loan collection agent.

Architecture:
- Transport:  Pipecat SmallWebRTC  (aiortc under the hood)
- STT:        Sarvam saarika:v2.5  (WebSocket streaming, built-in VAD)
- LLM:        Groq llama-3.3-70b   (OpenAI-compatible)
- TTS:        Sarvam bulbul:v3     (WebSocket, natural Hindi voices)

Pipecat features used:
- Idle detection  (LLMUserAggregatorParams.user_idle_timeout)
- Transcript save (on_user_turn_stopped / on_assistant_turn_stopped)
- Metrics         (PipelineParams enable_metrics + MetricsLogObserver)
- Turn tracking   (TurnTrackingObserver)
- Voicemail       (VoicemailDetector)
"""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from app.config import settings
from app.flows.flow_manager import FlowManager

logger = logging.getLogger(__name__)


def _build_pipecat_ice_servers():
    """Deduplicated ICE server list for SmallWebRTCConnection."""
    if not settings.TURN_URL:
        return ["stun:stun.l.google.com:19302"]

    all_urls = [u.strip() for u in settings.TURN_URL.split(",") if u.strip()]
    kept: List[str] = []
    has_turn = has_turns = False
    for url in all_urls:
        if url.startswith("turns:") and not has_turns:
            kept.append(url); has_turns = True
        elif url.startswith("turn:") and not has_turn:
            kept.append(url); has_turn = True
    turn_urls = kept or all_urls[:2]

    # Try Pipecat's IceServer model; fall back to plain dicts.
    try:
        from pipecat.transports.smallwebrtc.connection import IceServer
        return [
            IceServer(
                urls=url,
                username=settings.TURN_USERNAME or "",
                credential=settings.TURN_CREDENTIAL or "",
            )
            for url in turn_urls
        ]
    except ImportError:
        return [
            {"urls": url, "username": settings.TURN_USERNAME, "credential": settings.TURN_CREDENTIAL}
            for url in turn_urls
        ]


class SarvamPipecatPipeline:
    """
    Pipecat-based pipeline for Sarvam AI voice agents.

    Implements the same interface as BasePipeline so it can be dropped
    into the existing voice.py API without changes.
    """

    def __init__(
        self,
        session_id: str,
        customer_id: Optional[str],
        flow_id: str,
        customer_context: Dict[str, Any],
        db_session: Any,
        ws_emit: Callable,
        agent_config: Optional[Dict[str, Any]] = None,
        voice_id: str = "priya",
    ):
        self.session_id = session_id
        self.customer_id = customer_id
        self.flow_id = flow_id
        self.customer_context = customer_context
        self.db = db_session
        self.ws_emit = ws_emit
        self.agent_config = agent_config or {}
        self.voice_id = voice_id
        self._has_db_record: bool = bool(customer_id)

        self.is_running = False
        self.is_ended = False
        self.start_time: Optional[float] = None
        self.turn_index = 0
        self._idle_count = 0

        self._task = None
        self._connection = None

        self.flow_manager = FlowManager(
            flow_id=flow_id,
            session_id=session_id,
            customer_context=customer_context,
            on_node_change=self._on_node_change,
        )

    # ─────────────────────────── run() ───────────────────────────────────

    async def run(self, offer_sdp: str) -> str:
        """Process WebRTC SDP offer, build Pipecat pipeline, return SDP answer."""
        try:
            from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
            from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
            from pipecat.pipeline.pipeline import Pipeline
            from pipecat.pipeline.task import PipelineTask, PipelineParams, PipelineTaskParams
            from pipecat.services.sarvam.stt import SarvamSTTService, SarvamSTTSettings
            from pipecat.services.sarvam.tts import SarvamTTSService
            from pipecat.services.groq.llm import GroqLLMService, GroqLLMSettings
            from pipecat.processors.aggregators.llm_response_universal import (
                LLMContextAggregatorPair,
                LLMUserAggregatorParams,
            )
            from pipecat.processors.aggregators.llm_context import LLMContext
            from pipecat.transcriptions.language import Language
            from pipecat.transports.base_transport import TransportParams
            from pipecat.frames.frames import (
                TTSSpeakFrame,
                EndFrame,
                LLMMessagesAppendFrame,
            )
            from pipecat.observers.loggers.metrics_log_observer import MetricsLogObserver
            from pipecat.observers.turn_tracking_observer import TurnTrackingObserver
        except ImportError as e:
            raise RuntimeError(
                f"pipecat-ai not installed or incomplete: {e}. "
                "Add pipecat-ai[sarvam,webrtc] to requirements.txt"
            )

        # ── Language mapping ──────────────────────────────────────────────
        lang_code = self.customer_context.get("preferred_language", "hi")[:2]
        lang_map = {
            "hi": Language.HI_IN, "en": Language.EN_IN, "ta": Language.TA_IN,
            "te": Language.TE_IN, "kn": Language.KN_IN, "ml": Language.ML_IN,
            "mr": Language.MR_IN, "gu": Language.GU_IN, "bn": Language.BN_IN,
            "pa": Language.PA_IN,
        }
        pipecat_lang = lang_map.get(lang_code, Language.HI_IN)

        # ── WebRTC Connection ─────────────────────────────────────────────
        ice_servers = _build_pipecat_ice_servers()
        self._connection = SmallWebRTCConnection(ice_servers=ice_servers)
        await self._connection.initialize(sdp=offer_sdp, type="offer")

        # ── Transport ─────────────────────────────────────────────────────
        # audio_out_sample_rate=24000 matches bulbul:v3 native output rate.
        # VAD is handled by Sarvam STT's own vad_signals — no Silero needed.
        transport = SmallWebRTCTransport(
            webrtc_connection=self._connection,
            params=TransportParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                audio_out_sample_rate=24000,
            ),
        )

        # ── STT ───────────────────────────────────────────────────────────
        stt = SarvamSTTService(
            api_key=settings.SARVAM_API_KEY,
            settings=SarvamSTTSettings(
                language=pipecat_lang,
                vad_signals=True,          # Use Sarvam's native VAD
                high_vad_sensitivity=False,
            ),
        )

        # ── LLM ───────────────────────────────────────────────────────────
        llm = GroqLLMService(
            api_key=settings.GROQ_API_KEY,
            settings=GroqLLMSettings(
                model=settings.DEFAULT_LLM_MODEL,
                temperature=0.7,
                max_tokens=150,
                top_p=0.9,
            ),
        )

        # ── TTS ───────────────────────────────────────────────────────────
        tts = SarvamTTSService(
            api_key=settings.SARVAM_API_KEY,
            voice_id=self.voice_id,  # Selected by user; bulbul:v3 female: priya,neha,pooja,simran,kavya,ritu / male: rahul,rohan,amit,dev
            model="bulbul:v3",
            params=SarvamTTSService.InputParams(
                language=pipecat_lang,  # Critical: set correct language so Hindi text is pronounced in Hindi, not English
            ),
        )

        # ── Context & Aggregators ─────────────────────────────────────────
        system_prompt = self.flow_manager.get_system_prompt()
        context = LLMContext(
            messages=[{"role": "system", "content": system_prompt}]
        )
        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                user_idle_timeout=10.0,  # Detect customer silence after 10s
            ),
        )

        # ── Pipeline ──────────────────────────────────────────────────────
        pipeline = Pipeline([
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ])

        # ── Task + Observers ──────────────────────────────────────────────
        turn_observer = TurnTrackingObserver()

        @turn_observer.event_handler("on_turn_ended")
        async def on_turn_ended(observer, turn_count, duration, was_interrupted):
            await self._emit({
                "type": "metrics",
                "turn_count": turn_count,
                "turn_duration_secs": round(duration, 3),
                "was_interrupted": was_interrupted,
                "session_id": self.session_id,
            })

        self._task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=False,        # Loan collection: don't let VAD cut off agent mid-sentence
                audio_out_sample_rate=24000,      # Match bulbul:v3 native output rate
                enable_metrics=True,
                enable_usage_metrics=True,
                observers=[MetricsLogObserver(), turn_observer],
            ),
        )

        # ── Event Handlers ────────────────────────────────────────────────

        @transport.event_handler("on_client_connected")
        async def on_client_connected(transport, client):
            self.is_running = True
            self.start_time = time.time()
            logger.info(f"[SarvamPipecat:{self.session_id}] Client connected")

            await self._emit({
                "type": "status",
                "status": "started",
                "session_id": self.session_id,
                "current_node": self.flow_manager.current_node.to_dict(),
            })

            # Greeting — speaks immediately via TTS pipeline
            # Written in Devanagari so bulbul:v3 pronounces Hindi correctly.
            name = self.customer_context.get("name", "")
            # Use the selected voice name as the agent's self-introduction.
            voice_name = self.voice_id.capitalize()
            greeting = (
                f"नमस्ते {name}जी। मैं {voice_name} बोल रही हूँ, "
                f"आपके loan account के बारे में बात करनी थी। "
                f"क्या आप अभी बात कर सकते हैं?"
            )
            await self._task.queue_frames([TTSSpeakFrame(greeting)])
            await self._save_transcript("agent", greeting)
            await self._emit_transcript("agent", greeting, 0)
            # The greeting bypasses the LLM (TTSSpeakFrame goes direct to TTS).
            # Advance the flow past the greeting node now so the LLM context
            # is already on the next step when the customer first responds.
            self.flow_manager.process_single_edge_transition()
            context.set_messages([{"role": "system", "content": self.flow_manager.get_system_prompt()}])

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            logger.info(f"[SarvamPipecat:{self.session_id}] Client disconnected")
            await self.end_session(status="completed")

        # ── Idle detection ────────────────────────────────────────────────

        @user_aggregator.event_handler("on_user_turn_idle")
        async def on_user_turn_idle(aggregator):
            self._idle_count += 1
            if self._idle_count == 1:
                msg = {
                    "role": "system",
                    "content": (
                        "The customer has been silent for 10 seconds. "
                        "Politely ask in Hindi — write all Hindi words in Devanagari script — "
                        "if they can hear you and are still there."
                    ),
                }
                await aggregator.push_frame(LLMMessagesAppendFrame([msg], run_llm=True))
            elif self._idle_count == 2:
                msg = {
                    "role": "system",
                    "content": (
                        "The customer is still not responding. "
                        "In Hindi (Devanagari script), say you will call back later and say goodbye."
                    ),
                }
                await aggregator.push_frame(LLMMessagesAppendFrame([msg], run_llm=True))
            else:
                await self.end_session(status="no_answer", outcome="no_answer")

        @user_aggregator.event_handler("on_user_turn_started")
        async def on_user_turn_started(aggregator, strategy):
            self._idle_count = 0  # Reset idle count when customer speaks

        # ── Transcript saving ─────────────────────────────────────────────

        @user_aggregator.event_handler("on_user_turn_stopped")
        async def on_user_turn_stopped(aggregator, strategy, message):
            self.turn_index += 1
            text = getattr(message, "content", str(message))
            logger.info(f"[SarvamPipecat:{self.session_id}] Customer: {text[:80]}")
            await self._save_transcript("customer", text)
            await self._emit_transcript("customer", text, 0)

            # For decision nodes (multiple outgoing edges): detect yes/no and
            # other intents from the customer's utterance and transition.
            self.flow_manager.process_customer_response(text)
            # Always refresh the system prompt so the LLM sees the current node.
            context.set_messages([{"role": "system", "content": self.flow_manager.get_system_prompt()}])

        @assistant_aggregator.event_handler("on_assistant_turn_stopped")
        async def on_assistant_turn_stopped(aggregator, message):
            text = getattr(message, "content", str(message))
            logger.info(f"[SarvamPipecat:{self.session_id}] Agent: {text[:80]}")
            await self._save_transcript("agent", text)
            await self._emit_transcript("agent", text, 0)
            # For action nodes (single outgoing edge): auto-advance after agent
            # speaks — no customer keyword needed to trigger the transition.
            self.flow_manager.process_single_edge_transition()
            context.set_messages([{"role": "system", "content": self.flow_manager.get_system_prompt()}])

        # ── Start pipeline in background ──────────────────────────────────
        loop = asyncio.get_event_loop()
        asyncio.ensure_future(self._task.run(PipelineTaskParams(loop=loop)))

        # Return SDP answer to caller
        answer = self._connection.get_answer()
        return answer["sdp"]

    # ─────────────────────────── Helpers ─────────────────────────────────

    async def _emit(self, event: Dict[str, Any]) -> None:
        try:
            await self.ws_emit(self.session_id, event)
        except Exception as e:
            logger.error(f"[SarvamPipecat] WS emit error: {e}")

    async def _emit_transcript(self, speaker: str, text: str, latency_ms: float) -> None:
        await self._emit({
            "type": "transcript",
            "speaker": speaker,
            "text": text,
            "latency_ms": round(latency_ms, 2),
            "turn_index": self.turn_index,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": self.session_id,
        })

    async def _save_transcript(self, speaker: str, text: str) -> None:
        if not self._has_db_record:
            return
        from app.models import Transcript
        transcript = Transcript(
            id=str(uuid.uuid4()),
            session_id=self.session_id,
            speaker=speaker,
            text=text,
            language=self.customer_context.get("preferred_language", "hi"),
            turn_index=self.turn_index,
        )
        self.db.add(transcript)
        try:
            await self.db.flush()
        except Exception as e:
            logger.error(f"[SarvamPipecat] Transcript save error: {e}")

    async def _on_node_change(self, session_id: str, event: Dict[str, Any]) -> None:
        await self._emit(event)

    # ─────────────────────────── Session lifecycle ────────────────────────

    async def end_session(
        self, status: str = "completed", outcome: Optional[str] = None
    ) -> None:
        if self.is_ended:
            return
        self.is_ended = True
        self.is_running = False

        if self._task:
            try:
                from pipecat.frames.frames import EndFrame
                from pipecat.processors.frame_processor import FrameDirection
                await self._task.queue_frames([EndFrame()])
            except Exception:
                pass

        await self._emit({
            "type": "ended",
            "status": status,
            "outcome": outcome,
            "session_id": self.session_id,
        })

        if self._has_db_record:
            await self._update_session_status(status, outcome)

    async def _update_session_status(self, status: str, outcome: Optional[str]) -> None:
        from app.models import CallSession
        from sqlalchemy import select
        try:
            result = await self.db.execute(
                select(CallSession).where(CallSession.id == self.session_id)
            )
            session = result.scalar_one_or_none()
            if session:
                session.status = status
                session.outcome = outcome
                if self.start_time:
                    session.duration_seconds = int(time.time() - self.start_time)
                session.end_time = datetime.now(timezone.utc)
                await self.db.flush()
        except Exception as e:
            logger.error(f"[SarvamPipecat] Session update error: {e}")

    async def cleanup(self) -> None:
        """Pipecat handles cleanup via EndFrame; nothing to do here."""
        pass

    async def process_sdp_offer(self, offer_sdp: str) -> str:
        return await self.run(offer_sdp)

    async def process_ice_candidate(
        self, candidate: str, sdp_mid: str, sdp_mline_index: int
    ) -> None:
        """Pipecat SmallWebRTC handles ICE internally via the offer SDP."""
        pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "is_running": self.is_running,
            "is_ended": self.is_ended,
            "flow_state": self.flow_manager.get_state(),
            "turn_count": self.turn_index,
        }
