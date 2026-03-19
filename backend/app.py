from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
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

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')
CORS(app)

# Resolve paths relative to this file so the app works regardless of the current working directory.
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent

model      = pickle.load(open(BASE_DIR / "model" / "model.pkl", "rb"))
vectorizer = pickle.load(open(BASE_DIR / "model" / "vectorizer.pkl", "rb"))

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

def predict_text(raw_text, language_hint=None):
    """
    1. Detect language (or use the provided language hint)
    2. Translate to English
    3. Route: short claim -> AI + web search, long article -> AI + ML
    """
    if language_hint:
        detected_lang = language_hint
    else:
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
    return render_template("index.html", active_page="home")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", active_page="dashboard")


@app.route("/learn")
def learn():
    return render_template("learn.html", active_page="learn")


@app.route("/report", methods=["GET", "POST"])
def report():
    import random
    import string
    
    if request.method == "POST":
        # Extract form data
        url         = request.form.get("url", "")
        category    = request.form.get("category", "")
        description = request.form.get("description", "")
        platform    = request.form.get("platform", "WhatsApp")
        anonymous   = request.form.get("anonymous", "off") # Flask switch is "on" or absent

        # Logic to save the report would go here
        # (e.g., db.session.add(NewReport(...)) or log to CSV)
        print(f"[Report Log] New report submitted: {url} | Platform: {platform}")

        # Generate a random report ID
        report_id = "RPT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

        return render_template("report.html", 
                               active_page="report",
                               report_submitted=True,
                               report_id=report_id)

    return render_template("report.html", 
                           active_page="report",
                           report_submitted=False,
                           report_id=None)


@app.route("/api/quiz")
def api_quiz():
    """Return a list of quiz questions dynamically."""
    import random
    
    questions = [
        {
            "q": "A WhatsApp message claims 'Eating raw garlic daily prevents cancer.' What is your first step?",
            "options": [
                "Share it immediately — it sounds helpful",
                "Check WHO or government health websites first",
                "Forward it to 10 friends to warn them",
                "Believe it since garlic is healthy"
            ],
            "correct": 1,
            "explanation": "✓ Always verify health claims on official sources like WHO, CDC, or your government health ministry before sharing or believing them."
        },
        {
            "q": "Which headline is most likely fake news?",
            "options": [
                "\"Government announces new tax policy for 2025\"",
                "\"SHOCKING!! Doctors HATE this one simple trick\"",
                "\"Stock market closes up 0.3% today\"",
                "\"Local council approves road construction plan\""
            ],
            "correct": 1,
            "explanation": "✓ ALL CAPS words like \"SHOCKING\" and phrases like \"HATE this one trick\" are classic emotional manipulation tactics used in fake news headlines."
        },
        {
            "q": "A news article has no author name and no publication date. This means:",
            "options": [
                "The author wants to stay anonymous — perfectly fine",
                "It might be outdated or fabricated — verify carefully",
                "It is definitely 100% fake news",
                "Anonymous articles are actually more trustworthy"
            ],
            "correct": 1,
            "explanation": "✓ Missing author names and publication dates are major credibility red flags. Legitimate journalism always includes these details for accountability."
        },
        {
            "q": "You see a viral photo claimed to show a recent disaster in India. Best first step?",
            "options": [
                "Share immediately to raise awareness",
                "Reverse image search to check the original source",
                "Trust it since it has thousands of shares",
                "Check if the photo looks realistic"
            ],
            "correct": 1,
            "explanation": "✓ Reverse image search (Google Images or TinEye) can reveal if a photo is from a different event, a different year, or is digitally altered."
        },
        {
            "q": "A story is only covered by one website you have never heard of. You should:",
            "options": [
                "Trust it — exclusive news is valuable",
                "Be skeptical and cross-check with Reuters or BBC",
                "Share it — you found the story first",
                "The site design looks professional so it must be real"
            ],
            "correct": 1,
            "explanation": "✓ Real news is reported by multiple credible outlets. A story covered only by one unknown site is a major red flag — always cross-reference."
        },
        {
            "q": "What is 'Deepfake' content?",
            "options": [
                "A very long news article",
                "AI-generated realistic media that replaces someone's likeness",
                "A news story about deep sea exploration",
                "A password that is hard to crack"
            ],
            "correct": 1,
            "explanation": "✓ Deepfakes use artificial intelligence to create convincing but entirely fake images or videos of people saying or doing things they never did."
        },
        {
            "q": "If you see a post with a link to 'claim your free gift' from a major brand, but the URL is 'brand-rewards.biz', you should:",
            "options": [
                "Click and claim it quickly before it expires",
                "Enter your details to verify your identity",
                "Ignore it; brand websites usually end in .com or .in/co.in",
                "Share it so your family can get free gifts too"
            ],
            "correct": 2,
            "explanation": "✓ Scammers often use 'copycat' URLs that look similar to real brands. Always check the domain carefully—official brands rarely use obscure extensions like .biz for rewards."
        }
    ]
    
    # Shuffle and return 5 random questions
    random.shuffle(questions)
    return jsonify(questions[:5])


@app.route("/analytics")
def analytics_page():
    return render_template("analytics.html", active_page="analytics")


@app.route("/predict", methods=["POST"])
def predict():
    news = request.form.get("news", "").strip()
    url = request.form.get("url", "").strip()
    selected_language = request.form.get("selected_language", "en")
    article_info = None

    if url:
        scraped = scrape_article(url)
        if scraped["success"]:
            news = scraped["text"]
            article_info = scraped
        else:
            return render_template("index.html", active_page="home",
                                   error="Could not scrape URL: " + scraped.get("error", "Unknown error"))

    if not news:
        return render_template("index.html", active_page="home",
                               error="Please enter news text or a valid URL.")

    res = predict_text(news, language_hint=selected_language)

    return render_template(
        "index.html", active_page="home",
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


@app.route("/api/latest-factchecked")
def latest_factchecked():
    import csv
    import random
    try:
        csv_path = BASE_DIR / "live_scraped_data.csv"
        rows = []
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                text = row.get("text", "").strip()
                label = row.get("label", "").strip()
                if not text:
                    continue
                # Extract headline: first sentence up to 100 chars
                first_line = text.split(".")[0].strip()
                headline = first_line[:100] + ("..." if len(first_line) > 100 else "")

                if len(headline) < 20:
                    continue
                # Auto-detect category from keywords
                t = text.lower()
                if any(w in t for w in ["vaccine", "virus", "cure", "cancer", "health",
                                        "medicine", "doctor", "diet", "chronic"]):
                    category = "Health"
                elif any(w in t for w in ["cricket", "ipl", "football", "sports", "match",
                                          "fifa", "olympic", "bafta", "game"]):
                    category = "Sports/Entertainment"
                elif any(w in t for w in ["economy", "finance", "spending", "budget"]):
                    category = "Finance"
                elif any(w in t for w in ["trump", "minister", "election", "government",
                                          "parliament", "policy", "senate", "congress", "noem"]):
                    category = "Politics"
                elif any(w in t for w in ["nasa", "science", "space", "uap", "ufo",
                                          "research", "discovery", "technology", "5g"]):
                    category = "Science"
                elif any(w in t for w in ["war", "military", "attack", "strike",
                                          "israel", "iran", "ukraine", "conflict"]):
                    category = "World"
                else:
                    category = "General"
                rows.append({
                    "headline": headline,
                    "result": "Real" if label == "1" else "Fake",
                    "category": category,
                })
        random.shuffle(rows)
        return jsonify(rows[:6])
    except Exception as e:
        print(f"[CSV Error] {e}")
        return jsonify([]), 500


@app.route("/api/trending")
def api_trending():
    """Return trending fake-news items from Google Fact Check API + CSV fallback."""
    import csv
    import random

    category_param = request.args.get("category", "").strip()

    EMERGENCY_FALLBACK = [
        {"headline": "Drinking hot water cures all viruses", "category": "Health", "platform": "WhatsApp", "fake_pct": 94},
        {"headline": "5G towers cause cancer, WHO confirms", "category": "Science", "platform": "Facebook", "fake_pct": 91},
        {"headline": "New government scheme gives Rs 50,000 to all farmers free", "category": "Politics", "platform": "WhatsApp", "fake_pct": 88},
    ]

    def detect_category(text):
        t = text.lower()
        if any(w in t for w in ["vaccine", "virus", "cure", "cancer", "health", "medicine", "doctor", "diet", "disease"]):
            return "Health"
        if any(w in t for w in ["trump", "minister", "election", "government", "senate", "congress", "policy", "president", "vote", "party"]):
            return "Politics"
        if any(w in t for w in ["5g", "ai", "app", "hack", "software", "chip", "phone", "robot", "cyber", "internet"]):
            return "Technology"
        if any(w in t for w in ["nasa", "space", "science", "ufo", "uap", "planet", "climate", "research", "discovery"]):
            return "Science"
        if any(w in t for w in ["economy", "finance", "spending", "budget", "bank", "money", "scheme", "tax", "rupee", "dollar"]):
            return "Finance"
        if any(w in t for w in ["cricket", "football", "sports", "match", "olympic", "fifa", "ipl", "game", "player"]):
            return "Sports"
        return "General"

    def pick_platform():
        return random.choice(["WhatsApp", "Twitter/X", "Facebook", "YouTube", "Web"])

    def rating_to_pct(rating):
        if not rating:
            return random.randint(82, 95)
        r = rating.lower()
        if any(w in r for w in ["false", "fake", "pants on fire", "fabricated", "misleading", "incorrect",
                                 "not true", "hoax", "scam", "debunked", "wrong"]):
            return random.randint(85, 97)
        if any(w in r for w in ["mostly false", "half true", "partly", "mixture", "unproven", "distorts"]):
            return random.randint(65, 84)
        if any(w in r for w in ["true", "correct", "accurate"]):
            return 0  # skip these
        return random.randint(70, 90)

    rows = []
    seen = set()

    # --- Source 1: Google Fact Check Tools API ---
    try:
        queries = [category_param + " fake news"] if category_param else [
            "health misinformation", "political fake news",
            "technology hoax", "science false claim",
            "viral misinformation india"
        ]
        api_key = os.environ.get("GOOGLE_FACTCHECK_API_KEY", "")
        if api_key:
            for q in queries:
                try:
                    resp = requests.get(
                        "https://factchecktools.googleapis.com/v1alpha1/claims:search",
                        params={"query": q, "languageCode": "en", "pageSize": 6, "key": api_key},
                        timeout=5
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for claim in data.get("claims", []):
                            headline = claim.get("text", "").strip()
                            if not headline or len(headline) < 20 or headline.lower() in seen:
                                continue
                            reviews = claim.get("claimReview", [])
                            rating = reviews[0].get("textualRating", "") if reviews else ""
                            pct = rating_to_pct(rating)
                            if pct < 55:
                                continue
                            seen.add(headline.lower())
                            rows.append({
                                "headline": headline[:150],
                                "category": detect_category(headline),
                                "platform": pick_platform(),
                                "fake_pct": pct,
                            })
                except Exception:
                    pass
    except Exception:
        pass

    # --- Source 2: CSV fallback ---
    try:
        csv_path = BASE_DIR / "live_scraped_data.csv"
        csv_rows = []

        # keyword map — used for fast pre-filtering when a category is requested
        CATEGORY_KEYWORDS = {
            "Health":     ["vaccine", "virus", "cure", "cancer", "health", "medicine",
                           "doctor", "diet", "disease", "hospital", "drug", "covid"],
            "Politics":   ["trump", "minister", "election", "government", "senate",
                           "congress", "policy", "president", "vote", "party", "democrat",
                           "republican", "biden", "modi", "parliament"],
            "Technology": ["5g", " ai ", "app", "hack", "software", "chip", "phone",
                           "robot", "cyber", "internet", "tech", "computer", "digital"],
            "Science":    ["nasa", "space", "science", "ufo", "uap", "planet", "climate",
                           "research", "discovery", "astronomy", "physics", "study"],
            "Finance":    ["economy", "finance", "spending", "budget", "bank", "money",
                           "scheme", "tax", "rupee", "dollar", "stock", "market", "crypto"],
            "Sports":     ["cricket", "football", "sports", "match", "olympic", "fifa",
                           "ipl", "game", "player", "tournament", "league", "athlete"],
        }

        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                text = row.get("text", "").strip()
                label = row.get("label", "1").strip()
                if label != "0":
                    continue
                if len(text) < 40:
                    continue

                # fast pre-filter: if a category is requested, check keywords first
                if category_param and category_param in CATEGORY_KEYWORDS:
                    kws = CATEGORY_KEYWORDS[category_param]
                    t_lower = text.lower()
                    if not any(kw in t_lower for kw in kws):
                        continue  # skip rows unrelated to the requested category

                first_line = text.split(".")[0].strip()
                headline = first_line[:120] + ("..." if len(first_line) > 120 else "")
                if len(headline) < 25 or headline.lower() in seen:
                    continue

                detected = detect_category(text)

                # if a specific category is requested, only include matching rows
                if category_param and category_param in CATEGORY_KEYWORDS:
                    if detected != category_param:
                        continue

                seen.add(headline.lower())
                csv_rows.append({
                    "headline": headline,
                    "category": detected,
                    "platform": pick_platform(),
                    "fake_pct": random.randint(82, 98),
                })

        random.shuffle(csv_rows)
        need = 8 - len(rows)
        if need > 0:
            rows.extend(csv_rows[:need])
    except Exception:
        pass

    # --- Source 3: Emergency fallback ---
    if len(rows) == 0:
        rows = EMERGENCY_FALLBACK

    random.shuffle(rows)
    return jsonify(rows[:8])
# ── API: Live Misinformation Feed ──────────────────────────
@app.route('/api/live-feed', methods=['POST'])
def live_feed():
    try:
        data = request.get_json()
        
        country   = data.get('country',   'worldwide')
        state     = data.get('state',      'all')
        source    = data.get('source',     'all')
        category  = data.get('category',   'all')
        time_range = data.get('timeRange', '7days')
        
        prompt = f"""Generate 6 realistic fake news 
headlines currently spreading with these filters:
Country: {country}
State/Region: {state}
Platform: {source}
Category: {category}
Time range: {time_range}

Return ONLY a valid JSON array. No markdown. 
No explanation. No code blocks.
Each object must have exactly these keys:
{{
  "headline": "realistic fake news headline",
  "source": "fake website or WhatsApp group name",
  "platform": "WhatsApp|Facebook|Twitter|Telegram|Instagram",
  "fakeScore": number between 65 and 98,
  "category": "Health|Politics|Finance|Technology|Local",
  "location": "city or region name matching the country/state",
  "shareCount": number between 1000 and 500000,
  "timeAgo": "X min ago or X hr ago",
  "credibilityReason": "one sentence explaining why it is fake"
}}

Make headlines specific to {country} 
{"and " + state if state != "all" else ""}.
Use local context, local politicians, local health issues,
local platforms popular in that region.
If country is India: use Indian names, rupees, Indian context.
If country is USA: use American context, dollars.
Etc."""

        # Use Groq (Llama 3 70B)
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a fake news monitoring system. You generate realistic examples of misinformation for research and detection training. Always respond with valid JSON only."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            temperature=0.8,
            max_tokens=1500
        )
        
        response_text = completion.choices[0].message.content
        
        # Clean response — remove any markdown if Groq adds it
        response_text = response_text.strip()
        if response_text.startswith('```'):
            parts = response_text.split('```')
            if len(parts) > 1:
                response_text = parts[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
        response_text = response_text.strip()
        
        # Parse and validate JSON
        items = json.loads(response_text)
        
        # Ensure it's a list
        if not isinstance(items, list):
            raise ValueError("Response is not a JSON array")
        
        # Validate each item has required fields
        required_keys = ['headline','source','platform',
                         'fakeScore','category','location',
                         'shareCount','timeAgo',
                         'credibilityReason']
        for item in items:
            for key in required_keys:
                if key not in item:
                    item[key] = 'Unknown'
        
        return jsonify({
            'success': True,
            'items': items,
            'filters': {
                'country': country,
                'state': state,
                'source': source,
                'category': category
            }
        })
        
    except json.JSONDecodeError as e:
        app.logger.error(f"JSON parse error: {e}")
        return jsonify({
            'success': False,
            'error': 'parse_error',
            'message': 'AI response could not be parsed'
        }), 500
        
    except Exception as e:
        app.logger.error(f"Live feed error: {e}")
        return jsonify({
            'success': False,
            'error': 'server_error',
            'message': str(e)
        }), 500


if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    port = int(os.environ.get("PORT", 5000))

    print("\n[*] Fake News Detector with Groq AI")
    print("    Engine    : AI Fact-Check + Web Search + ML")
    print("    Languages : English | Hindi | Gujarati | Hinglish | Gujlish")
    print(f"    URL       : http://0.0.0.0:{port}\n")

    app.run(host="0.0.0.0", port=port, debug=True)