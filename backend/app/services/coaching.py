"""
Coaching Engine Service
Loads the coaching framework config and manages:
- Nudge prioritization and cooldowns
- Agent profile-based adjustments
- Post-call coaching insights
"""

import json
import logging
import os
import random
import time
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

FRAMEWORK_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "scripts", "coaching_framework.json"
)


class CoachingEngine:
    """Manages coaching nudges using the framework configuration"""

    def __init__(self, framework_path: str = FRAMEWORK_PATH):
        self.framework: Dict[str, Any] = {}
        self.categories: Dict[str, Dict[str, Any]] = {}
        self.global_rules: Dict[str, Any] = {}
        self.display_config: Dict[str, Any] = {}
        self.insights_config: Dict[str, Any] = {}

        # Per-agent cooldown tracking: {agent_id: {category_id: last_nudge_timestamp}}
        self._cooldowns: Dict[str, Dict[str, float]] = {}
        # Per-agent nudge counts: {agent_id: {minute_bucket: count}}
        self._nudge_counts: Dict[str, Dict[int, int]] = {}

        self._load_framework(framework_path)

    def _load_framework(self, path: str):
        """Load coaching framework from JSON file"""
        try:
            with open(path, "r") as f:
                self.framework = json.load(f)

            self.global_rules = self.framework.get("global_rules", {})
            self.display_config = self.framework.get("display_configuration", {})
            self.insights_config = self.framework.get("coaching_insights", {})

            # Index categories by ID for fast lookup
            for cat in self.framework.get("nudge_categories", []):
                self.categories[cat["id"]] = cat

            logger.info(
                f"Coaching framework loaded: {len(self.categories)} categories, "
                f"version {self.framework.get('version', 'unknown')}"
            )
        except FileNotFoundError:
            logger.warning(f"Coaching framework not found at {path} — using defaults")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid coaching framework JSON: {e}")

    def get_category(self, category_id: str) -> Optional[Dict[str, Any]]:
        """Get a nudge category config by ID"""
        return self.categories.get(category_id)

    def get_enabled_categories(self) -> List[Dict[str, Any]]:
        """Get all enabled nudge categories"""
        return [c for c in self.categories.values() if c.get("enabled", True)]

    def get_priority_order(self) -> List[str]:
        """Get nudge priority order (highest first)"""
        return self.global_rules.get("priority_order", list(self.categories.keys()))

    def get_agent_profile(self, tenure_days: int) -> Dict[str, Any]:
        """Determine agent profile based on tenure"""
        profiles = self.global_rules.get("agent_profile_adjustments", {})

        if tenure_days <= profiles.get("new_agent", {}).get("tenure_days_max", 14):
            return {"tier": "new_agent", **profiles.get("new_agent", {})}
        elif tenure_days <= profiles.get("developing", {}).get("tenure_days_max", 56):
            return {"tier": "developing", **profiles.get("developing", {})}
        else:
            return {"tier": "experienced", **profiles.get("experienced", {})}

    def check_cooldown(self, agent_id: str, category_id: str) -> bool:
        """Check if a nudge category is on cooldown for an agent. Returns True if OK to send."""
        cat = self.categories.get(category_id)
        if not cat:
            return True

        cooldown_seconds = cat.get("cooldown_seconds", 60)
        if cooldown_seconds == 0:
            return True  # No cooldown (e.g. compliance)

        agent_cooldowns = self._cooldowns.get(agent_id, {})
        last_sent = agent_cooldowns.get(category_id, 0)

        return (time.time() - last_sent) >= cooldown_seconds

    def record_nudge(self, agent_id: str, category_id: str):
        """Record that a nudge was sent (for cooldown tracking)"""
        if agent_id not in self._cooldowns:
            self._cooldowns[agent_id] = {}
        self._cooldowns[agent_id][category_id] = time.time()

        # Track per-minute count
        minute_bucket = int(time.time() / 60)
        if agent_id not in self._nudge_counts:
            self._nudge_counts[agent_id] = {}
        self._nudge_counts[agent_id][minute_bucket] = (
            self._nudge_counts[agent_id].get(minute_bucket, 0) + 1
        )

    def check_rate_limit(self, agent_id: str, tenure_days: int = 30) -> bool:
        """Check if agent has hit their nudge-per-minute limit. Returns True if OK to send."""
        profile = self.get_agent_profile(tenure_days)
        max_per_minute = profile.get(
            "max_nudges_per_minute",
            self.global_rules.get("max_nudges_per_minute", 3)
        )

        minute_bucket = int(time.time() / 60)
        agent_counts = self._nudge_counts.get(agent_id, {})
        current_count = agent_counts.get(minute_bucket, 0)

        return current_count < max_per_minute

    def select_message(self, category_id: str, severity: str, context: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Select a nudge message from the framework templates.

        Returns dict with message, display_style, color, duration, etc.
        """
        cat = self.categories.get(category_id)
        if not cat:
            return None

        severity_config = cat.get("severity_levels", {}).get(severity)
        if not severity_config:
            return None

        templates = severity_config.get("message_templates", [])
        if not templates:
            return None

        # Pick a random template
        message = random.choice(templates)

        # Substitute template variables if context provided
        if context:
            for key, value in context.items():
                message = message.replace(f"{{{{{key}}}}}", str(value))

        display_style = cat.get("display_style", "toast")
        display_config = self.display_config.get(display_style, {})

        return {
            "message": message,
            "category": category_id,
            "severity": severity,
            "display_style": display_style,
            "color": severity_config.get("color", "#3B82F6"),
            "display_duration_seconds": severity_config.get("display_duration_seconds", 8),
            "dismissible": display_config.get("dismissible", True),
            "requires_acknowledgment": severity_config.get("requires_acknowledgment", False),
            "position": display_config.get("position", "top-right"),
            "animation": display_config.get("animation", "slide-in"),
            "block_progression": severity_config.get("block_progression", False),
        }

    def prioritize_nudges(self, pending_nudges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Given a list of pending nudges, return them sorted by priority
        and limited by max_concurrent_nudges.
        """
        priority_order = self.get_priority_order()
        max_concurrent = self.global_rules.get("max_concurrent_nudges", 1)

        def sort_key(nudge):
            cat_id = nudge.get("category", "")
            try:
                return priority_order.index(cat_id)
            except ValueError:
                return len(priority_order)

        sorted_nudges = sorted(pending_nudges, key=sort_key)
        return sorted_nudges[:max_concurrent]

    def determine_severity(self, category_id: str, score: float) -> str:
        """Determine severity level based on score and category thresholds"""
        cat = self.categories.get(category_id)
        if not cat:
            return "info"

        severity_levels = cat.get("severity_levels", {})

        # Check from most severe to least
        for severity in ["critical", "warning", "info"]:
            level = severity_levels.get(severity)
            if not level:
                continue

            score_range = level.get("score_range")
            if score_range and score_range[0] <= score <= score_range[1]:
                return severity

        return "info"

    def get_post_call_config(self) -> Dict[str, Any]:
        """Get post-call summary configuration"""
        return self.insights_config.get("post_call_summary", {})

    def get_session_stats_config(self) -> Dict[str, Any]:
        """Get session stats configuration"""
        return self.insights_config.get("session_stats", {})

    def clear_agent_state(self, agent_id: str):
        """Clear cooldown/rate limit state for an agent (e.g. new call)"""
        self._cooldowns.pop(agent_id, None)
        self._nudge_counts.pop(agent_id, None)

    def to_client_config(self) -> Dict[str, Any]:
        """Return framework config suitable for sending to the desktop client"""
        return {
            "version": self.framework.get("version"),
            "categories": [
                {
                    "id": cat["id"],
                    "name": cat["name"],
                    "enabled": cat.get("enabled", True),
                    "positive": cat.get("positive", False),
                    "display_style": cat.get("display_style", "toast"),
                }
                for cat in self.categories.values()
            ],
            "display_configuration": self.display_config,
            "global_rules": {
                "max_nudges_per_minute": self.global_rules.get("max_nudges_per_minute", 3),
                "max_concurrent_nudges": self.global_rules.get("max_concurrent_nudges", 1),
                "priority_order": self.get_priority_order(),
            },
        }
