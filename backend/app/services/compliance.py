"""
Compliance Detection Service
Detects compliance violations for regulated disclosures
"""

import logging
from typing import Optional, Dict, Any
from app.services.llm_provider import LLMProvider
from app.models.score import ComplianceCheck, Nudge

logger = logging.getLogger(__name__)


class ComplianceDetector:
    """Detects compliance violations in sales calls"""

    def __init__(self, llm_provider: LLMProvider):
        self.llm = llm_provider

        # Compliance node types and their requirements
        self.compliance_rules = {
            "recording_consent": {
                "verbatim_threshold": 0.90,
                "required_phrases": ["recording", "recorded"],
                "severity": "critical",
                "message": "Must disclose call recording"
            },
            "parental_controls": {
                "verbatim_threshold": 0.85,
                "required_phrases": ["parental", "control", "age"],
                "severity": "high",
                "message": "Must mention parental controls for content"
            },
            "price_disclosure": {
                "verbatim_threshold": 0.80,
                "required_phrases": ["price", "cost", "monthly"],
                "severity": "medium",
                "message": "Must clearly state pricing"
            },
            "cancellation_policy": {
                "verbatim_threshold": 0.85,
                "required_phrases": ["cancel", "notice", "commitment"],
                "severity": "medium",
                "message": "Must explain cancellation terms"
            }
        }

    async def check_compliance(
        self,
        node_id: str,
        expected_text: str,
        actual_transcript: str,
        compliance_type: str = "general"
    ) -> tuple[ComplianceCheck, Optional[Nudge]]:
        """
        Check if agent's statement meets compliance requirements

        Returns:
            (ComplianceCheck, Optional[Nudge])
        """
        logger.info(f"Checking compliance for node {node_id}, type: {compliance_type}")

        # Get compliance rules for this type
        rules = self.compliance_rules.get(
            compliance_type,
            {"verbatim_threshold": 0.95, "severity": "high"}
        )

        # Use LLM to check compliance
        llm_result = await self.llm.check_compliance(
            node_id=node_id,
            expected_text=expected_text,
            actual_transcript=actual_transcript,
            verbatim_threshold=rules["verbatim_threshold"],
            compliance_type=compliance_type
        )

        # Build compliance check object
        compliance = ComplianceCheck(
            is_compliant=llm_result["is_compliant"],
            violation_type=llm_result.get("violation_type"),
            severity=llm_result.get("severity", rules.get("severity", "medium")),
            message=llm_result.get("message"),
            required_text=expected_text if not llm_result["is_compliant"] else None,
            actual_match_score=llm_result.get("actual_match_score", 0.0)
        )

        # Generate nudge if non-compliant
        nudge = None
        if not compliance.is_compliant:
            nudge = await self._generate_compliance_nudge(
                compliance=compliance,
                node_id=node_id,
                compliance_type=compliance_type,
                rules=rules
            )

        return compliance, nudge

    async def _generate_compliance_nudge(
        self,
        compliance: ComplianceCheck,
        node_id: str,
        compliance_type: str,
        rules: Dict[str, Any]
    ) -> Nudge:
        """Generate nudge for compliance violation"""

        # Use predefined message if available
        message = rules.get("message") or compliance.message or "Compliance check failed"

        return Nudge(
            nudge_type="compliance",
            severity="critical" if compliance.severity in ["critical", "high"] else "warning",
            message=f"⚠️ COMPLIANCE: {message}",
            node_id=node_id
        )

    def check_keyword_presence(self, transcript: str, required_keywords: list[str]) -> float:
        """
        Simple keyword presence check (fallback for offline mode)

        Returns:
            Match score 0.0-1.0
        """
        transcript_lower = transcript.lower()
        matches = sum(1 for kw in required_keywords if kw.lower() in transcript_lower)
        return matches / len(required_keywords) if required_keywords else 0.0
