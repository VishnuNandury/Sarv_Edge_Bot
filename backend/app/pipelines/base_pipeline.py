"""
BasePipeline: Abstract base class for all voice agent pipelines.
Provides shared infrastructure for WebSocket event emission, transcript saving,
metrics tracking, voicemail detection, and idle detection.
"""
import asyncio
import json
import logging
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.flows.flow_manager import FlowManager
from app.flows.flow_definitions import FLOWS

logger = logging.getLogger(__name__)


class PipelineEvent:
    """Structured events emitted over WebSocket."""
    TRANSCRIPT = "transcript"
    NODE_CHANGE = "node_change"
    METRICS = "metrics"
    DTMF = "dtmf"
    ENDED = "ended"
    ERROR = "error"
    STATUS = "status"
    AUDIO_LEVEL = "audio_level"


class BasePipeline(ABC):
    """
    Abstract base for Sarvam and Whisper+Edge voice pipelines.

    Subclasses must implement:
    - run(): Start the full pipeline
    - _transcribe_audio(audio_bytes): STT call → str
    - _synthesize_speech(text): TTS call → bytes
    - _call_llm(messages): LLM call → str
    """

    VOICEMAIL_SILENCE_THRESHOLD = 3      # turns with no speech → voicemail
    IDLE_SILENCE_SECONDS = 10            # seconds of silence → idle prompt
    MAX_IDLE_PROMPTS = 2                 # prompts before ending call
    VOICEMAIL_DETECT_PHRASES = [         # phrases indicating voicemail
        "please leave a message",
        "not available",
        "iske baad apna sandesh",
        "beep ke baad",
    ]

    def __init__(
        self,
        session_id: str,
        customer_id: str,
        flow_id: str,
        customer_context: Dict[str, Any],
        db_session: AsyncSession,
        ws_emit: Callable[[str, Dict[str, Any]], None],
        agent_config: Optional[Dict[str, Any]] = None,
    ):
        self.session_id = session_id
        self.customer_id = customer_id
        self.flow_id = flow_id
        self.customer_context = customer_context
        self.db = db_session
        self.ws_emit = ws_emit
        self.agent_config = agent_config or {}
        # In testing mode (no customer_id) there is no call_sessions DB row,
        # so skip all DB writes to avoid FK constraint violations.
        self._has_db_record: bool = bool(customer_id)

        # State
        self.is_running = False
        self.is_ended = False
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None

        # Metrics accumulators
        self.stt_latencies: List[float] = []
        self.llm_latencies: List[float] = []
        self.tts_latencies: List[float] = []
        self.total_tokens_input: int = 0
        self.total_tokens_output: int = 0

        # Transcript state
        self.turn_index: int = 0
        self.conversation_history: List[Dict[str, str]] = []

        # Idle detection
        self.last_customer_speech_time: float = time.time()
        self.idle_prompt_count: int = 0

        # Voicemail detection
        self.empty_response_count: int = 0

        # Flow manager
        self.flow_manager = FlowManager(
            flow_id=flow_id,
            session_id=session_id,
            customer_context=customer_context,
            on_node_change=self._on_node_change,
        )

    # ─────────────────────── Abstract Methods ────────────────────────────

    @abstractmethod
    async def run(self, offer_sdp: str) -> str:
        """Start pipeline. Accept WebRTC offer, return SDP answer."""
        ...

    async def _queue_audio(self, audio_bytes: bytes) -> None:
        """Queue audio bytes for playback. Subclasses with response queues override this."""
        pass

    @abstractmethod
    async def _transcribe_audio(self, audio_bytes: bytes, language: str = "hi") -> str:
        """Convert audio bytes to text using STT service."""
        ...

    @abstractmethod
    async def _synthesize_speech(self, text: str, language: str = "hi") -> bytes:
        """Convert text to audio bytes using TTS service."""
        ...

    @abstractmethod
    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
    ) -> Dict[str, Any]:
        """Call LLM and return {text, tokens_input, tokens_output, latency_ms}."""
        ...

    # ─────────────────────── Core Turn Processing ────────────────────────

    async def process_turn(self, audio_bytes: bytes) -> Optional[bytes]:
        """
        Full STT → LLM → TTS pipeline for a single conversation turn.
        Returns TTS audio bytes or None on failure.
        """
        if self.is_ended:
            return None

        # ── STT ──
        stt_start = time.time()
        try:
            transcript_text = await self._transcribe_audio(
                audio_bytes,
                language=self.customer_context.get("preferred_language", "hi")[:2],
            )
        except Exception as e:
            logger.error(f"[Pipeline:{self.session_id}] STT error: {e}")
            await self._emit_error(f"STT failed: {e}")
            return None

        stt_latency = (time.time() - stt_start) * 1000
        self.stt_latencies.append(stt_latency)

        # Empty response detection (voicemail)
        if not transcript_text or len(transcript_text.strip()) < 3:
            self.empty_response_count += 1
            if self.empty_response_count >= self.VOICEMAIL_SILENCE_THRESHOLD:
                await self._handle_voicemail()
                return None
            return None
        else:
            self.empty_response_count = 0
            self.last_customer_speech_time = time.time()
            self.idle_prompt_count = 0

        # Voicemail phrase detection
        if self._is_voicemail_response(transcript_text):
            await self._handle_voicemail()
            return None

        # Save customer transcript
        await self._save_transcript("customer", transcript_text)
        await self._emit_transcript("customer", transcript_text, stt_latency)

        # ── DTMF detection (look for digit in transcript) ──
        dtmf_digit = self._extract_dtmf(transcript_text)
        if dtmf_digit:
            await self._handle_dtmf(dtmf_digit)

        # ── LLM ──
        self.conversation_history.append({"role": "user", "content": transcript_text})
        system_prompt = self.flow_manager.get_system_prompt()

        llm_start = time.time()
        try:
            llm_result = await self._call_llm(self.conversation_history, system_prompt)
        except Exception as e:
            logger.error(f"[Pipeline:{self.session_id}] LLM error: {e}")
            await self._emit_error(f"LLM failed: {e}")
            return None

        llm_latency = (time.time() - llm_start) * 1000
        self.llm_latencies.append(llm_latency)

        agent_text = llm_result.get("text", "")
        self.total_tokens_input += llm_result.get("tokens_input", 0)
        self.total_tokens_output += llm_result.get("tokens_output", 0)

        self.conversation_history.append({"role": "assistant", "content": agent_text})

        # Detect flow transitions from LLM output
        await self._detect_and_transition(transcript_text, agent_text)

        # Save agent transcript
        await self._save_transcript("agent", agent_text)
        await self._emit_transcript("agent", agent_text, llm_latency)

        # ── TTS ──
        tts_start = time.time()
        try:
            audio_response = await self._synthesize_speech(
                agent_text,
                language=self.customer_context.get("preferred_language", "hi")[:2],
            )
        except Exception as e:
            logger.error(f"[Pipeline:{self.session_id}] TTS error: {e}")
            await self._emit_error(f"TTS failed: {e}")
            return None

        tts_latency = (time.time() - tts_start) * 1000
        self.tts_latencies.append(tts_latency)

        total_latency = stt_latency + llm_latency + tts_latency

        # Emit metrics
        await self._emit_metrics(stt_latency, llm_latency, tts_latency, total_latency)

        # Check if flow is complete
        if self.flow_manager.is_complete():
            await asyncio.sleep(2)  # Let TTS finish
            await self.end_session(outcome="completed")

        return audio_response

    # ─────────────────────── Flow Transitions ────────────────────────────

    async def _detect_and_transition(self, user_text: str, agent_text: str) -> None:
        """Detect intent from conversation and advance the flow."""
        combined = f"{user_text} {agent_text}".lower()

        # Simple keyword-based intent detection
        intent = None
        if any(w in combined for w in ["payment kar diya", "paid", "pay kar", "bhej diya", "transfer"]):
            intent = "payment made"
        elif any(w in combined for w in ["commitment", "karunga", "karenge", "de dunga", "ok"]):
            intent = "date committed"
        elif any(w in combined for w in ["nahi kar sakta", "problem", "mushkil", "issue", "objection"]):
            intent = "objection"
        elif any(w in combined for w in ["baad mein", "call back", "callback", "baad me"]):
            intent = "not available"
        elif any(w in combined for w in ["settlement", "ek baar", "one time"]):
            intent = "complex objection"
        elif any(w in combined for w in ["confirm", "verified", "sahi", "haan"]):
            intent = "verified"
        elif any(w in combined for w in ["dhanyawad", "shukriya", "thank", "bye", "goodbye", "alvida"]):
            intent = "done"

        if intent:
            self.flow_manager.process_llm_intent(intent)

    async def _handle_dtmf(self, digit: str) -> None:
        """Process DTMF input and transition flow."""
        next_node = self.flow_manager.process_dtmf(digit)
        await self._emit_event({
            "type": PipelineEvent.DTMF,
            "digit": digit,
            "next_node": next_node,
            "session_id": self.session_id,
        })

    def _extract_dtmf(self, text: str) -> Optional[str]:
        """Extract DTMF digit mentions from transcribed speech."""
        dtmf_map = {
            "ek": "1", "do": "2", "teen": "3", "char": "4", "paanch": "5",
            "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
            "press 1": "1", "press 2": "2", "press 3": "3",
            "option 1": "1", "option 2": "2", "option 3": "3",
        }
        text_lower = text.lower()
        for phrase, digit in dtmf_map.items():
            if phrase in text_lower:
                return digit
        return None

    def _is_voicemail_response(self, text: str) -> bool:
        """Check if transcribed text suggests a voicemail system."""
        text_lower = text.lower()
        return any(phrase in text_lower for phrase in self.VOICEMAIL_DETECT_PHRASES)

    async def _handle_voicemail(self) -> None:
        """Handle voicemail detection."""
        logger.info(f"[Pipeline:{self.session_id}] Voicemail detected")
        await self.end_session(outcome="voicemail", status="voicemail")

    # ─────────────────────── Session Lifecycle ───────────────────────────

    async def start_session(self) -> None:
        self.is_running = True
        self.start_time = time.time()
        await self._emit_event({
            "type": PipelineEvent.STATUS,
            "status": "started",
            "session_id": self.session_id,
            "flow_id": self.flow_id,
            "current_node": self.flow_manager.current_node.to_dict(),
        })

    async def end_session(
        self,
        outcome: Optional[str] = None,
        status: str = "completed",
    ) -> None:
        if self.is_ended:
            return

        self.is_ended = True
        self.is_running = False
        self.end_time = time.time()

        duration = int(self.end_time - self.start_time) if self.start_time else 0

        await self._save_session_metrics(duration)
        await self._update_session_status(status, outcome, duration)

        await self._emit_event({
            "type": PipelineEvent.ENDED,
            "session_id": self.session_id,
            "status": status,
            "outcome": outcome,
            "duration_seconds": duration,
            "flow_state": self.flow_manager.get_state(),
        })

    async def check_idle(self) -> None:
        """
        Called periodically to detect customer silence.
        Emits idle prompt or ends call.
        """
        if self.is_ended:
            return

        idle_seconds = time.time() - self.last_customer_speech_time
        if idle_seconds > self.IDLE_SILENCE_SECONDS:
            if self.idle_prompt_count < self.MAX_IDLE_PROMPTS:
                self.idle_prompt_count += 1
                idle_prompt = (
                    "Kya aap abhi bhi line pe hain? Mujhe aapki awaaz nahi aa rahi. "
                    "Kya aap kuch bol sakte hain?"
                )
                # Synthesize idle prompt audio
                try:
                    audio = await self._synthesize_speech(idle_prompt)
                    await self._emit_transcript("agent", idle_prompt, 0)
                    await self._save_transcript("agent", idle_prompt)
                    await self._queue_audio(audio)
                except Exception as e:
                    logger.error(f"Idle TTS error: {e}")
            else:
                await self.end_session(outcome="no_answer", status="no_answer")

    # ─────────────────────── Database Operations ─────────────────────────

    async def _save_transcript(self, speaker: str, text: str) -> None:
        """Persist a transcript line to the database."""
        if not self._has_db_record:
            self.turn_index += 1
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
        self.turn_index += 1
        try:
            await self.db.flush()
        except Exception as e:
            logger.error(f"[Pipeline] Transcript save error: {e}")

    async def _save_session_metrics(self, duration_seconds: int) -> None:
        """Save aggregated metrics for the session."""
        if not self._has_db_record:
            return
        from app.models import SessionMetrics

        avg_stt = sum(self.stt_latencies) / len(self.stt_latencies) if self.stt_latencies else None
        avg_llm = sum(self.llm_latencies) / len(self.llm_latencies) if self.llm_latencies else None
        avg_tts = sum(self.tts_latencies) / len(self.tts_latencies) if self.tts_latencies else None

        total_latency = None
        if avg_stt and avg_llm and avg_tts:
            total_latency = avg_stt + avg_llm + avg_tts

        # Estimate cost: Groq LLaMA pricing ~$0.0009/1K input, $0.0009/1K output
        cost_usd = None
        if self.total_tokens_input or self.total_tokens_output:
            cost_usd = Decimal(str(
                (self.total_tokens_input / 1000 * 0.0009) +
                (self.total_tokens_output / 1000 * 0.0009)
            ))

        metrics = SessionMetrics(
            id=str(uuid.uuid4()),
            session_id=self.session_id,
            stt_latency_ms=avg_stt,
            llm_latency_ms=avg_llm,
            tts_latency_ms=avg_tts,
            total_latency_ms=total_latency,
            tokens_input=self.total_tokens_input or None,
            tokens_output=self.total_tokens_output or None,
            cost_usd=cost_usd,
            audio_duration_ms=float(duration_seconds * 1000) if duration_seconds else None,
        )
        self.db.add(metrics)
        try:
            await self.db.flush()
        except Exception as e:
            logger.error(f"[Pipeline] Metrics save error: {e}")

    async def _update_session_status(
        self,
        status: str,
        outcome: Optional[str],
        duration: int,
    ) -> None:
        """Update the CallSession record with final status."""
        if not self._has_db_record:
            return
        from app.models import CallSession
        from sqlalchemy import select

        result = await self.db.execute(
            select(CallSession).where(CallSession.id == self.session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = status
            session.outcome = outcome
            session.duration_seconds = duration
            session.end_time = datetime.now(timezone.utc)
            try:
                await self.db.flush()
            except Exception as e:
                logger.error(f"[Pipeline] Session update error: {e}")

    # ─────────────────────── Event Emission ──────────────────────────────

    async def _emit_event(self, event: Dict[str, Any]) -> None:
        try:
            await self.ws_emit(self.session_id, event)
        except Exception as e:
            logger.error(f"[Pipeline] WS emit error: {e}")

    async def _emit_transcript(
        self, speaker: str, text: str, latency_ms: float
    ) -> None:
        await self._emit_event({
            "type": PipelineEvent.TRANSCRIPT,
            "speaker": speaker,
            "text": text,
            "latency_ms": round(latency_ms, 2),
            "turn_index": self.turn_index,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": self.session_id,
        })

    async def _emit_metrics(
        self,
        stt_ms: float,
        llm_ms: float,
        tts_ms: float,
        total_ms: float,
    ) -> None:
        await self._emit_event({
            "type": PipelineEvent.METRICS,
            "stt_latency_ms": round(stt_ms, 2),
            "llm_latency_ms": round(llm_ms, 2),
            "tts_latency_ms": round(tts_ms, 2),
            "total_latency_ms": round(total_ms, 2),
            "turn_index": self.turn_index,
            "session_id": self.session_id,
        })

    async def _on_node_change(
        self, session_id: str, event: Dict[str, Any]
    ) -> None:
        await self._emit_event(event)

    async def _emit_error(self, message: str) -> None:
        await self._emit_event({
            "type": PipelineEvent.ERROR,
            "message": message,
            "session_id": self.session_id,
        })

    def get_status(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "is_running": self.is_running,
            "is_ended": self.is_ended,
            "flow_state": self.flow_manager.get_state(),
            "turn_count": self.turn_index,
            "metrics_summary": {
                "avg_stt_ms": round(sum(self.stt_latencies) / len(self.stt_latencies), 2) if self.stt_latencies else None,
                "avg_llm_ms": round(sum(self.llm_latencies) / len(self.llm_latencies), 2) if self.llm_latencies else None,
                "avg_tts_ms": round(sum(self.tts_latencies) / len(self.tts_latencies), 2) if self.tts_latencies else None,
            },
        }
