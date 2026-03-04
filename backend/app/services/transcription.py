"""
Transcription Service
Deepgram Nova-2 integration for call audio transcription with speaker diarization
"""

import os
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Transcribes call audio files using Deepgram Nova-2"""

    def __init__(self):
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key or api_key == "placeholder_set_me":
            logger.warning("DEEPGRAM_API_KEY not configured - transcription will fail")
            self.client = None
        else:
            from deepgram import DeepgramClient
            self.client = DeepgramClient(api_key)

    async def transcribe_file(self, audio_path: str) -> Dict[str, Any]:
        """
        Transcribe audio file with speaker diarization.

        Args:
            audio_path: Path to the audio file on disk

        Returns:
            {
                "transcript": str,
                "speaker_segments": [{speaker, text, start, end, confidence}],
                "word_count": int,
                "confidence": float,
                "duration": float
            }
        """
        if not self.client:
            raise RuntimeError("Deepgram client not initialized - check DEEPGRAM_API_KEY")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        from deepgram import PrerecordedOptions

        logger.info(f"Starting transcription: {audio_path}")

        with open(audio_path, "rb") as f:
            source = {"buffer": f.read()}

        options = PrerecordedOptions(
            model="nova-2",
            diarize=True,
            smart_format=True,
            punctuate=True,
            language="en",
        )

        response = await self.client.listen.asyncrest.v("1").transcribe_file(source, options)
        return self._parse_response(response)

    def _parse_response(self, response) -> Dict[str, Any]:
        """Parse Deepgram response into structured format."""
        result = response.results
        channels = result.channels

        if not channels or not channels[0].alternatives:
            return {
                "transcript": "",
                "speaker_segments": [],
                "word_count": 0,
                "confidence": 0.0,
                "duration": 0.0,
            }

        best_alt = channels[0].alternatives[0]
        transcript = best_alt.transcript or ""
        confidence = best_alt.confidence or 0.0
        words = best_alt.words or []

        # Build speaker segments from word-level data
        speaker_segments = self._build_speaker_segments(words)

        # Duration from metadata
        duration = result.metadata.duration if hasattr(result, "metadata") and result.metadata else 0.0

        word_count = len(transcript.split()) if transcript else 0

        logger.info(
            f"Transcription complete: {word_count} words, "
            f"{len(speaker_segments)} segments, confidence={confidence:.2f}"
        )

        return {
            "transcript": transcript,
            "speaker_segments": speaker_segments,
            "word_count": word_count,
            "confidence": confidence,
            "duration": duration,
        }

    def _build_speaker_segments(self, words: list) -> List[Dict[str, Any]]:
        """
        Group consecutive words by speaker into segments.
        Maps speaker 0 -> 'agent', speaker 1 -> 'customer'.
        """
        if not words:
            return []

        segments = []
        current_speaker = None
        current_words = []
        segment_start = 0.0
        segment_end = 0.0
        confidence_sum = 0.0

        for word in words:
            speaker = getattr(word, "speaker", 0)
            word_text = getattr(word, "punctuated_word", None) or getattr(word, "word", "")
            start = getattr(word, "start", 0.0)
            end = getattr(word, "end", 0.0)
            word_confidence = getattr(word, "confidence", 0.0)

            if speaker != current_speaker and current_words:
                # Flush current segment
                label = "agent" if current_speaker == 0 else "customer"
                segments.append({
                    "speaker": label,
                    "text": " ".join(current_words),
                    "start": segment_start,
                    "end": segment_end,
                    "confidence": confidence_sum / len(current_words) if current_words else 0.0,
                })
                current_words = []
                confidence_sum = 0.0
                segment_start = start

            if not current_words:
                segment_start = start

            current_speaker = speaker
            current_words.append(word_text)
            segment_end = end
            confidence_sum += word_confidence

        # Flush final segment
        if current_words:
            label = "agent" if current_speaker == 0 else "customer"
            segments.append({
                "speaker": label,
                "text": " ".join(current_words),
                "start": segment_start,
                "end": segment_end,
                "confidence": confidence_sum / len(current_words) if current_words else 0.0,
            })

        return segments
