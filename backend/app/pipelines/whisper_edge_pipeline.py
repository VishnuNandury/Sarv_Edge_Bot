"""
WhisperEdgePipeline: Voice pipeline using Groq Whisper STT, Groq LLaMA LLM,
and Sarvam bulbul:v3 TTS.

Architecture:
- STT: Groq Whisper Large V3 Turbo (fast, multilingual)
- LLM: Groq llama-3.3-70b-versatile
- TTS: Sarvam bulbul:v3 REST API  (Edge TTS removed: Microsoft blocks cloud IPs → 403)
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

# Sarvam bulbul:v3 voice + language mapping (replaces Edge TTS — cloud-safe)
SARVAM_LANG_MAP = {
    "hi": "hi-IN",
    "en": "en-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "bn": "bn-IN",
    "pa": "pa-IN",
}
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"


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

    # ─────────────────────── TTS: Sarvam bulbul:v3 ───────────────────────

    async def _synthesize_speech(self, text: str, language: str = "hi") -> bytes:
        """
        Synthesize speech using Sarvam bulbul:v3 REST API.
        Edge TTS was removed: Microsoft blocks cloud/datacenter IPs with 403.
        Sarvam REST API is reliable from any host.
        Returns WAV audio bytes (decoded from base64 response).
        """
        import base64

        lang_code = SARVAM_LANG_MAP.get(language, "hi-IN")
        # Use voice from agent_config if set, otherwise default by gender hint
        voice = self.agent_config.get("voice", "priya")

        payload = {
            "inputs": [text[:500]],
            "target_language_code": lang_code,
            "speaker": voice,
            "model": "bulbul:v3",
            "speech_sample_rate": 16000,
            "enable_preprocessing": True,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                SARVAM_TTS_URL,
                json=payload,
                headers={"api-subscription-key": settings.SARVAM_API_KEY},
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Sarvam TTS error {response.status_code}: {response.text[:200]}"
            )

        data = response.json()
        audios = data.get("audios", [])
        if not audios:
            raise RuntimeError("Sarvam TTS returned empty audios list")

        audio_bytes = base64.b64decode(audios[0])
        logger.debug(f"[Sarvam TTS] {len(audio_bytes)} bytes, voice={voice}, lang={lang_code}")
        return audio_bytes

    # ─────────────────────── WebRTC Transport ────────────────────────────

    async def run(self, offer_sdp: str) -> str:
        """Initialize WebRTC and return SDP answer."""
        try:
            from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
        except ImportError:
            logger.warning("aiortc not installed, using mock SDP")
            return await self._mock_run()

        from app.pipelines.sarvam_pipeline import _build_rtc_ice_servers
        ice_server_objects = _build_rtc_ice_servers(RTCIceServer)
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
        asyncio.ensure_future(self._send_greeting())

        return pc.localDescription.sdp

    async def _queue_audio(self, audio_bytes: bytes) -> None:
        """Split TTS WAV/PCM audio into per-frame chunks for AudioOutputTrack."""
        import io, wave
        FRAME_SAMPLES = 320
        FRAME_BYTES = FRAME_SAMPLES * 2  # 16-bit mono

        if audio_bytes[:4] == b"RIFF":
            try:
                with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                    raw_pcm = wf.readframes(wf.getnframes())
            except Exception:
                raw_pcm = audio_bytes[44:]
        else:
            raw_pcm = audio_bytes

        for i in range(0, len(raw_pcm), FRAME_BYTES):
            chunk = raw_pcm[i : i + FRAME_BYTES]
            if chunk:
                await self._response_audio_queue.put(chunk)

    async def _send_greeting(self) -> None:
        language = self.customer_context.get("preferred_language", "hi")
        name = self.customer_context.get("name", "")
        greeting = (
            f"Namaste {name}ji. Main Priya bol rahi hoon, aapke loan account ke baare "
            f"mein baat karni thi. Kya aap abhi baat kar sakte hain?"
        )
        try:
            self._is_agent_speaking = True
            audio = await self._synthesize_speech(greeting, language)
            await self._emit_transcript("agent", greeting, 0)
            await self._save_transcript("agent", greeting)
            await self._response_audio_queue.put(audio)
        except Exception as e:
            logger.error(f"[WhisperEdge] Greeting error: {e}")
        finally:
            self._is_agent_speaking = False

    async def _mock_run(self) -> str:
        await self.start_session()
        return "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"

    async def _audio_receive_loop(self, track) -> None:
        """Receive audio frames and process through pipeline."""
        import av
        audio_buffer = bytearray()
        TARGET_RATE = 16000
        CHUNK_BYTES = int(TARGET_RATE * 500 / 1000) * 2  # 500ms at 16kHz, 16-bit mono
        resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_RATE)

        try:
            while self.is_running and not self.is_ended:
                try:
                    frame = await asyncio.wait_for(track.recv(), timeout=1.0)
                    for resampled in resampler.resample(frame):
                        pcm_data = bytes(resampled.planes[0])
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
