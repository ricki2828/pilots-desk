"""
Post-Call Analyzer Service
Full-call analysis using Claude Sonnet 4.5 for coaching report generation
"""

import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM_PROMPT = """You are an expert BPO sales coach and quality analyst. You analyze full call transcripts \
to produce detailed coaching reports for sales agents.

Your analysis must be thorough, actionable, and constructive. Focus on both strengths and improvement areas. \
Score fairly — most competent agents should score 0.6-0.8, with 0.9+ reserved for truly excellent calls \
and below 0.4 only for serious issues."""

ANALYSIS_USER_PROMPT_TEMPLATE = """Analyze this sales call transcript and produce a coaching report.

## CALL TRANSCRIPT
{transcript}

## SPEAKER SEGMENTS
{speaker_segments}

## EXPECTED SCRIPT FLOW
{script_schema}

{agent_history_section}

{benchmarks_section}

## ANALYSIS REQUIREMENTS

Produce a JSON report with ALL of the following fields:

1. **overall_score** (float 0.0-1.0): Holistic call quality score
2. **rating** (string): One of: "excellent" (>=0.9), "good" (>=0.75), "acceptable" (>=0.6), "needs_improvement" (>=0.4), "poor" (<0.4)
3. **compliance_pass** (boolean): Whether all required disclosures and legal statements were made
4. **compliance_issues** (array of strings): List of specific compliance failures, empty if none
5. **strengths** (array of strings): 3-5 specific things the agent did well
6. **improvement_areas** (array of strings): 2-4 specific, actionable improvement suggestions
7. **node_breakdown** (object): For each script node, provide {{node_id: {{"score": float, "notes": "string"}}}}
8. **talk_listen_ratio** (float): Ratio of agent talk time to total call time (0.0-1.0). Good range: 0.4-0.6
9. **objection_handling** (object): {{"objections_faced": int, "objections_resolved": int, "techniques_used": ["string"], "effectiveness": float}}
10. **close_attempts** (object): {{"attempts": int, "techniques": ["string"], "successful": boolean, "notes": "string"}}
11. **key_moments** (array of objects): [{{"timestamp": "start-end", "type": "positive|negative|critical", "description": "string"}}]
12. **coaching_summary** (string): 3-4 sentence prose summary suitable for a coaching conversation. Be constructive and specific.

## SCORING GUIDELINES
- Adherence to script flow and key points: 30% weight
- Compliance with required disclosures: 20% weight
- Communication skills (tone, clarity, rapport): 20% weight
- Objection handling and closing ability: 15% weight
- Call control and efficiency: 15% weight

Return ONLY valid JSON, no markdown fences or extra text."""


class PostCallAnalyzer:
    """Analyzes full call transcripts to produce coaching reports."""

    def __init__(self, llm_provider):
        self.llm = llm_provider

    async def analyze_call(
        self,
        transcript: str,
        speaker_segments: List[Dict[str, Any]],
        script_schema: Dict[str, Any],
        agent_history: Optional[Dict[str, Any]] = None,
        team_benchmarks: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Single-pass analysis of full call transcript.

        Args:
            transcript: Full PII-redacted transcript text
            speaker_segments: List of speaker segment dicts
            script_schema: Expected script flow/schema
            agent_history: Previous performance context for the agent
            team_benchmarks: Team average metrics for percentile context

        Returns:
            CoachingReport-compatible dict with all analysis fields
        """
        # Format speaker segments for the prompt
        segments_text = self._format_segments(speaker_segments)

        # Build optional context sections
        agent_history_section = ""
        if agent_history:
            agent_history_section = f"""## AGENT HISTORY CONTEXT
Recent average score: {agent_history.get('avg_score', 'N/A')}
Total calls analyzed: {agent_history.get('total_calls', 'N/A')}
Common strengths: {', '.join(agent_history.get('strengths', []))}
Common improvement areas: {', '.join(agent_history.get('improvement_areas', []))}
Trend: {agent_history.get('trend', 'N/A')}"""

        benchmarks_section = ""
        if team_benchmarks:
            benchmarks_section = f"""## TEAM BENCHMARKS (for percentile context)
Team average score: {team_benchmarks.get('avg_score', 'N/A')}
Top performer average: {team_benchmarks.get('top_score', 'N/A')}
Team compliance rate: {team_benchmarks.get('compliance_rate', 'N/A')}"""

        prompt = ANALYSIS_USER_PROMPT_TEMPLATE.format(
            transcript=transcript,
            speaker_segments=segments_text,
            script_schema=json.dumps(script_schema, indent=2) if isinstance(script_schema, dict) else str(script_schema),
            agent_history_section=agent_history_section,
            benchmarks_section=benchmarks_section,
        )

        logger.info("Starting post-call analysis with Sonnet")

        result = await self.llm.analyze_full_call(
            system_prompt=ANALYSIS_SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        # Validate and normalize the result
        return self._validate_result(result)

    def _format_segments(self, segments: List[Dict[str, Any]]) -> str:
        """Format speaker segments into readable text for the prompt."""
        if not segments:
            return "(No speaker segments available)"

        lines = []
        for seg in segments:
            speaker = seg.get("speaker", "unknown").upper()
            start = seg.get("start", 0.0)
            end = seg.get("end", 0.0)
            text = seg.get("text", "")
            lines.append(f"[{start:.1f}s - {end:.1f}s] {speaker}: {text}")
        return "\n".join(lines)

    def _validate_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize the analysis result."""
        # Ensure overall_score is within range
        score = float(result.get("overall_score", 0.5))
        score = max(0.0, min(1.0, score))
        result["overall_score"] = score

        # Ensure rating matches score
        valid_ratings = {"excellent", "good", "acceptable", "needs_improvement", "poor"}
        if result.get("rating") not in valid_ratings:
            if score >= 0.9:
                result["rating"] = "excellent"
            elif score >= 0.75:
                result["rating"] = "good"
            elif score >= 0.6:
                result["rating"] = "acceptable"
            elif score >= 0.4:
                result["rating"] = "needs_improvement"
            else:
                result["rating"] = "poor"

        # Ensure boolean compliance_pass
        result["compliance_pass"] = bool(result.get("compliance_pass", True))

        # Ensure list fields are lists
        for field in ["compliance_issues", "strengths", "improvement_areas", "key_moments"]:
            if not isinstance(result.get(field), list):
                result[field] = []

        # Ensure dict fields are dicts
        for field in ["node_breakdown", "objection_handling", "close_attempts"]:
            if not isinstance(result.get(field), dict):
                result[field] = {}

        # Ensure talk_listen_ratio is a float
        result["talk_listen_ratio"] = float(result.get("talk_listen_ratio", 0.5))

        # Ensure coaching_summary exists
        if not result.get("coaching_summary"):
            result["coaching_summary"] = "Analysis complete. Review the detailed breakdown for coaching points."

        return result
