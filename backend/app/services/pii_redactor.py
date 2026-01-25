"""
PII Redaction Service
Redacts sensitive personal information from transcripts before logging/storage
"""

import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class PIIRedactor:
    """Redacts PII from transcripts using regex patterns"""

    def __init__(self):
        # Credit card patterns (Visa, MC, Amex, Discover)
        self.patterns = {
            "credit_card": [
                r'\b(?:4[0-9]{12}(?:[0-9]{3})?)\b',  # Visa
                r'\b(?:5[1-5][0-9]{14})\b',          # Mastercard
                r'\b(?:3[47][0-9]{13})\b',           # Amex
                r'\b(?:6(?:011|5[0-9]{2})[0-9]{12})\b',  # Discover
                r'\b(?:[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4})\b'  # Generic card format
            ],
            "cvv": [
                r'\bCVV:?\s*[0-9]{3,4}\b',
                r'\bCVV2:?\s*[0-9]{3,4}\b',
                r'\bsecurity\s+code:?\s*[0-9]{3,4}\b'
            ],
            "phone_nz": [
                r'\b(?:0[2-9])\s*[0-9]{3}\s*[0-9]{4}\b',  # NZ landline
                r'\b(?:02[0-9])\s*[0-9]{3}\s*[0-9]{4}\b',  # NZ mobile
                r'\b\+64\s*[2-9]\s*[0-9]{3}\s*[0-9]{4}\b'  # NZ international
            ],
            "phone_za": [
                r'\b(?:0[1-9][0-9])\s*[0-9]{3}\s*[0-9]{4}\b',  # SA landline
                r'\b(?:0[6-8][0-9])\s*[0-9]{3}\s*[0-9]{4}\b',  # SA mobile
                r'\b\+27\s*[1-9][0-9]\s*[0-9]{3}\s*[0-9]{4}\b'  # SA international
            ],
            "email": [
                r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            ],
            "address_nz": [
                r'\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln)\b',
                r'\b(?:Auckland|Wellington|Christchurch|Hamilton|Tauranga|Dunedin)\s+\d{4}\b'
            ],
            "ird_nz": [  # NZ IRD number
                r'\b\d{2,3}[-\s]?\d{3}[-\s]?\d{3}\b'
            ],
            "sin_canada": [  # Canadian SIN
                r'\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b'
            ],
            "dob": [
                r'\b(?:0[1-9]|[12][0-9]|3[01])[-/](?:0[1-9]|1[012])[-/](?:19|20)\d{2}\b',
                r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b'
            ],
            "bank_account_nz": [
                r'\b\d{2}[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d{2,3}\b'  # NZ bank account format
            ]
        }

        # Replacement tokens
        self.replacements = {
            "credit_card": "[CARD]",
            "cvv": "[CVV]",
            "phone_nz": "[PHONE_NZ]",
            "phone_za": "[PHONE_SA]",
            "email": "[EMAIL]",
            "address_nz": "[ADDRESS]",
            "ird_nz": "[IRD]",
            "sin_canada": "[SIN]",
            "dob": "[DOB]",
            "bank_account_nz": "[ACCOUNT]"
        }

        logger.info("PIIRedactor initialized with patterns for NZ, SA, and Canadian PII")

    def redact(self, text: str) -> tuple[str, Dict[str, int]]:
        """
        Redact all PII from text

        Returns:
            (redacted_text, redaction_counts)
        """
        if not text:
            return text, {}

        redacted = text
        counts = {}

        for pii_type, patterns in self.patterns.items():
            replacement = self.replacements[pii_type]
            type_count = 0

            for pattern in patterns:
                matches = re.findall(pattern, redacted, re.IGNORECASE)
                if matches:
                    type_count += len(matches)
                    redacted = re.sub(pattern, replacement, redacted, flags=re.IGNORECASE)

            if type_count > 0:
                counts[pii_type] = type_count

        if counts:
            logger.info(f"Redacted PII: {counts}")

        return redacted, counts

    def has_pii(self, text: str) -> bool:
        """Quick check if text contains any PII"""
        for patterns in self.patterns.values():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return True
        return False

    def redact_specific(self, text: str, pii_types: List[str]) -> str:
        """Redact only specific PII types"""
        redacted = text

        for pii_type in pii_types:
            if pii_type not in self.patterns:
                continue

            replacement = self.replacements[pii_type]
            for pattern in self.patterns[pii_type]:
                redacted = re.sub(pattern, replacement, redacted, flags=re.IGNORECASE)

        return redacted
