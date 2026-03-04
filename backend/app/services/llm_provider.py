"""
LLM Provider Abstraction Layer
Uses LiteLLM for provider-agnostic LLM calls (Claude, GPT, etc.)
"""

import os
import time
import logging
from typing import Dict, Any, Optional
from litellm import completion, acompletion
import json
import re

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    if not text:
        raise ValueError("Empty response from LLM")
    text = text.strip()
    # Strip markdown code fences
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


class LLMProvider:
    """Provider-agnostic LLM interface using LiteLLM"""

    def __init__(self):
        self.default_model = os.getenv("LLM_MODEL", "claude-3-5-haiku-20241022")
        self.analysis_model = os.getenv("ANALYSIS_MODEL", "anthropic/claude-sonnet-4-5-20250929")
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.3"))
        self.max_tokens = int(os.getenv("LLM_MAX_TOKENS", "1024"))

        # Set API keys from environment
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

        if not self.anthropic_api_key and not self.openai_api_key:
            logger.warning("No LLM API keys configured - scoring will fail")

        logger.info(f"LLM Provider initialized with model: {self.default_model}")
        logger.info(f"Analysis model: {self.analysis_model}")

    async def score_adherence(
        self,
        expected_text: str,
        actual_transcript: str,
        script_context: str = "",
        client_id: str = "SKY_TV_NZ"
    ) -> Dict[str, Any]:
        """
        Score adherence of actual transcript vs expected script

        Returns:
            {
                "score": 0.0-1.0,
                "explanation": str,
                "key_points_covered": [str],
                "key_points_missed": [str],
                "recommendations": [str]
            }
        """
        prompt = self._build_adherence_prompt(
            expected_text,
            actual_transcript,
            script_context,
            client_id
        )

        start_time = time.time()

        try:
            response = await acompletion(
                model=self.default_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert sales coach analyzing call adherence for BPO agents."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                # JSON format requested in prompt — no response_format needed for Claude
            )

            processing_time = (time.time() - start_time) * 1000

            content = response.choices[0].message.content
            result = _extract_json(content)

            logger.info(f"Adherence scored in {processing_time:.0f}ms: {result.get('score', 0):.2f}")

            return {
                **result,
                "processing_time_ms": processing_time,
                "model_used": response.model
            }

        except Exception as e:
            logger.error(f"LLM adherence scoring failed: {e}")
            # Return default score on error
            return {
                "score": 0.5,
                "explanation": "Scoring service temporarily unavailable",
                "key_points_covered": [],
                "key_points_missed": [],
                "recommendations": [],
                "processing_time_ms": (time.time() - start_time) * 1000,
                "model_used": "error"
            }

    async def check_compliance(
        self,
        node_id: str,
        expected_text: str,
        actual_transcript: str,
        verbatim_threshold: float = 0.95,
        compliance_type: str = "disclosure"
    ) -> Dict[str, Any]:
        """
        Check compliance for nodes requiring verbatim matching

        Returns:
            {
                "is_compliant": bool,
                "violation_type": str or None,
                "severity": "low"|"medium"|"high"|"critical",
                "message": str or None,
                "actual_match_score": float
            }
        """
        prompt = self._build_compliance_prompt(
            node_id,
            expected_text,
            actual_transcript,
            verbatim_threshold,
            compliance_type
        )

        start_time = time.time()

        try:
            response = await acompletion(
                model=self.default_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a compliance officer analyzing call recordings for legal adherence."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Lower temperature for compliance (more deterministic)
                max_tokens=512,
                # JSON format requested in prompt — no response_format needed for Claude
            )

            content = response.choices[0].message.content
            result = _extract_json(content)

            processing_time = (time.time() - start_time) * 1000

            if not result.get("is_compliant"):
                logger.warning(f"Compliance violation detected: {result.get('violation_type')}")

            return {
                **result,
                "processing_time_ms": processing_time,
                "model_used": response.model
            }

        except Exception as e:
            logger.error(f"LLM compliance check failed: {e}")
            # Return cautious default (assume non-compliant on error)
            return {
                "is_compliant": False,
                "violation_type": "service_error",
                "severity": "medium",
                "message": "Compliance check service temporarily unavailable - manual review required",
                "actual_match_score": 0.0,
                "processing_time_ms": (time.time() - start_time) * 1000,
                "model_used": "error"
            }

    def _build_adherence_prompt(
        self,
        expected_text: str,
        actual_transcript: str,
        script_context: str,
        client_id: str
    ) -> str:
        """Build prompt for adherence scoring"""
        return f"""Analyze this sales agent's adherence to the script.

Client: {client_id}
Context: {script_context if script_context else "Sky TV NZ sales call"}

EXPECTED SCRIPT:
{expected_text}

ACTUAL AGENT TRANSCRIPT:
{actual_transcript}

Rate adherence from 0.0 (completely off-script) to 1.0 (perfect adherence).

Guidelines:
- Focus on KEY POINTS covered, not exact wording
- Paraphrasing is acceptable if meaning preserved
- Tone and professionalism matter
- Missing critical information lowers score
- Extra helpful information is fine (doesn't lower score)
- South African agent speaking to NZ customer (accent differences expected)

Return JSON:
{{
  "score": <float 0.0-1.0>,
  "explanation": "<brief explanation>",
  "key_points_covered": ["point1", "point2"],
  "key_points_missed": ["point3"],
  "recommendations": ["suggestion1", "suggestion2"]
}}"""

    def _build_compliance_prompt(
        self,
        node_id: str,
        expected_text: str,
        actual_transcript: str,
        verbatim_threshold: float,
        compliance_type: str
    ) -> str:
        """Build prompt for compliance checking"""
        return f"""Check if this agent statement meets compliance requirements.

Node ID: {node_id}
Compliance Type: {compliance_type}
Verbatim Match Required: {verbatim_threshold * 100:.0f}%

REQUIRED TEXT (must be said):
{expected_text}

ACTUAL AGENT TRANSCRIPT:
{actual_transcript}

Compliance rules:
- Legal disclosures MUST be verbatim or near-verbatim
- Recording consent MUST include key phrases
- Parental controls MUST mention age restrictions
- Minor variations in phrasing acceptable if meaning identical
- Accent differences (SA agent) should not affect compliance

Return JSON:
{{
  "is_compliant": <bool>,
  "violation_type": "<type or null>",
  "severity": "low|medium|high|critical",
  "message": "<explanation or null>",
  "actual_match_score": <float 0.0-1.0>
}}

Severity levels:
- low: Minor phrasing difference, meaning intact
- medium: Missing non-critical phrase
- high: Missing critical information
- critical: Legal requirement completely omitted"""

    async def analyze_full_call(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> Dict[str, Any]:
        """
        Run full-call analysis using the analysis model (Sonnet 4.5).
        Returns parsed JSON analysis dict with token usage metadata.
        """
        start_time = time.time()

        try:
            response = await acompletion(
                model=self.analysis_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.5,
                max_tokens=4096,
            )

            processing_time = (time.time() - start_time) * 1000
            content = response.choices[0].message.content
            result = _extract_json(content)

            # Attach token usage metadata
            usage = response.usage
            result["_meta"] = {
                "model_used": response.model,
                "input_tokens": usage.prompt_tokens if usage else 0,
                "output_tokens": usage.completion_tokens if usage else 0,
                "processing_time_ms": processing_time,
            }

            logger.info(
                f"Full-call analysis complete in {processing_time:.0f}ms, "
                f"model={response.model}, "
                f"tokens={usage.prompt_tokens if usage else 0}+{usage.completion_tokens if usage else 0}"
            )

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse analysis JSON: {e}")
            raise ValueError(f"LLM returned invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Full-call analysis failed: {e}")
            raise

    async def generate_nudge(
        self,
        node_id: str,
        issue_type: str,
        context: Dict[str, Any]
    ) -> str:
        """Generate a coaching nudge message"""
        prompt = f"""Generate a brief, actionable coaching tip for a sales agent.

Issue Type: {issue_type}
Script Node: {node_id}
Context: {json.dumps(context, indent=2)}

Generate a SHORT (1 sentence, max 15 words) coaching nudge that:
- Is constructive and encouraging
- Provides specific action to take
- Is appropriate for real-time display during call
- Doesn't distract from the conversation

Return ONLY the nudge text, no JSON."""

        try:
            response = await acompletion(
                model=self.default_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a supportive sales coach providing real-time tips."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=100
            )

            nudge_text = response.choices[0].message.content.strip()
            return nudge_text

        except Exception as e:
            logger.error(f"Failed to generate nudge: {e}")
            return "Stay focused on key talking points"
