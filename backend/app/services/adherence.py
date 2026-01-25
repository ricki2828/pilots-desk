"""
Adherence Scoring Service
Per-segment scoring of agent performance vs script
"""

import logging
from typing import Dict, Any, List
from app.services.llm_provider import LLMProvider
from app.models.score import AdherenceScore, Nudge

logger = logging.getLogger(__name__)


class AdherenceScorer:
    """Scores agent adherence to script expectations"""

    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider
        self.score_thresholds = {
            "excellent": 0.9,
            "good": 0.75,
            "acceptable": 0.6,
            "poor": 0.4
        }

    async def score_segment(
        self,
        expected_text: str,
        actual_transcript: str,
        node_id: str,
        script_context: str = "",
        client_id: str = "SKY_TV_NZ"
    ) -> tuple[AdherenceScore, List[Nudge]]:
        """
        Score a single segment and generate nudges if needed

        Returns:
            (AdherenceScore, List[Nudge])
        """
        logger.info(f"Scoring segment for node {node_id}")

        # Get LLM score
        llm_result = await self.llm.score_adherence(
            expected_text=expected_text,
            actual_transcript=actual_transcript,
            script_context=script_context,
            client_id=client_id
        )

        # Build adherence score object
        adherence = AdherenceScore(
            score=llm_result["score"],
            explanation=llm_result["explanation"],
            key_points_covered=llm_result.get("key_points_covered", []),
            key_points_missed=llm_result.get("key_points_missed", []),
            recommendations=llm_result.get("recommendations", [])
        )

        # Generate nudges based on score
        nudges = await self._generate_nudges(
            adherence=adherence,
            node_id=node_id,
            llm_result=llm_result
        )

        return adherence, nudges

    async def _generate_nudges(
        self,
        adherence: AdherenceScore,
        node_id: str,
        llm_result: Dict[str, Any]
    ) -> List[Nudge]:
        """Generate coaching nudges based on adherence score"""
        nudges = []

        # Low adherence - generate nudge
        if adherence.score < self.score_thresholds["acceptable"]:
            severity = "critical" if adherence.score < self.score_thresholds["poor"] else "warning"

            nudge_message = await self.llm.generate_nudge(
                node_id=node_id,
                issue_type="low_adherence",
                context={
                    "score": adherence.score,
                    "missed_points": adherence.key_points_missed,
                    "recommendations": adherence.recommendations
                }
            )

            nudges.append(Nudge(
                nudge_type="adherence",
                severity=severity,
                message=nudge_message,
                node_id=node_id
            ))

        # Missing critical keywords
        if adherence.key_points_missed:
            for missed_point in adherence.key_points_missed[:2]:  # Limit to 2
                nudges.append(Nudge(
                    nudge_type="keyword",
                    severity="info",
                    message=f"Remember to mention: {missed_point}",
                    node_id=node_id
                ))

        return nudges

    def calculate_call_score(self, segment_scores: List[float]) -> Dict[str, Any]:
        """Calculate overall call score from segment scores"""
        if not segment_scores:
            return {
                "overall_score": 0.0,
                "rating": "no_data",
                "segments_count": 0
            }

        overall = sum(segment_scores) / len(segment_scores)

        # Determine rating
        if overall >= self.score_thresholds["excellent"]:
            rating = "excellent"
        elif overall >= self.score_thresholds["good"]:
            rating = "good"
        elif overall >= self.score_thresholds["acceptable"]:
            rating = "acceptable"
        else:
            rating = "needs_improvement"

        return {
            "overall_score": overall,
            "rating": rating,
            "segments_count": len(segment_scores),
            "min_score": min(segment_scores),
            "max_score": max(segment_scores)
        }
