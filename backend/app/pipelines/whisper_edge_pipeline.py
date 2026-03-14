"""
WhisperEdgePipeline: Voice pipeline using Groq Whisper STT, Groq LLaMA LLM,
and Microsoft Edge TTS (free, high-quality Hindi voices).

Architecture:
- STT: Groq Whisper Large V3 Turbo (fast, multilingual)
- LLM: Groq llama-3.3-70b-versatile
- TTS: edge-tts with hi-IN-SwaraNeural voice
- Transport: WebRTC (same as Sarvam pipeline)
"""
import asyncio
import io
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import httpx
from groq import AsyncGroq
from openai import AsyncOpenAI

from app.config import settings
from app.pipelines.base_pipeline import BasePipeline

logger = logging.getLogger(__name__)

# Edge TTS voice mapping by language preference
EDGE_TTS_VOICE_MAP = {
    "hi": "hi-IN-SwaraNeural",      # Natural Hindi female voice
    "hi-male": "hi-IN-MadhurNeural",  # Natural Hindi male voice
    "en": "en-IN-NeerjaNeural",     # Indian English female
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural",
    "bn": "bn-IN-TanishaaNeural",
}


class WhisperEdgePipeline(BasePipeline):
    """
    Production pipeline using free/cheap services:
    Groq Whisper STT → Groq LLaMA 70B → Edge TTS
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Groq client for Whisper STT
        self._groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        # Groq LLM client (OpenAI-compatible)
        self._llm_client = AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
        )

        # WebRTC state
        self._peer_connection = None
        self._audio_track = None
        self._pending_audio_chunks: asyncio.Queue = asyncio.Queue()
        self._response_audio_queue: asyncio.Queue = asyncio.Queue()
        self._is_agent_speaking = False
        self._vad_energy_threshold = 0.02

    # ─────────────────────── STT: Groq Whisper ───────────────────────────

    async def _transcribe_audio(self, audio_bytes: bytes, language: str = "hi") -> str:
        """
        Transcribe audio using Groq Whisper Large V3 Turbo.
        Optimized for speed with multilingual support.
        """
        # Wrap bytes in a file-like object with a filename (required by Groq)
        audio_file = ("audio.wav", io.BytesIO(audio_bytes), "audio/wav")

        try:
            response = await self._groq_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                language=language,  # Hint for faster transcription
                response_format="json",
                temperature=0.0,  # Deterministic for accuracy
            )
            transcript = response.text or ""
            logger.debug(f"[Whisper STT] '{transcript[:60]}...'")
            return transcript

        except Exception as e:
            logger.error(f"[Whisper STT] Error: {e}")
            raise

    # ─────────────────────── LLM: Groq LLaMA ────────────────────────────

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
    ) -> Dict[str, Any]:
        """
        Call Groq LLaMA 3.3 70B. Same as Sarvam pipeline.
        """
        start = time.time()

        full_messages = [{"role": "system", "content": system_prompt}] + messages[-10:]

        response = await self._llm_client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            messages=full_messages,
            temperature=0.7,
            max_tokens=150,
            top_p=0.9,
        )

        latency_ms = (time.time() - start) * 1000
        choice = response.choices[0]
        text = choice.message.content or ""

        return {
            "text": text.strip(),
            "tokens_input": response.usage.prompt_tokens if response.usage else 0,
            "tokens_output": response.usage.completion_tokens if response.usage else 0,
            "latency_ms": latency_ms,
        }

    # ─────────────────────── TTS: Edge TTS ───────────────────────────────

    async def _synthesize_speech(self, text: str, language: str = "hi") -> bytes:
        """
        Synthesize speech using Microsoft Edge TTS via edge-tts library.
        Free, high-quality Indian language voices.
        Returns MP3 audio bytes.
        """
        try:
            import edge_tts  # type: ignore
        except ImportError:
            logger.error("edge-tts not installed. Run: pip install edge-tts")
            raise RuntimeError("edge-tts library not available")

        # Select appropriate voice
        voice = EDGE_TTS_VOICE_MAP.get(language, "hi-IN-SwaraNeural")

        # Override based on agent config
        if self.agent_config.get("voice"):
            voice = self.agent_config["voice"]

        # Truncate for reasonable response length
        text_to_speak = text[:500]

        try:
            communicate = edge_tts.Communicate(
                text=text_to_speak,
                voice=voice,
                rate="+10%",    # Slightly faster for professional tone
                volume="+0%",
                pitch="+0Hz",
            )

            audio_buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])

            audio_bytes = audio_buffer.getvalue()
            logger.debug(f"[Edge TTS] Generated {len(audio_bytes)} bytes with voice {voice}")
            return audio_bytes

        except Exception as e:
            logger.error(f"[Edge TTS] Error with voice {voice}: {e}")
            # Fallback to a different voice
            try:
                communicate = edge_tts.Communicate(
                    text=text_to_speak,
                    voice="en-IN-NeerjaNeural",
                )
                audio_buffer = io.BytesIO()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_buffer.write(chunk["data"])
                return audio_buffer.getvalue()
            except Exception as fallback_e:
                logger.error(f"[Edge TTS] Fallback also failed: {fallback_e}")
                raise RuntimeError(f"Edge TTS synthesis failed: {e}")

    # ─────────────────────── WebRTC Transport ────────────────────────────

    async def run(self, offer_sdp: str) -> str:
        """Initialize WebRTC and return SDP answer."""
        try:
            from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
        except ImportError:
            logger.warning("aiortc not installed, using mock SDP")
            return await self._mock_run()

        ice_server_objects = [RTCIceServer(urls="stun:stun.l.google.com:19302")]
        if settings.TURN_URL:
            turn_urls = [u.strip() for u in settings.TURN_URL.split(",") if u.strip()]
            ice_server_objects.append(RTCIceServer(
                urls=turn_urls,
                username=settings.TURN_USERNAME or None,
                credential=settings.TURN_CREDENTIAL or None,
            ))
        pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=ice_server_objects))
        self._peer_connection = pc

        @pc.on("track")
        async def on_track(track):
            if track.kind == "audio":
                self._audio_track = track
                asyncio.ensure_future(self._audio_receive_loop(track))

        @pc.on("connectionstatechange")
        async def on_connection_state_change():
            logger.info(f"[WhisperEdge:{self.session_id}] State: {pc.connectionState}")
            if pc.connectionState in ("failed", "closed", "disconnected"):
                await self.end_session(status="failed")

        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer_sdp, type="offer")
        )

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await self.start_session()

        return pc.localDescription.sdp

    async def _mock_run(self) -> str:
        await self.start_session()
        return "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"

    async def _audio_receive_loop(self, track) -> None:
        """Receive audio frames and process through pipeline."""
        audio_buffer = bytearray()
        SAMPLE_RATE = 16000
        CHUNK_DURATION_MS = 500
        CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)
        CHUNK_BYTES = CHUNK_SAMPLES * 2

        try:
            while self.is_running and not self.is_ended:
                try:
                    frame = await asyncio.wait_for(track.recv(), timeout=1.0)
                    pcm_data = bytes(frame.planes[0])
                    audio_buffer.extend(pcm_data)

                    while len(audio_buffer) >= CHUNK_BYTES:
                        chunk = bytes(audio_buffer[:CHUNK_BYTES])
                        audio_buffer = audio_buffer[CHUNK_BYTES:]

                        if self._has_speech(chunk) and not self._is_agent_speaking:
                            response_audio = await self.process_turn(chunk)
                            if response_audio:
                                await self._response_audio_queue.put(response_audio)

                except asyncio.TimeoutError:
                    await self.check_idle()
                except Exception as e:
                    if not self.is_ended:
                        logger.error(f"[WhisperEdge] Audio error: {e}")

        except Exception as e:
            logger.error(f"[WhisperEdge] Receive loop fatal: {e}")
            await self.end_session(status="failed")

    def _has_speech(self, audio_bytes: bytes) -> bool:
        """Energy-based VAD."""
        if len(audio_bytes) < 2:
            return False
        import struct
        samples = struct.unpack(f"{len(audio_bytes)//2}h", audio_bytes)
        rms = (sum(s * s for s in samples) / len(samples)) ** 0.5
        return rms > (32767 * self._vad_energy_threshold)

    def _build_ice_config(self) -> list:
        servers = [{"urls": "stun:stun.l.google.com:19302"}]
        if settings.TURN_URL:
            servers.append({
                "urls": settings.TURN_URL,
                "username": settings.TURN_USERNAME,
                "credential": settings.TURN_CREDENTIAL,
            })
        return servers

    async def process_sdp_offer(self, offer_sdp: str) -> str:
        return await self.run(offer_sdp)

    async def process_ice_candidate(self, candidate: str, sdp_mid: str, sdp_mline_index: int) -> None:
        if self._peer_connection:
            try:
                from aiortc import RTCIceCandidate
                ice = RTCIceCandidate(
                    component=1,
                    foundation="foundation",
                    ip="",
                    port=0,
                    priority=0,
                    protocol="udp",
                    type="host",
                    sdpMid=sdp_mid,
                    sdpMLineIndex=sdp_mline_index,
                )
                await self._peer_connection.addIceCandidate(ice)
            except Exception as e:
                logger.error(f"[WhisperEdge] ICE error: {e}")

    async def cleanup(self) -> None:
        """Release resources."""
        await self._groq_client.close()
        if self._peer_connection:
            await self._peer_connection.close()
