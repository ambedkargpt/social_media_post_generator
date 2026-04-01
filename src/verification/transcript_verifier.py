"""
Transcript Quality Verification Module

Analyzes transcript text for quality signals without modifying content.
Produces structured verification reports for audit and filtering.
"""

from __future__ import annotations

import re
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class VerificationReport:
    """Structured transcript quality report."""
    video_id: str
    language: str
    summary: dict
    stats: dict
    punctuation: dict
    spelling: dict
    structural_warnings: list[str]


class TranscriptVerifier:
    """Analyzes transcripts for quality without modification."""
    
    # Thresholds
    PUNCTUATION_THRESHOLD = 0.05  # Min punctuation density
    SPELLING_ERROR_THRESHOLD = 0.15  # Max error rate for PASS
    
    # Status thresholds
    PASS_THRESHOLD = 0.75  # Score >= 0.75 → PASS
    REVIEW_THRESHOLD = 0.55  # Score 0.55-0.74 → REVIEW, < 0.55 → FAIL
    
    # Language detection ranges
    HINDI_UNICODE_RANGE = (0x0900, 0x097F)
    DEVANAGARI_RANGE = (0x0900, 0x094F)
    
    def __init__(self):
        """Initialize verifier (spell checker lazy-loaded on demand)."""
        self.spell_checker = None
        self._spell_checker_loaded = False
    
    def verify(self, text: str, video_id: str = "") -> VerificationReport:
        """
        Verify transcript quality.
        
        Args:
            text: Transcript text (unchanged)
            video_id: Optional video ID for reporting
            
        Returns:
            VerificationReport with quality signals
        """
        if not text or not text.strip():
            return self._blank_report(video_id, status="FAIL", reason="Empty transcript")
        
        # Detect language
        language = self._detect_language(text)
        
        # Run all checks
        stats = self._compute_stats(text)
        punctuation = self._analyze_punctuation(text, stats)
        spelling = self._analyze_spelling(text, language)
        warnings = self._detect_structural_issues(text, stats)
        
        # Compute score
        score, status = self._compute_score(punctuation, spelling, warnings, language)
        
        return VerificationReport(
            video_id=video_id,
            language=language,
            summary={
                "status": status,
                "score": round(score, 3),
                "notes": f"Quality signal for {language} transcript"
            },
            stats=stats,
            punctuation=punctuation,
            spelling=spelling,
            structural_warnings=warnings,
        )
    
    def _blank_report(self, video_id: str, status: str = "FAIL", reason: str = "") -> VerificationReport:
        """Return a blank FAIL report."""
        return VerificationReport(
            video_id=video_id,
            language="unknown",
            summary={
                "status": status,
                "score": 0.0,
                "notes": reason
            },
            stats={
                "chars": 0,
                "words": 0,
                "sentences": 0,
                "avg_sentence_length": 0.0,
            },
            punctuation={
                "total": 0,
                "density": 0.0,
                "breakdown": {},
                "issues": ["Empty or invalid transcript"]
            },
            spelling={
                "estimated_error_rate": 0.0,
                "examples": [],
            },
            structural_warnings=[],
        )
    
    def _detect_language(self, text: str) -> str:
        """Detect language (Hindi vs English vs Mixed)."""
        hindi_chars = sum(1 for c in text if self.HINDI_UNICODE_RANGE[0] <= ord(c) <= self.HINDI_UNICODE_RANGE[1])
        latin_chars = sum(1 for c in text if ord(c) < 256)
        total_chars = len(text)
        
        hindi_ratio = hindi_chars / total_chars if total_chars > 0 else 0
        latin_ratio = latin_chars / total_chars if total_chars > 0 else 0
        
        if hindi_ratio > 0.5:
            return "hi"
        elif latin_ratio > 0.5:
            return "en"
        else:
            return "mixed"
    
    def _compute_stats(self, text: str) -> dict:
        """Compute basic transcript statistics."""
        chars = len(text)
        words = len(text.split())
        
        # Heuristic: sentences end with . ! ? followed by space or end
        sentences = len(re.findall(r'[.!?]+(?:\s|$)', text))
        sentences = max(sentences, 1)  # At least 1 sentence
        
        avg_sentence_length = words / sentences if sentences > 0 else 0
        
        return {
            "chars": chars,
            "words": words,
            "sentences": sentences,
            "avg_sentence_length": round(avg_sentence_length, 2),
        }
    
    def _analyze_punctuation(self, text: str, stats: dict) -> dict:
        """Analyze punctuation usage and density."""
        punct_chars = {'.', ',', '?', '!', ';', ':'}
        punct_counts = {c: text.count(c) for c in punct_chars}
        total_punct = sum(punct_counts.values())
        
        word_count = stats["words"]
        density = total_punct / word_count if word_count > 0 else 0
        
        issues = []
        if density < self.PUNCTUATION_THRESHOLD:
            issues.append(f"Low punctuation density ({density:.3f} < {self.PUNCTUATION_THRESHOLD})")
        
        return {
            "total": total_punct,
            "density": round(density, 4),
            "breakdown": {c: punct_counts[c] for c in punct_chars if punct_counts[c] > 0},
            "issues": issues,
        }
    
    def _analyze_spelling(self, text: str, language: str) -> dict:
        """Analyze spelling quality (language-aware)."""
        if language == "hi":
            return self._analyze_spelling_hindi(text)
        elif language == "en":
            return self._analyze_spelling_english(text)
        else:
            # Mixed or unknown: lightweight check
            return self._analyze_spelling_mixed(text)
    
    def _analyze_spelling_english(self, text: str) -> dict:
        """English spelling check using spell checker or heuristics."""
        words = text.lower().split()
        words = [w.strip('.,!?;:()[]{}') for w in words if w.strip()]
        
        examples = []
        error_count = 0
        method = "heuristic"
        
        # Try lazy-load spell checker
        spell_checker = self._get_spell_checker()
        
        if spell_checker:
            try:
                # Use spell checker for first 1000 words to avoid slowdown
                sample_words = words[:1000]
                misspelled = spell_checker.unknown(sample_words)
                error_count = len(misspelled)
                examples = list(misspelled)[:10]
                
                # Estimate for full text
                if len(words) > 1000:
                    error_count = int(error_count * len(words) / 1000)
                
                method = "spellchecker"
            except Exception:
                # Fall back to heuristic on any error
                spell_checker = None
        
        if not spell_checker:
            # Fallback: simple heuristic (words with repeated chars or unusual patterns)
            for word in words:
                if len(word) > 2:
                    # Repeated chars (e.g., "thhis")
                    if re.search(r'(.)\1{2,}', word):
                        error_count += 1
                        examples.append(word)
                    # Very short words shouldn't have many vowels
                    elif len(word) < 4 and word.count('e') > 2:
                        error_count += 1
                        examples.append(word)
            examples = examples[:10]
        
        error_rate = error_count / len(words) if words else 0
        
        return {
            "estimated_error_rate": round(error_rate, 4),
            "examples": examples,
            "method": method,
        }
    
    def _get_spell_checker(self):
        """Lazy-load spell checker on first use."""
        if self._spell_checker_loaded:
            return self.spell_checker
        
        self._spell_checker_loaded = True
        try:
            from spellchecker import SpellChecker
            self.spell_checker = SpellChecker()
            return self.spell_checker
        except ImportError:
            # pyspellchecker not installed; use heuristics instead
            return None
    
    def _analyze_spelling_hindi(self, text: str) -> dict:
        """Hindi spelling check (pattern-based, no dictionary)."""
        words = text.split()
        examples = []
        error_count = 0
        
        for word in words:
            issues = []
            
            # Repeated characters (likely OCR/ASR errors)
            if re.search(r'([ा-ु])\1{2,}', word):  # Repeated diacritics
                issues.append("repeated_vowel")
                error_count += 1
            
            # Broken words: sudden Latin chars in Hindi text
            if re.search(r'[a-zA-Z]{3,}', word):  # 3+ Latin chars in Hindi word
                issues.append("latin_intrusion")
                error_count += 1
            
            # Excessive diacritics (malformed)
            if len(re.findall(r'[ा-ु]', word)) > len(word) / 2:
                issues.append("excessive_diacritics")
                error_count += 1
            
            if issues:
                examples.append({"word": word, "issues": issues})
        
        examples = examples[:10]
        error_rate = error_count / len(words) if words else 0
        
        return {
            "estimated_error_rate": round(error_rate, 4),
            "examples": examples,
            "method": "pattern_detection",
        }
    
    def _analyze_spelling_mixed(self, text: str) -> dict:
        """Mixed language spelling check (lightweight)."""
        words = text.split()
        
        # Simple heuristic: detect unusual patterns
        examples = []
        error_count = 0
        
        for word in words:
            if re.search(r'(.)\1{3,}', word):  # 3+ repeated chars
                examples.append(word)
                error_count += 1
        
        examples = examples[:10]
        error_rate = error_count / len(words) if words else 0
        
        return {
            "estimated_error_rate": round(error_rate, 4),
            "examples": examples,
            "method": "pattern_detection",
        }
    
    def _detect_structural_issues(self, text: str, stats: dict) -> list[str]:
        """Detect structural red flags."""
        warnings = []
        
        sentences = stats["sentences"]
        avg_len = stats["avg_sentence_length"]
        words = stats["words"]
        
        # Red flag: very long average sentence (sign of missing punctuation)
        if avg_len > 50:
            warnings.append(f"Very long sentences (avg {avg_len:.0f} words)")
        
        # Red flag: no sentence boundaries
        if sentences == 1 and words > 100:
            warnings.append("No sentence boundaries detected in long transcript")
        
        # Red flag: repeated phrases (copy-paste or loop artifacts)
        lines = text.split('\n')
        if len(lines) > 1:
            repeated = sum(1 for i in range(len(lines)-1) if lines[i] == lines[i+1])
            if repeated > len(lines) * 0.1:
                warnings.append("Repeated lines detected (possible artifact)")
        
        # Red flag: excessive lowercase starts (sentence corruption)
        sentences_found = re.findall(r'[.!?]\s+\w', text)
        if sentences_found:
            lowercase_starts = sum(1 for s in sentences_found if s[-1].islower())
            if lowercase_starts > len(sentences_found) * 0.5:
                warnings.append("Many sentences start with lowercase (punctuation misalignment)")
        
        return warnings
    
    def _compute_score(self, punctuation: dict, spelling: dict, warnings: list, language: str) -> tuple[float, str]:
        """
        Compute quality score (0-1) and status.
        
        Returns:
            (score, status)
        """
        score = 1.0
        
        # Deduct for low punctuation
        if "issues" in punctuation and punctuation["issues"]:
            score -= 0.15
        
        # Deduct for spelling errors
        error_rate = spelling.get("estimated_error_rate", 0.0)
        if error_rate > 0.20:
            score -= 0.30
        elif error_rate > self.SPELLING_ERROR_THRESHOLD:
            score -= 0.15
        
        # Deduct for structural warnings
        warning_count = len(warnings)
        if warning_count >= 3:
            score -= 0.20
        elif warning_count >= 2:
            score -= 0.10
        elif warning_count >= 1:
            score -= 0.05
        
        score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
        
        # Determine status
        if score >= self.PASS_THRESHOLD:
            status = "PASS"
        elif score >= self.REVIEW_THRESHOLD:
            status = "REVIEW"
        else:
            status = "FAIL"
        
        return score, status


def save_verification_report(report: VerificationReport, output_path: Path) -> None:
    """Save verification report as JSON."""
    report_dict = asdict(report)
    output_path.write_text(
        json.dumps(report_dict, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
