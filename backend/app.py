from flask import Flask, render_template, request, jsonify
import pickle
import requests
from bs4 import BeautifulSoup
from newspaper import Article
from deep_translator import GoogleTranslator
from langdetect import detect, LangDetectException
from ddgs import DDGS
from groq import Groq
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, template_folder='../frontend/templates')

model      = pickle.load(open("model/model.pkl", "rb"))
vectorizer = pickle.load(open("model/vectorizer.pkl", "rb"))

# ── Groq AI Client ───────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

# ── Language display names ────────────────────────────────
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "gu": "Gujarati",
    "mr": "Marathi",
    "pa": "Punjabi",
    "bn": "Bengali",
    "ur": "Urdu",
    "ta": "Tamil",
    "te": "Telugu",
    "unknown": "Hinglish / Gujlish",
}

# ── Credible news domains ────────────────────────────────
CREDIBLE_DOMAINS = [
    "bbc.com", "bbc.co.uk", "reuters.com", "apnews.com",
    "theguardian.com", "nytimes.com", "washingtonpost.com",
    "aljazeera.com", "cnn.com", "abcnews.go.com", "cbsnews.com",
    "nbcnews.com", "usatoday.com", "foxnews.com", "sky.com",
    "france24.com", "dw.com", "euronews.com",
    "ndtv.com", "thehindu.com", "hindustantimes.com",
    "indianexpress.com", "timesofindia.indiatimes.com", "livemint.com",
    "businessstandard.com", "scroll.in", "thewire.in",
    "news18.com", "wionews.com", "firstpost.com",
    "aajtak.in", "abplive.com", "zeenews.india.com",
    "theprint.in", "deccanherald.com", "tribuneindia.com",
    "oneindia.com", "dnaindia.com", "outlookindia.com",
    "economictimes.indiatimes.com", "business-standard.com",
    "espncricinfo.com", "cricbuzz.com", "bcci.tv",
    "icc-cricket.com", "sportstar.thehindu.com",
    "espn.com", "sports.ndtv.com", "sportskeeda.com",
    "cricketworld.com", "wisden.com", "skysports.com",
    "news.google.com", "msn.com", "yahoo.com",
    "indiatoday.in", "india.com", "jagran.com",
    "divyabhaskar.co.in", "sandesh.com", "gujaratsamachar.com",
    "factcheck.org", "snopes.com", "politifact.com",
    "vishvasnews.com", "altnews.in", "boomlive.in",
    "thequint.com", "factly.in",
    "wikipedia.org", "en.wikipedia.org",
]

FAKE_DOMAINS = [
    "theonion.com", "babylonbee.com", "worldnewsdailyreport.com",
    "nationalreport.net", "empirenews.net", "huzlers.com",
    "worldnewsera.com", "newsbiscuit.com", "dailybuzzlive.com",
]

SHORT_CLAIM_THRESHOLD = 60


# ══════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════

def detect_language(text):
    try:
        return detect(text)
    except LangDetectException:
        return "unknown"


def translate_to_english(text):
    try:
        if not text or len(text.strip()) < 5:
            return text, False
        translated = GoogleTranslator(source="auto", target="en").translate(text[:4500])
        return (translated if translated else text), True
    except Exception:
        return text, False


def scrape_article(url):
    """Scrape article text from a URL."""
    try:
        art = Article(url)
        art.download(); art.parse(); art.nlp()
        return {
            "success": True,
            "title": art.title,
            "text": art.text,
            "authors": art.authors,
            "publish_date": str(art.publish_date) if art.publish_date else "Unknown",
            "keywords": art.keywords,
            "summary": art.summary,
        }
    except Exception:
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1")
            title = h1.text.strip() if h1 else "Unknown Title"
            text = " ".join(p.text for p in soup.find_all("p") if len(p.text) > 50)
            return {
                "success": True, "title": title, "text": text,
                "authors": [], "publish_date": "Unknown",
                "keywords": [], "summary": text[:300],
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


def scrape_url_text(url, max_chars=1500):
    """Quick scrape of a URL to get article text for AI comparison."""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=8)
        soup = BeautifulSoup(r.text, "html.parser")
        paras = soup.find_all("p")
        text = " ".join(p.get_text().strip() for p in paras if len(p.get_text().strip()) > 30)
        return text[:max_chars] if text else ""
    except Exception:
        return ""


# ══════════════════════════════════════════════════════════
#  GROQ AI FACT-CHECKER
# ══════════════════════════════════════════════════════════

def ai_fact_check(claim, source_texts):
    """
    Send the claim + scraped source articles to Groq AI.
    The AI compares every detail and spots contradictions.
    """
    try:
        # Build context from scraped articles
        context = ""
        for i, txt in enumerate(source_texts, 1):
            if txt:
                context += f"\n--- Source {i} ---\n{txt[:1200]}\n"

        if not context.strip():
            return None

        prompt = f"""You are a strict fact-checker. Compare the CLAIM against the SOURCE articles below.

CLAIM: "{claim}"

SOURCES:
{context}

Instructions:
1. Check EVERY detail in the claim against the sources (names, numbers, dates, places, events, outcomes).
2. If ANY detail is wrong (even one number or name), mark it as FAKE.
3. If all details match the sources, mark it as REAL.
4. If the sources don't contain enough information to verify, mark as UNVERIFIED.

Respond in this EXACT JSON format only, no other text:
{{"verdict": "REAL" or "FAKE" or "UNVERIFIED", "confidence": 50-99, "reason": "short explanation of what matches or contradicts", "details_checked": ["list of specific details you verified"]}}"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise fact-checker. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=500,
        )

        text = response.choices[0].message.content.strip()
        print(f"[Groq AI] Raw response: {text}")

        # Parse JSON from response
        # Sometimes the AI wraps it in ```json...``` so extract it
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        result = json.loads(text)
        return result

    except Exception as e:
        print(f"[Groq AI Error] {e}")
        return None


# ══════════════════════════════════════════════════════════
#  VERIFICATION ENGINE
# ══════════════════════════════════════════════════════════

def verify_claim(claim):
    """
    Full verification pipeline:
    1. Search web for the claim
    2. Find credible sources
    3. Scrape top articles
    4. Send claim + articles to Groq AI for detail comparison
    5. Return verdict
    """
    try:
        ddgs = DDGS()
        all_results = []
        seen_urls = set()

        # Search 1: News search
        try:
            news_results = list(ddgs.news(claim, max_results=10))
            for r in news_results:
                url = r.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append({
                        "href": url,
                        "title": r.get("title", ""),
                        "body": r.get("body", ""),
                    })
        except Exception as e:
            print(f"[News search] {e}")

        # Search 2: Text search backup
        try:
            text_results = list(ddgs.text(claim + " news", max_results=8))
            for r in text_results:
                url = r.get("href", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append(r)
        except Exception as e:
            print(f"[Text search] {e}")

        print(f"[Search] Total results: {len(all_results)}")

        # Categorize sources
        credible_hits = []
        fake_hits = []

        for r in all_results:
            url = r.get("href", r.get("url", "")).lower()
            title = r.get("title", "")
            link = r.get("href", r.get("url", ""))

            is_fake_src = False
            for fd in FAKE_DOMAINS:
                if fd in url:
                    fake_hits.append({"domain": fd, "title": title, "url": link})
                    is_fake_src = True
                    break

            if not is_fake_src:
                for cd in CREDIBLE_DOMAINS:
                    if cd in url:
                        credible_hits.append({"domain": cd, "title": title, "url": link})
                        break

        # De-duplicate by domain
        unique = {}
        for h in credible_hits:
            if h["domain"] not in unique:
                unique[h["domain"]] = h
        credible_hits = list(unique.values())

        c = len(credible_hits)
        f = len(fake_hits)
        print(f"[Search] Credible: {c}, Fake: {f}")

        # ── STEP 3: Scrape top articles for AI comparison ──
        source_texts = []
        urls_to_scrape = [h["url"] for h in credible_hits[:3]]

        # Also try all results if credible hits are few
        if len(urls_to_scrape) < 2:
            for r in all_results[:5]:
                u = r.get("href", r.get("url", ""))
                if u and u not in urls_to_scrape:
                    urls_to_scrape.append(u)
                if len(urls_to_scrape) >= 3:
                    break

        for url in urls_to_scrape:
            txt = scrape_url_text(url)
            if txt and len(txt) > 100:
                source_texts.append(txt)
                print(f"[Scrape] Got {len(txt)} chars from {url[:60]}")

        # ── STEP 4: Ask Groq AI to fact-check ──
        ai_result = None
        ai_reason = ""
        ai_details = []

        if source_texts:
            ai_result = ai_fact_check(claim, source_texts)

        if ai_result:
            verdict = ai_result.get("verdict", "UNVERIFIED")
            ai_confidence = ai_result.get("confidence", 70)
            ai_reason = ai_result.get("reason", "")
            ai_details = ai_result.get("details_checked", [])

            if verdict == "REAL":
                label = "Real News"
                is_fake = False
                confidence = ai_confidence
            elif verdict == "FAKE":
                label = "Fake News"
                is_fake = True
                confidence = ai_confidence
            else:
                label = "Unverified"
                is_fake = True
                confidence = 55

            # Boost confidence if credible sources also agree
            if not is_fake and c >= 3:
                confidence = min(99, confidence + 5)

        elif c >= 3:
            label, is_fake, confidence = "Real News (Web Only)", False, min(95, 70 + c * 5)
            ai_reason = "AI unavailable. Verdict based on credible source count only."
        elif c >= 1 and f == 0:
            label, is_fake, confidence = "Likely Real (Web Only)", False, 65
            ai_reason = "AI unavailable. Some credible sources found."
        elif f >= 1 and c == 0:
            label, is_fake, confidence = "Fake News", True, 80
            ai_reason = "Found on known fake/satire sites."
        else:
            label, is_fake, confidence = "Unverified", True, 55
            ai_reason = "No credible sources found and AI could not verify."

        fake_p = round(confidence, 2) if is_fake else round(100 - confidence, 2)
        real_p = round(100 - confidence, 2) if is_fake else round(confidence, 2)

        return {
            "label": label,
            "is_fake": is_fake,
            "confidence": confidence,
            "fake_prob": fake_p,
            "real_prob": real_p,
            "verification_method": "AI Fact-Check + Web Search" if ai_result else "Web Search Only",
            "credible_sources": credible_hits[:5],
            "credible_count": c,
            "ai_reason": ai_reason,
            "ai_details": ai_details,
        }

    except Exception as e:
        print(f"[Verify error] {e}")
        return None


def predict_ml(text):
    """ML model for long articles."""
    vec = vectorizer.transform([text])
    pred = model.predict(vec)
    prob = model.predict_proba(vec)[0]
    conf = round(max(prob) * 100, 2)
    return {
        "label": "Real News" if pred[0] == 1 else "Fake News",
        "is_fake": bool(pred[0] == 0),
        "confidence": conf,
        "fake_prob": round(prob[0] * 100, 2),
        "real_prob": round(prob[1] * 100, 2),
        "verification_method": "ML Writing-Style Analysis",
        "credible_sources": [],
        "credible_count": 0,
        "ai_reason": "Analysed using machine learning writing-style patterns.",
        "ai_details": [],
    }


# ══════════════════════════════════════════════════════════
#  MAIN PREDICT
# ══════════════════════════════════════════════════════════

def predict_text(raw_text):
    """
    1. Detect language
    2. Translate to English
    3. Route: short claim -> AI + web search, long article -> AI + ML
    """
    detected_lang = detect_language(raw_text)
    lang_display = LANGUAGE_NAMES.get(detected_lang, detected_lang)

    translated, was_translated = raw_text, False
    if detected_lang != "en":
        translated, was_translated = translate_to_english(raw_text)
        if detected_lang == "unknown":
            lang_display = "Hinglish / Gujlish"

    word_count = len(translated.split())

    # Route to engine
    if word_count < SHORT_CLAIM_THRESHOLD:
        result = verify_claim(translated)
        if result is None:
            result = predict_ml(translated)
    else:
        # For long articles: try AI fact-check first, fall back to ML
        result = verify_claim(translated)
        if result is None:
            result = predict_ml(translated)

    result["detected_language"] = lang_display
    result["was_translated"] = was_translated
    result["translated_preview"] = translated[:400] + "..." if len(translated) > 400 else translated
    result["word_count"] = word_count
    return result


# ══════════════════════════════════════════════════════════
#  FLASK ROUTES
# ══════════════════════════════════════════════════════════

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    news = request.form.get("news", "").strip()
    url = request.form.get("url", "").strip()
    article_info = None

    if url:
        scraped = scrape_article(url)
        if scraped["success"]:
            news = scraped["text"]
            article_info = scraped
        else:
            return render_template("index.html",
                                   error="Could not scrape URL: " + scraped.get("error", "Unknown error"))

    if not news:
        return render_template("index.html",
                               error="Please enter news text or a valid URL.")

    res = predict_text(news)

    return render_template(
        "index.html",
        prediction=res["label"],
        is_fake=res["is_fake"],
        confidence=res["confidence"],
        fake_prob=res["fake_prob"],
        real_prob=res["real_prob"],
        article=article_info,
        detected_language=res["detected_language"],
        was_translated=res["was_translated"],
        translated_preview=res["translated_preview"],
        verification_method=res["verification_method"],
        credible_sources=res["credible_sources"],
        credible_count=res["credible_count"],
        ai_reason=res["ai_reason"],
        ai_details=res["ai_details"],
        word_count=res["word_count"],
        input_text=news[:500] + "..." if len(news) > 500 else news,
    )


@app.route("/predict-api", methods=["POST"])
def predict_api():
    data = request.get_json()
    text = data.get("text", "")
    url = data.get("url", "")

    if url:
        scraped = scrape_article(url)
        if scraped["success"]:
            text = scraped["text"]
        else:
            return jsonify({"error": scraped["error"]}), 400

    if not text:
        return jsonify({"error": "No text or URL provided"}), 400

    return jsonify(predict_text(text))


if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print("\n[*] Fake News Detector with Groq AI")
    print("    Engine    : AI Fact-Check + Web Search + ML")
    print("    Languages : English | Hindi | Gujarati | Hinglish | Gujlish")
    print("    URL       : http://127.0.0.1:5000\n")
    app.run(debug=True)