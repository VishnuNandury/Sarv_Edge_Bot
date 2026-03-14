"""
SarvamPipeline: Voice pipeline using Sarvam AI for STT/TTS and Groq LLaMA for LLM.

Architecture:
- STT: Sarvam AI speech-to-text API (Indian languages optimized)
- LLM: Groq llama-3.3-70b-versatile via OpenAI-compatible API
- TTS: Sarvam AI text-to-speech API (natural Indian voices)
- Transport: WebRTC (SmallWebRTCTransport via aiortc)
- VAD: Energy-based silence detection
"""
import asyncio
import base64
import io
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import httpx
from openai import AsyncOpenAI

from app.config import settings
from app.pipelines.base_pipeline import BasePipeline

logger = logging.getLogger(__name__)

# Sarvam language code mapping
LANGUAGE_MAP = {
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

# Sarvam TTS voice mapping by language
TTS_VOICE_MAP = {
    "hi-IN": "anushka",
    "en-IN": "vidya",
    "ta-IN": "pavithra",
    "te-IN": "hema",
    "kn-IN": "nisha",
    "ml-IN": "asha",
    "mr-IN": "mohini",
    "gu-IN": "indu",
    "bn-IN": "priyamvada",
    "pa-IN": "arvind",
}


class SarvamPipeline(BasePipeline):
    """
    Full production pipeline:
    Sarvam STT → Groq LLaMA 70B → Sarvam TTS
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Sarvam HTTP client
        self._sarvam_client = httpx.AsyncClient(
            headers={
                "api-subscription-key": settings.SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0, connect=5.0),
        )

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

        # Conversation state
        self._is_agent_speaking = False
        self._vad_energy_threshold = 0.02

    # ─────────────────────── STT: Sarvam AI ──────────────────────────────

    async def _transcribe_audio(self, audio_bytes: bytes, language: str = "hi") -> str:
        """
        Call Sarvam AI STT endpoint.
        POST https://api.sarvam.ai/speech-to-text
        """
        lang_code = LANGUAGE_MAP.get(language, "hi-IN")

        try:
            # Sarvam STT expects multipart/form-data with audio file
            # Re-create client without JSON content-type for this request
            async with httpx.AsyncClient(
                headers={"api-subscription-key": settings.SARVAM_API_KEY},
                timeout=httpx.Timeout(30.0),
            ) as client:
                files = {
                    "file": ("audio.wav", audio_bytes, "audio/wav"),
                }
                data = {
                    "language_code": lang_code,
                    "model": "saarika:v2",
                    "with_timestamps": "false",
                    "with_disfluencies": "false",
                }
                response = await client.post(
                    settings.SARVAM_STT_URL,
                    files=files,
                    data=data,
                )
                response.raise_for_status()
                result = response.json()
                transcript = result.get("transcript", "")
                logger.debug(f"[Sarvam STT] '{transcript[:60]}...'")
                return transcript

        except httpx.HTTPStatusError as e:
            logger.error(f"[Sarvam STT] HTTP error {e.response.status_code}: {e.response.text[:200]}")
            raise RuntimeError(f"Sarvam STT failed: {e.response.status_code}")
        except Exception as e:
            logger.error(f"[Sarvam STT] Error: {e}")
            raise

    # ─────────────────────── LLM: Groq LLaMA ────────────────────────────

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
    ) -> Dict[str, Any]:
        """
        Call Groq LLaMA 3.3 70B via OpenAI-compatible client.
        Returns {text, tokens_input, tokens_output, latency_ms}.
        """
        start = time.time()

        full_messages = [{"role": "system", "content": system_prompt}] + messages[-10:]  # last 10 turns

        response = await self._llm_client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            messages=full_messages,
            temperature=0.7,
            max_tokens=150,  # Keep responses concise for voice
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

    # ─────────────────────── TTS: Sarvam AI ──────────────────────────────

    async def _synthesize_speech(self, text: str, language: str = "hi") -> bytes:
        """
        Call Sarvam AI TTS endpoint.
        POST https://api.sarvam.ai/text-to-speech
        Returns PCM audio bytes.
        """
        lang_code = LANGUAGE_MAP.get(language, "hi-IN")
        voice = TTS_VOICE_MAP.get(lang_code, "anushka")

        payload = {
            "inputs": [text[:500]],  # Sarvam has char limit per request
            "target_language_code": lang_code,
            "speaker": voice,
            "pitch": 0,
            "pace": 1.1,  # Slightly faster for professional tone
            "loudness": 1.5,
            "speech_sample_rate": 16000,
            "enable_preprocessing": True,
            "model": "bulbul:v3",
        }

        try:
            response = await self._sarvam_client.post(
                settings.SARVAM_TTS_URL,
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

            # Sarvam returns base64-encoded audio
            audio_b64 = result.get("audios", [""])[0]
            if audio_b64:
                audio_bytes = base64.b64decode(audio_b64)
                logger.debug(f"[Sarvam TTS] Generated {len(audio_bytes)} bytes")
                return audio_bytes
            else:
                raise RuntimeError("Empty audio response from Sarvam TTS")

        except httpx.HTTPStatusError as e:
            logger.error(f"[Sarvam TTS] HTTP error {e.response.status_code}: {e.response.text[:200]}")
            raise RuntimeError(f"Sarvam TTS failed: {e.response.status_code}")
        except Exception as e:
            logger.error(f"[Sarvam TTS] Error: {e}")
            raise

    # ─────────────────────── WebRTC Transport ────────────────────────────

    async def run(self, offer_sdp: str) -> str:
        """
        Initialize WebRTC peer connection and return SDP answer.
        Sets up audio track handling and starts pipeline loop.
        """
        try:
            from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
            from aiortc.contrib.media import MediaBlackhole
        except ImportError:
            logger.error("aiortc not installed. Using mock SDP answer.")
            return await self._mock_run()

        # Build RTCConfiguration — TURN_URL may be comma-separated (multiple URIs)
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
            logger.info(f"[SarvamPipeline:{self.session_id}] Received track: {track.kind}")
            if track.kind == "audio":
                self._audio_track = track
                asyncio.ensure_future(self._audio_receive_loop(track))

        @pc.on("connectionstatechange")
        async def on_connection_state_change():
            logger.info(f"[SarvamPipeline:{self.session_id}] Connection state: {pc.connectionState}")
            if pc.connectionState in ("failed", "closed", "disconnected"):
                await self.end_session(status="failed")

        # Set remote description (offer)
        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer_sdp, type="offer")
        )

        # Create and add audio output track
        audio_sender = pc.addTrack(AudioOutputTrack(self._response_audio_queue))

        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await self.start_session()
        asyncio.ensure_future(self._send_greeting())

        return pc.localDescription.sdp

    async def _queue_audio(self, audio_bytes: bytes) -> None:
        """Put TTS PCM bytes into the WebRTC output queue."""
        await self._response_audio_queue.put(audio_bytes)

    async def _send_greeting(self) -> None:
        """Synthesize and send the opening greeting after WebRTC connects."""
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
            logger.error(f"[SarvamPipeline] Greeting error: {e}")
        finally:
            self._is_agent_speaking = False

    async def _mock_run(self) -> str:
        """Fallback when aiortc is not available (testing)."""
        await self.start_session()
        return "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"

    async def _audio_receive_loop(self, track) -> None:
        """Continuously receive audio frames from the WebRTC track."""
        import av
        logger.info(f"[SarvamPipeline:{self.session_id}] Starting audio receive loop")
        audio_buffer = bytearray()
        TARGET_RATE = 16000
        CHUNK_DURATION_MS = 500  # Process every 500ms
        CHUNK_BYTES = int(TARGET_RATE * CHUNK_DURATION_MS / 1000) * 2  # 16-bit mono

        # Resampler converts incoming WebRTC audio (48kHz stereo) → 16kHz mono s16
        resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_RATE)

        try:
            while self.is_running and not self.is_ended:
                try:
                    frame = await asyncio.wait_for(track.recv(), timeout=1.0)
                    # Resample to 16kHz mono regardless of incoming format
                    for resampled in resampler.resample(frame):
                        pcm_data = bytes(resampled.planes[0])
                        audio_buffer.extend(pcm_data)

                    # Process in chunks
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
                        logger.error(f"[SarvamPipeline] Audio receive error: {e}")

        except Exception as e:
            logger.error(f"[SarvamPipeline] Receive loop fatal error: {e}")
            await self.end_session(status="failed")

    def _has_speech(self, audio_bytes: bytes) -> bool:
        """Simple energy-based VAD."""
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
        """Process WebRTC SDP offer and return answer."""
        return await self.run(offer_sdp)

    async def process_ice_candidate(self, candidate: str, sdp_mid: str, sdp_mline_index: int) -> None:
        """Add ICE candidate to peer connection."""
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
                logger.error(f"[SarvamPipeline] ICE candidate error: {e}")

    async def cleanup(self) -> None:
        """Clean up resources."""
        await self._sarvam_client.aclose()
        if self._peer_connection:
            await self._peer_connection.close()


try:
    from aiortc.mediastreams import AudioStreamTrack as _AudioStreamTrackBase
except ImportError:
    _AudioStreamTrackBase = object  # type: ignore[assignment,misc]


class AudioOutputTrack(_AudioStreamTrackBase):
    """
    aiortc AudioStreamTrack that streams TTS PCM audio from an asyncio Queue.
    Inherits from AudioStreamTrack (which provides id, readyState, and timing).
    Returns av.AudioFrame with silence when the queue is empty.
    """

    kind = "audio"
    SAMPLE_RATE = 16000
    SAMPLES_PER_FRAME = 320  # 20 ms at 16 kHz

    def __init__(self, queue: asyncio.Queue):
        if _AudioStreamTrackBase is not object:
            super().__init__()
        self._queue = queue
        self._start: Optional[float] = None
        self._pts: int = 0

    async def recv(self):
        import av
        import fractions
        import time
        import numpy as np

        # Maintain a real-time clock so the RTP sender doesn't drift
        if self._start is None:
            self._start = time.time()
        else:
            self._pts += self.SAMPLES_PER_FRAME
            expected = self._start + self._pts / self.SAMPLE_RATE
            wait = expected - time.time()
            if wait > 0:
                await asyncio.sleep(wait)

        try:
            audio_bytes = await asyncio.wait_for(self._queue.get(), timeout=0.005)
            samples = np.frombuffer(audio_bytes, dtype=np.int16)
        except (asyncio.TimeoutError, Exception):
            samples = np.zeros(self.SAMPLES_PER_FRAME, dtype=np.int16)

        if len(samples) < self.SAMPLES_PER_FRAME:
            samples = np.pad(samples, (0, self.SAMPLES_PER_FRAME - len(samples)))
        else:
            samples = samples[: self.SAMPLES_PER_FRAME]

        frame = av.AudioFrame(format="s16", layout="mono", samples=self.SAMPLES_PER_FRAME)
        frame.planes[0].update(samples.astype(np.int16).tobytes())
        frame.pts = self._pts
        frame.sample_rate = self.SAMPLE_RATE
        frame.time_base = fractions.Fraction(1, self.SAMPLE_RATE)
        return frame
