"""
Adherence Scoring Service
Per-segment scoring of agent performance vs script
Uses coaching framework for intelligent nudge generation
"""

import logging
from typing import Dict, Any, List, Optional
from app.services.llm_provider import LLMProvider
from app.services.coaching import CoachingEngine
from app.models.score import AdherenceScore, Nudge

logger = logging.getLogger(__name__)


class AdherenceScorer:
    """Scores agent adherence to script expectations"""

    def __init__(self, llm_provider: LLMProvider, coaching_engine: Optional[CoachingEngine] = None):
        self.llm = llm_provider
        self.coaching = coaching_engine
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
        client_id: str = "SKY_TV_NZ",
        agent_id: str = None,
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

        # Generate nudges based on score (using coaching framework if available)
        nudges = await self._generate_nudges(
            adherence=adherence,
            node_id=node_id,
            llm_result=llm_result,
            agent_id=agent_id,
        )

        return adherence, nudges

    async def _generate_nudges(
        self,
        adherence: AdherenceScore,
        node_id: str,
        llm_result: Dict[str, Any],
        agent_id: str = None,
    ) -> List[Nudge]:
        """Generate coaching nudges using the coaching framework"""
        nudges = []

        # --- Adherence nudges ---
        if adherence.score < self.score_thresholds["acceptable"]:
            nudge = self._framework_nudge(
                agent_id=agent_id,
                category_id="adherence",
                score=adherence.score,
                node_id=node_id,
                context={"score": adherence.score},
            )
            if nudge:
                nudges.append(nudge)
            else:
                # Fallback: generate via LLM
                severity = "critical" if adherence.score < self.score_thresholds["poor"] else "warning"
                nudge_message = await self.llm.generate_nudge(
                    node_id=node_id,
                    issue_type="low_adherence",
                    context={
                        "score": adherence.score,
                        "missed_points": adherence.key_points_missed,
                        "recommendations": adherence.recommendations,
                    },
                )
                nudges.append(Nudge(
                    nudge_type="adherence",
                    severity=severity,
                    message=nudge_message,
                    node_id=node_id,
                ))

        # --- Positive reinforcement ---
        elif adherence.score >= self.score_thresholds["excellent"]:
            nudge = self._framework_nudge(
                agent_id=agent_id,
                category_id="positive",
                score=adherence.score,
                node_id=node_id,
            )
            if nudge:
                nudges.append(nudge)

        # --- Keyword miss nudges ---
        if adherence.key_points_missed:
            missed = adherence.key_points_missed
            nudge = self._framework_nudge(
                agent_id=agent_id,
                category_id="keyword_miss",
                score=1.0 - (len(missed) / max(len(missed) + len(adherence.key_points_covered), 1)),
                node_id=node_id,
                context={
                    "keyword": missed[0] if len(missed) == 1 else ", ".join(missed[:3]),
                    "keywords": ", ".join(missed[:3]),
                },
            )
            if nudge:
                nudges.append(nudge)
            else:
                # Fallback
                for missed_point in missed[:2]:
                    nudges.append(Nudge(
                        nudge_type="keyword_miss",
                        severity="info",
                        message=f"Remember to mention: {missed_point}",
                        node_id=node_id,
                    ))

        # Prioritize through coaching engine
        if self.coaching and len(nudges) > 1:
            nudge_dicts = [{"category": n.nudge_type, **n.model_dump()} for n in nudges]
            prioritized = self.coaching.prioritize_nudges(nudge_dicts)
            # Rebuild nudge list from prioritized
            prioritized_types = {p["category"] for p in prioritized}
            nudges = [n for n in nudges if n.nudge_type in prioritized_types]

        return nudges

    def _framework_nudge(
        self,
        agent_id: str,
        category_id: str,
        score: float,
        node_id: str,
        context: Dict[str, Any] = None,
    ) -> Optional[Nudge]:
        """Try to generate a nudge from the coaching framework. Returns None if unavailable or on cooldown."""
        if not self.coaching:
            return None

        # Check cooldown
        if agent_id and not self.coaching.check_cooldown(agent_id, category_id):
            return None

        # Check rate limit
        if agent_id and not self.coaching.check_rate_limit(agent_id):
            return None

        # Determine severity from framework
        severity = self.coaching.determine_severity(category_id, score)

        # Get message from framework templates
        nudge_data = self.coaching.select_message(category_id, severity, context)
        if not nudge_data:
            return None

        # Record for cooldown tracking
        if agent_id:
            self.coaching.record_nudge(agent_id, category_id)

        return Nudge(
            nudge_type=category_id,
            severity=severity,
            message=nudge_data["message"],
            node_id=node_id,
            display_style=nudge_data.get("display_style", "toast"),
            color=nudge_data.get("color", "#3B82F6"),
            display_duration_seconds=nudge_data.get("display_duration_seconds", 8),
            requires_acknowledgment=nudge_data.get("requires_acknowledgment", False),
        )

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
