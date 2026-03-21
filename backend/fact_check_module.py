"""
Fact-Check Analysis Module
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Self-contained analysis layer that slots into the existing
VerifyBot platform alongside the ML engine, web search,
and RAG-powered chatbot.

Input  → Detects type automatically:
         SHORT CLAIM | LONG ARTICLE | URL | IMAGE/OCR | CHATBOT

Output → PLAIN TEXT  (for users — short claims, OCR, chatbot)
         JSON        (for the frontend — long articles, URLs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import json
import re
from typing import Optional, Dict, Any, List

from groq import Groq
from langdetect import detect, LangDetectException
from deep_translator import GoogleTranslator
from dotenv import load_dotenv

load_dotenv()

# ── Groq client ───────────────────────────────────────────
_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ─────────────────────────────────────────────────────────
#  SOURCE CREDIBILITY TIERS  (Section J — Live Scraping Source Directory)
# ─────────────────────────────────────────────────────────

# ── TIER 1: Always check for REAL verdict support ────────
_TIER1 = [
    # India National (primary)
    "thehindu.com", "ndtv.com", "timesofindia.indiatimes.com", "timesofindia.com",
    "indianexpress.com", "hindustantimes.com", "indiatoday.in", "aajtak.in",
    "business-standard.com", "businessstandard.com", "livemint.com",
    "economictimes.indiatimes.com", "economictimes.com",
    # Global Tier 1
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "bbc.in",
    "aljazeera.com", "dw.com", "france24.com", "theguardian.com", "npr.org",
    # Government / Official
    "pib.gov.in", "pib.nic.in", "nic.in", "gov.in",
]

# ── TIER 2: Credible secondary / regional (supporting evidence) ──
_TIER2 = [
    # India secondary
    "news18.com", "republicworld.com", "thewire.in", "scroll.in",
    "theprint.in", "thequint.com", "outlookindia.com",
    "zeenews.india.com", "wionews.com", "firstpost.com", "abplive.com",
    # International secondary
    "nytimes.com", "washingtonpost.com", "cnn.com", "abcnews.go.com",
    "cbsnews.com", "nbcnews.com", "foxnews.com",
    "nhk.or.jp", "dawn.com", "thedailystar.net",
    # Sport / Business sub-domains confirmed credible
    "espncricinfo.com", "cricbuzz.com", "skysports.com", "espn.com",
]

# ── TIER 3: State/vernacular papers ──────────────────────
_TIER3 = [
    # Gujarat
    "divyabhaskar.co.in", "sandesh.com", "gujaratsamachar.com",
    # Hindi belt
    "bhaskar.com", "patrika.com", "amarujala.com", "jagran.com",
    "navbharattimes.com",
    # Maharashtra
    "maharashtratimes.com", "loksatta.com", "lokmat.com",
    # West Bengal
    "anandabazar.com",
    # Andhra / Telangana
    "eenadu.net", "sakshi.com",
    # Tamil Nadu
    "dinamalar.com", "dinamani.com",
    # Kerala
    "mathrubhumi.com", "manoramaonline.com",
    # Karnataka
    "deccanherald.com", "vijaykarnataka.com",
    # Punjab / Haryana
    "tribuneindia.com",
    # Assam / Odisha
    "pratidin.in", "sambad.com",
    # Other
    "oneindia.com", "dnaindia.com", "sportskeeda.com",
    "indiatoday.in", "msn.com", "yahoo.com",
    "news.google.com", "wikipedia.org", "en.wikipedia.org",
    "colombogazette.com",
]

# ── FACT-CHECK SITES ──────────────────────────────────────
_FACT_CHECK_SITES = [
    # India
    "altnews.in", "boomlive.in", "vishvasnews.com", "factly.in",
    "newschecker.in", "factcrescendo.com",
    "thequint.com/news/webqoof",
    # Global
    "snopes.com", "politifact.com", "factcheck.org",
    "fullfact.org", "factcheck.afp.com",
]

# ── FAKE / SATIRE DOMAINS ─────────────────────────────────
_FAKE_DOMAINS = [
    "theonion.com", "babylonbee.com", "worldnewsdailyreport.com",
    "nationalreport.net", "empirenews.net", "huzlers.com", "worldnewsera.com",
    "newsbiscuit.com", "dailybuzzlive.com", "thefauxy.com",
]

# ── LANGUAGE → PREFERRED SOURCES (Section J Source Selection Rules) ──
_LANG_SOURCES: dict = {
    # Gujarati → Gujarat state sources first
    "gu": ["divyabhaskar.co.in", "sandesh.com", "gujaratsamachar.com",
            "thehindu.com", "ndtv.com", "newschecker.in", "factcrescendo.com"],
    # Hindi → Hindi national + Hindi belt
    "hi": ["aajtak.in", "ndtv.com", "bhaskar.com", "jagran.com", "amarujala.com",
            "navbharattimes.com", "patrika.com", "vishvasnews.com", "thehindu.com"],
    # Marathi
    "mr": ["maharashtratimes.com", "loksatta.com", "lokmat.com",
            "ndtv.com", "factcrescendo.com"],
    # Bengali
    "bn": ["anandabazar.com", "boomlive.in", "ndtv.com", "thehindu.com"],
    # Telugu
    "te": ["eenadu.net", "sakshi.com", "factly.in", "ndtv.com", "thehindu.com"],
    # Tamil
    "ta": ["dinamalar.com", "dinamani.com", "ndtv.com", "thehindu.com"],
    # Malayalam
    "ml": ["mathrubhumi.com", "manoramaonline.com", "ndtv.com", "thehindu.com"],
    # Kannada
    "kn": ["deccanherald.com", "vijaykarnataka.com", "ndtv.com", "thehindu.com"],
    # Punjabi
    "pa": ["tribuneindia.com", "ndtv.com", "thehindu.com"],
    # English / default
    "en": ["thehindu.com", "ndtv.com", "indianexpress.com", "reuters.com",
            "apnews.com", "bbc.com", "altnews.in", "boomlive.in"],
}

# ── KNOWN RSS FEED ENDPOINTS (Section J §5) ──────────────
_RSS_FEEDS: dict = {
    # India Tier 1
    "thehindu.com":                    "https://www.thehindu.com/feeder/default.rss",
    "ndtv.com":                        "https://feeds.feedburner.com/ndtvnews-top-stories",
    "timesofindia.com":                "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    "indianexpress.com":               "https://indianexpress.com/feed/",
    "hindustantimes.com":              "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    "indiatoday.in":                   "https://www.indiatoday.in/rss/home",
    "aajtak.in":                       "https://aajtak.in/rss/home.xml",
    "business-standard.com":          "https://www.business-standard.com/rss/home_page_top_stories.rss",
    "livemint.com":                    "https://www.livemint.com/rss/news",
    "economictimes.com":               "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    # India Tier 2
    "news18.com":                      "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml",
    "thewire.in":                      "https://thewire.in/feed",
    "scroll.in":                       "https://scroll.in/feed",
    "theprint.in":                     "https://theprint.in/feed",
    "thequint.com":                    "https://www.thequint.com/feed",
    "outlookindia.com":                "https://www.outlookindia.com/rss/main/magazine",
    # Fact-check India
    "altnews.in":                      "https://www.altnews.in/feed/",
    "boomlive.in":                     "https://www.boomlive.in/feed",
    "vishvasnews.com":                 "https://www.vishvasnews.com/feed/",
    "newschecker.in":                  "https://newschecker.in/feed",
    "factcrescendo.com":               "https://www.factcrescendo.com/feed",
    "factly.in":                       "https://factly.in/feed",
    # Fact-check Global
    "snopes.com":                      "https://www.snopes.com/feed/",
    "politifact.com":                  "https://www.politifact.com/rss/rulings/",
    "fullfact.org":                    "https://fullfact.org/feed/",
    # Hindi belt
    "amarujala.com":                   "https://www.amarujala.com/rss/india-news.xml",
    "bhaskar.com":                     "https://www.bhaskar.com/rss-feed/1061/",
    "divyabhaskar.co.in":              "https://www.divyabhaskar.co.in/rss/national.xml",
    # Global Tier 1
    "reuters.com":                     "https://feeds.reuters.com/reuters/topNews",
    "apnews.com":                      "https://rsshub.app/apnews/topics/apf-topnews",
    "bbc.com":                         "https://feeds.bbci.co.uk/news/rss.xml",
    "dw.com":                          "https://rss.dw.com/rdf/rss-en-all",
    "aljazeera.com":                   "https://www.aljazeera.com/xml/rss/all.xml",
    "theguardian.com":                 "https://www.theguardian.com/world/rss",
    "npr.org":                         "https://feeds.npr.org/1001/rss.xml",
    # South Asia
    "dawn.com":                        "https://www.dawn.com/feeds/home",
    "thedailystar.net":                "https://www.thedailystar.net/feed",
}



# ── supported language codes → names ──────────────────────
_LANG_NAMES: Dict[str, str] = {
    "en": "English", "hi": "Hindi", "gu": "Gujarati", "mr": "Marathi",
    "pa": "Punjabi", "bn": "Bengali", "ur": "Urdu", "ta": "Tamil",
    "te": "Telugu", "ml": "Malayalam", "kn": "Kannada", "ar": "Arabic",
    "fr": "French", "es": "Spanish", "pt": "Portuguese", "de": "German",
    "zh-cn": "Chinese", "zh-tw": "Chinese Traditional", "ja": "Japanese",
    "ko": "Korean", "ru": "Russian", "it": "Italian", "tr": "Turkish",
    "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay", "nl": "Dutch",
    "pl": "Polish", "uk": "Ukrainian", "ro": "Romanian", "he": "Hebrew",
    "fa": "Persian", "el": "Greek", "sv": "Swedish", "da": "Danish",
}


# ═════════════════════════════════════════════════════════
#  SECTION 1 — INPUT TYPE DETECTION
# ═════════════════════════════════════════════════════════

def _detect_input_type(text: str, is_ocr: bool = False) -> str:
    """
    Returns one of:
    'url' | 'long_article' | 'short_claim' | 'ocr' | 'chatbot'
    """
    if is_ocr:
        return "ocr"

    stripped = text.strip()

    # URL
    if re.match(r"^https?://", stripped):
        return "url"

    word_count = len(stripped.split())

    # Conversational / chatbot tone
    _conv_markers = [
        "?", "hello", "hi ", "hey ", "how do", "how to", "what is",
        "what are", "can you", "please help", "i want", "help me",
        "thanks", "thank you", "kya", "kaise", "batao", "kyun",
        "shukriya", "namaste",
    ]
    is_conversational = (
        word_count < 30
        and any(m in stripped.lower() for m in _conv_markers)
    )
    if is_conversational:
        return "chatbot"

    if word_count >= 60:
        return "long_article"

    return "short_claim"


def _get_output_mode(input_type: str) -> str:
    """'json'  for long_article / url.  'plain_text' for everything else."""
    return "json" if input_type in ("long_article", "url") else "plain_text"


# ═════════════════════════════════════════════════════════
#  SECTION 2 — MULTILINGUAL HANDLING
# ═════════════════════════════════════════════════════════

def _detect_lang(text: str) -> str:
    """Returns ISO language code. Defaults to 'en' on failure."""
    try:
        if len(text.split()) < 3:
            return "en"
        code = detect(text)
        return code if code in _LANG_NAMES else "en"
    except LangDetectException:
        return "en"


def _to_english(text: str) -> str:
    """Translate to English for internal analysis. Silent on failure."""
    try:
        if len(text.strip()) < 5:
            return text
        result = GoogleTranslator(source="auto", target="en").translate(text[:4500])
        return result if result else text
    except Exception:
        return text


def _from_english(text: str, target_lang: str) -> str:
    """Translate English output back to user's language."""
    if target_lang == "en" or not text:
        return text
    try:
        result = GoogleTranslator(source="en", target=target_lang).translate(text[:4500])
        return result if result else text
    except Exception:
        return text


# ═════════════════════════════════════════════════════════
#  SECTION 3 — SOURCE CREDIBILITY SCORING
# ═════════════════════════════════════════════════════════

def _score_domain(url: str) -> int:
    """Returns 0–100 credibility score for a domain URL."""
    u = url.lower()
    for d in _FAKE_DOMAINS:
        if d in u:
            return 8
    for d in _TIER1:
        if d in u:
            return 92
    for d in _TIER2:
        if d in u:
            return 78
    for d in _TIER3:
        if d in u:
            return 60
    for d in _FACT_CHECK_SITES:
        if d in u:
            return 85
    return 35   # unknown domain


def _score_sources(raw_sources: List[Dict]) -> List[Dict]:
    """Adds `credibility_score` and normalises key names in each source dict."""
    output = []
    for s in raw_sources:
        url  = s.get("url", s.get("href", ""))
        title = s.get("title", "")
        body  = s.get("body", s.get("snippet", ""))
        output.append({
            "title": title,
            "url":   url,
            "body":  body,
            "credibility_score": _score_domain(url),
        })
    return output


# ═════════════════════════════════════════════════════════
#  SECTION 4 — GROQ AI ANALYSIS ENGINE
# ═════════════════════════════════════════════════════════

_GROQ_SYSTEM = """You are a strict, expert fact-checker integrated into a fake news detection platform.

Analyze the given news claim or article. Return ONLY valid JSON — no prose, no markdown, no wrapper text.

Required JSON structure (all fields mandatory):
{
  "verdict": "REAL" | "FAKE" | "MISLEADING",
  "confidence": "High" | "Medium" | "Low",
  "category": "Politics" | "Health" | "Science" | "Finance" | "Religion" | "Disaster" | "Crime" | "Other",
  "severity": "Low" | "Medium" | "High" | "Critical",
  "explanation": "<2-4 plain language lines, no jargon>",
  "key_signals": ["<signal 1>", "<signal 2>", "<optional signal 3>"],
  "correct_information": "<1-2 lines of accurate fact if FAKE or MISLEADING, else null>"
}

=== VERDICT RULES ===
REAL       → Factually accurate, 2+ credible sources confirm, no major fake signals
FAKE       → Demonstrably false, contradicted by credible sources OR confirmed by fact-check databases
MISLEADING → Real fact in false context, critical context missing, OR genuinely uncertain
             DEFAULT to MISLEADING when evidence is insufficient — never guess REAL or FAKE

=== CONFIDENCE RULES ===
High   → 2+ credible sources confirm + strong signal match
Medium → 1 source found OR minor signal conflict
Low    → No sources found OR the claim is ambiguous

=== SEVERITY RULES ===
Critical → Health misinformation, communal/religious violence risk, election fraud
High     → Financial fraud, disaster panic, crime misinformation
Medium   → Political spin, misleading statistics
Low      → Satire mistaken as real, minor factual error

=== KEY SIGNALS (scan for these) ===
Content: Sensational language, fear-based framing, unverifiable statistics, conspiracy framing, clickbait headline vs body mismatch
Source:  No credible source cited, domain score < 40, known satire / parody site, misattributed quote
Distribution: Viral forward pattern, old news recirculated, unverifiable screenshot, no traceable original source
Context: Half-truth in false context, missing context that reverses meaning, statistics from wrong time/geography

=== ALWAYS ===
- Return at least 2 key_signals
- Include correct_information if verdict is FAKE or MISLEADING
- Set correct_information to null if verdict is REAL
"""


def _groq_analyze(
    claim_en: str,
    web_context: str = "",
    ml_summary: str = "",
) -> Dict:
    """Call Groq AI and return the structured analysis dict."""
    user_msg = f"CLAIM/ARTICLE:\n{claim_en[:3000]}"
    if web_context:
        user_msg += f"\n\nWEB SOURCE CONTEXT:\n{web_context[:2000]}"
    if ml_summary:
        user_msg += f"\n\nML ENGINE CONTEXT:\n{ml_summary}"

    try:
        resp = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _GROQ_SYSTEM},
                {"role": "user",   "content": user_msg},
            ],
            temperature=0.1,
            max_tokens=700,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip code fences if present
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)

    except Exception as e:
        print(f"[FactCheckModule][Groq error] {e}")
        return {
            "verdict": "MISLEADING",
            "confidence": "Low",
            "category": "Other",
            "severity": "Medium",
            "explanation": (
                "Analysis could not be completed. "
                "Treat this claim with caution and verify on a trusted source."
            ),
            "key_signals": [
                "AI analysis temporarily unavailable",
                "Claim could not be independently verified",
            ],
            "correct_information": (
                "Please verify on AltNews (altnews.in), "
                "BOOM Live (boomlive.in), or Snopes (snopes.com)."
            ),
        }


# ═════════════════════════════════════════════════════════
#  SECTION 2B — OCR GATE  (Section 2 of spec)
# ═════════════════════════════════════════════════════════

_OCR_NOISE = [
    r"\d{1,2}:\d{2}",          # timestamps  12:34
    r"\d{1,3}%",               # battery/signal %
    r"[\U0001F300-\U0001FAFF]", # decorative emojis
]
_UNREADABLE_MSG = (
    "Image text could not be read clearly. "
    "Please type the claim manually."
)


def _check_ocr_readable(text: str) -> Optional[str]:
    """
    Returns None → text is valid, proceed.
    Returns error string → image is unreadable, return that message.
    """
    cleaned = text.strip()
    for pat in _OCR_NOISE:
        cleaned = re.sub(pat, "", cleaned)
    cleaned = cleaned.strip()
    if len(cleaned.split()) < 5:
        return _UNREADABLE_MSG
    return None


# ═════════════════════════════════════════════════════════
#  SECTION 7A — PLAIN TEXT OUTPUT FORMATTER
# ═════════════════════════════════════════════════════════

def _format_plain_text(
    ai: Dict,
    input_type: str,
    original_text: str,
    lang: str,
) -> str:
    verdict      = ai.get("verdict", "MISLEADING")
    confidence   = ai.get("confidence", "Low")
    explanation  = ai.get("explanation", "")
    signals      = list(ai.get("key_signals", []))
    correct_info = ai.get("correct_information")

    # Translate back to user's language
    if lang not in ("en",):
        explanation  = _from_english(explanation, lang)
        signals      = [_from_english(s, lang) for s in signals]
        if correct_info:
            correct_info = _from_english(correct_info, lang)

    # Ensure at least 2 signals
    while len(signals) < 2:
        signals.append("Insufficient verifiable context")

    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Verdict: {verdict}",
        f"Confidence: {confidence}",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
    ]

    if input_type == "ocr":
        lines.append(f"\nExtracted Message:\n{original_text.strip()}")

    lines.append(f"\nExplanation:\n{explanation}")

    lines.append("\nKey Signals:")
    for s in signals:
        lines.append(f"- {s}")

    if correct_info and verdict in ("FAKE", "MISLEADING"):
        lines.append(f"\nCorrect Information:\n{correct_info}")

    return "\n".join(lines)


# ═════════════════════════════════════════════════════════
#  SECTION 7B — JSON OUTPUT FORMATTER
# ═════════════════════════════════════════════════════════

def _format_json_output(
    ai: Dict,
    input_type: str,
    lang: str,
    lang_name: str,
    ml_score: Optional[float],
    domain_score: Optional[int],
    sources: List[Dict],
    fact_check_refs: List[Dict],
) -> Dict:
    signals = list(ai.get("key_signals", []))
    while len(signals) < 2:
        signals.append("Insufficient verifiable context")

    verdict = ai.get("verdict", "MISLEADING")
    correct_info = ai.get("correct_information")

    return {
        "verdict": verdict,
        "confidence": ai.get("confidence", "Low"),
        "language_detected": lang_name,
        "input_type": "url" if input_type == "url" else "article",
        "extracted_text": None,
        "ml_model_score": round(ml_score, 4) if ml_score is not None else None,
        "domain_credibility_score": domain_score,
        "category": ai.get("category", "Other"),
        "severity": ai.get("severity", "Medium"),
        "explanation": ai.get("explanation", ""),
        "key_signals": signals,
        "correct_information": correct_info if verdict in ("FAKE", "MISLEADING") else None,
        "sources_checked": sources,
        "fact_check_references": fact_check_refs,
    }


# ═════════════════════════════════════════════════════════
#  PUBLIC API  — single entry point
# ═════════════════════════════════════════════════════════

def analyze(
    text: str,
    is_ocr: bool = False,
    ml_score: Optional[float] = None,
    domain_score: Optional[int] = None,
    web_results: Optional[List[Dict]] = None,
    fact_check_refs: Optional[List[Dict]] = None,
    lang_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main entry point for the Fact-Check Analysis Module.

    Parameters
    ----------
    text           : Raw user input (claim, article, URL, OCR text, or chat message)
    is_ocr         : Set True when text comes from the OCR pipeline
    ml_score       : ML model probability for REAL class (0.0–1.0) from predict_ml()
    domain_score   : Credibility score 0–100 from credibility_check endpoint (optional)
    web_results    : List of dicts from verify_claim() / web search (optional)
    fact_check_refs: Pre-fetched fact-check references (optional)
    lang_hint      : ISO language code override (optional)

    Returns
    -------
    {
        "output_mode": "plain_text" | "json",
        "plain_text" : str | None,
        "json_data"  : dict | None,
        "input_type" : str,
        "language"   : str,
    }
    """
    web_results      = web_results      or []
    fact_check_refs  = fact_check_refs  or []

    # ── OCR gate ───────────────────────────────────────
    if is_ocr:
        err = _check_ocr_readable(text)
        if err:
            return {
                "output_mode": "plain_text",
                "plain_text":  err,
                "json_data":   None,
                "input_type":  "ocr",
                "language":    "en",
            }

    # ── Detect input type & output mode ────────────────
    input_type  = _detect_input_type(text, is_ocr=is_ocr)
    output_mode = _get_output_mode(input_type)

    # ── Language detection ──────────────────────────────
    lang      = lang_hint or _detect_lang(text)
    lang_name = _LANG_NAMES.get(lang, "English")

    # ── Translate to English for analysis ──────────────
    text_en = _to_english(text) if lang != "en" else text

    # ── Build web context string ────────────────────────
    sources_scored: List[Dict] = _score_sources(web_results[:6])
    web_context_parts = []
    for s in sources_scored[:3]:
        title = s.get("title", "")
        body  = s.get("body", "")
        if title or body:
            web_context_parts.append(f"[{title}] {body[:400]}")
    web_context = "\n".join(web_context_parts)

    # ── Domain credibility for URL inputs ──────────────
    effective_domain_score = domain_score
    if input_type == "url" and effective_domain_score is None:
        effective_domain_score = _score_domain(text_en)

    # ── ML + domain summary passed to AI ───────────────
    ml_summary_parts = []
    if ml_score is not None:
        ml_label = "REAL" if ml_score >= 0.5 else "FAKE"
        ml_summary_parts.append(
            f"ML writing-style model predicts: {ml_label} "
            f"(real_prob={ml_score:.2f}, fake_prob={1-ml_score:.2f})."
        )
    if effective_domain_score is not None:
        tier = (
            "Tier 1 (highly credible)" if effective_domain_score >= 90 else
            "Tier 2 (generally reliable)" if effective_domain_score >= 70 else
            "Tier 3 (mixed credibility)" if effective_domain_score >= 50 else
            "Tier 4–5 (low credibility)"
        )
        ml_summary_parts.append(
            f"Domain credibility score: {effective_domain_score}/100 ({tier})."
        )
    ml_summary = " ".join(ml_summary_parts)

    # ── Groq AI analysis ───────────────────────────────
    ai_result = _groq_analyze(text_en, web_context, ml_summary)

    # ── Format and return ──────────────────────────────
    if output_mode == "plain_text":
        plain = _format_plain_text(ai_result, input_type, text, lang)
        return {
            "output_mode": "plain_text",
            "plain_text":  plain,
            "json_data":   None,
            "input_type":  input_type,
            "language":    lang,
        }
    else:
        json_data = _format_json_output(
            ai            = ai_result,
            input_type    = input_type,
            lang          = lang,
            lang_name     = lang_name,
            ml_score      = ml_score,
            domain_score  = effective_domain_score,
            sources       = sources_scored,
            fact_check_refs = fact_check_refs,
        )
        return {
            "output_mode": "json",
            "plain_text":  None,
            "json_data":   json_data,
            "input_type":  input_type,
            "language":    lang,
        }
