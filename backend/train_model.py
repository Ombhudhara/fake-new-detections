"""
Multi-Language Fake News Detector - Training Script
=====================================================
Languages Supported:
  ✅ English
  ✅ Hindi (हिंदी)
  ✅ Gujarati (ગુજરાતી)
  ✅ Hinglish (Hindi written in English letters)
  ✅ Gujlish (Gujarati written in English letters)

Real News Sources  : BBC, Reuters, AP, NDTV, Aaj Tak, Divya Bhaskar
Fake News Sources  : Snopes, PolitiFact, Vishvas News (Hindi/Gujarati fact-checkers)

Strategy: Translate all non-English text → English → Train single unified model
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import pickle
import time
import random
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from deep_translator import GoogleTranslator

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8,gu;q=0.7",
}

def translate_to_english(text):
    """Translate any language text to English using Google Translate."""
    try:
        if not text or len(text.strip()) < 10:
            return text
        translated = GoogleTranslator(source='auto', target='en').translate(text[:4500])
        return translated if translated else text
    except Exception as e:
        print(f"    ⚠ Translation error: {e}")
        return text  # Return original if translation fails


def extract_text_from_soup(soup, min_len=40):
    """Extract meaningful paragraph text from BeautifulSoup object."""
    paras = soup.find_all("p")
    text = " ".join(p.get_text().strip() for p in paras if len(p.get_text().strip()) > min_len)
    return text


def safe_get(url, timeout=12):
    """Safe HTTP GET with error handling."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception:
        return None


# ══════════════════════════════════════════════════════
#  REAL NEWS SCRAPERS
# ══════════════════════════════════════════════════════

def scrape_bbc_english():
    """Scrape real news from BBC (English)."""
    articles = []
    print("\n  🌐 [English] BBC News...")
    try:
        r = safe_get("https://www.bbc.com/news")
        if not r:
            return articles
        soup = BeautifulSoup(r.text, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/news/" in href and len(href) > 20 and "bbc.com" not in href:
                links.add("https://www.bbc.com" + href)
        for url in list(links)[:25]:
            res = safe_get(url)
            if not res:
                continue
            s = BeautifulSoup(res.text, "html.parser")
            text = extract_text_from_soup(s)
            if len(text.split()) > 80:
                articles.append(text)
                print(f"    ✓ BBC ({len(text.split())} words)")
            time.sleep(random.uniform(0.4, 0.9))
    except Exception as e:
        print(f"    BBC error: {e}")
    return articles


def scrape_reuters_english():
    """Scrape real news from Reuters (English)."""
    articles = []
    print("\n  🌐 [English] Reuters...")
    try:
        r = safe_get("https://www.reuters.com")
        if not r:
            return articles
        soup = BeautifulSoup(r.text, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("/") and href.count("/") >= 3 and len(href) > 15:
                links.add("https://www.reuters.com" + href)
        for url in list(links)[:25]:
            res = safe_get(url)
            if not res:
                continue
            s = BeautifulSoup(res.text, "html.parser")
            text = extract_text_from_soup(s)
            if len(text.split()) > 80:
                articles.append(text)
                print(f"    ✓ Reuters ({len(text.split())} words)")
            time.sleep(random.uniform(0.4, 0.9))
    except Exception as e:
        print(f"    Reuters error: {e}")
    return articles


def scrape_ap_english():
    """Scrape real news from AP News (English)."""
    articles = []
    print("\n  🌐 [English] AP News...")
    try:
        r = safe_get("https://apnews.com")
        if not r:
            return articles
        soup = BeautifulSoup(r.text, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/article/" in href:
                full = "https://apnews.com" + href if href.startswith("/") else href
                links.add(full)
        for url in list(links)[:25]:
            res = safe_get(url)
            if not res:
                continue
            s = BeautifulSoup(res.text, "html.parser")
            text = extract_text_from_soup(s)
            if len(text.split()) > 80:
                articles.append(text)
                print(f"    ✓ AP News ({len(text.split())} words)")
            time.sleep(random.uniform(0.4, 0.9))
    except Exception as e:
        print(f"    AP error: {e}")
    return articles


def scrape_ndtv_hindi():
    """Scrape real news from NDTV Hindi — translates to English."""
    articles = []
    print("\n  🇮🇳 [Hindi] NDTV Hindi...")
    try:
        for section in ["india", "world", "sports"]:
            r = safe_get(f"https://khabar.ndtv.com/{section}")
            if not r:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "khabar.ndtv.com" in href and len(href) > 40:
                    links.add(href)
            for url in list(links)[:12]:
                res = safe_get(url)
                if not res:
                    continue
                s = BeautifulSoup(res.text, "html.parser")
                text = extract_text_from_soup(s, min_len=20)
                if len(text.split()) > 40:
                    translated = translate_to_english(text)
                    if len(translated.split()) > 40:
                        articles.append(translated)
                        print(f"    ✓ NDTV Hindi→EN ({len(translated.split())} words)")
                time.sleep(random.uniform(0.5, 1.0))
    except Exception as e:
        print(f"    NDTV Hindi error: {e}")
    return articles


def scrape_aajtak_hindi():
    """Scrape real news from Aaj Tak (Hindi) — translates to English."""
    articles = []
    print("\n  🇮🇳 [Hindi] Aaj Tak...")
    try:
        r = safe_get("https://www.aajtak.in/india")
        if not r:
            return articles
        soup = BeautifulSoup(r.text, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("/") and len(href) > 20 and href.count("-") > 2:
                links.add("https://www.aajtak.in" + href)
        for url in list(links)[:15]:
            res = safe_get(url)
            if not res:
                continue
            s = BeautifulSoup(res.text, "html.parser")
            text = extract_text_from_soup(s, min_len=20)
            if len(text.split()) > 40:
                translated = translate_to_english(text)
                if len(translated.split()) > 40:
                    articles.append(translated)
                    print(f"    ✓ Aaj Tak Hindi→EN ({len(translated.split())} words)")
            time.sleep(random.uniform(0.5, 1.0))
    except Exception as e:
        print(f"    Aaj Tak error: {e}")
    return articles


def scrape_divya_bhaskar_gujarati():
    """Scrape real news from Divya Bhaskar (Gujarati) — translates to English."""
    articles = []
    print("\n  🇮🇳 [Gujarati] Divya Bhaskar...")
    try:
        r = safe_get("https://www.divyabhaskar.co.in")
        if not r:
            return articles
        soup = BeautifulSoup(r.text, "html.parser")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "divyabhaskar.co.in" in href and len(href) > 50:
                links.add(href)
            elif href.startswith("/") and len(href) > 30:
                links.add("https://www.divyabhaskar.co.in" + href)
        for url in list(links)[:15]:
            res = safe_get(url)
            if not res:
                continue
            s = BeautifulSoup(res.text, "html.parser")
            text = extract_text_from_soup(s, min_len=20)
            if len(text.split()) > 30:
                translated = translate_to_english(text)
                if len(translated.split()) > 40:
                    articles.append(translated)
                    print(f"    ✓ Divya Bhaskar Gujarati→EN ({len(translated.split())} words)")
            time.sleep(random.uniform(0.6, 1.2))
    except Exception as e:
        print(f"    Divya Bhaskar error: {e}")
    return articles


# ══════════════════════════════════════════════════════
#  FAKE NEWS SCRAPERS
# ══════════════════════════════════════════════════════

def scrape_snopes_false():
    """Scrape fact-checked false claims from Snopes (English)."""
    articles = []
    print("\n  🔴 [English] Snopes False Claims...")
    try:
        for page in range(1, 5):
            r = safe_get(f"https://www.snopes.com/fact-check/?filter=false&pagenum={page}")
            if not r:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "snopes.com/fact-check/" in href and len(href) > 40:
                    links.add(href)
            for link in list(links)[:15]:
                res = safe_get(link)
                if not res:
                    continue
                s = BeautifulSoup(res.text, "html.parser")
                text = extract_text_from_soup(s)
                if len(text.split()) > 80:
                    articles.append(text)
                    print(f"    ✓ Snopes fake ({len(text.split())} words)")
                time.sleep(random.uniform(0.5, 1.2))
    except Exception as e:
        print(f"    Snopes error: {e}")
    return articles


def scrape_politifact_false():
    """Scrape false rulings from PolitiFact (English)."""
    articles = []
    print("\n  🔴 [English] PolitiFact False Rulings...")
    try:
        for page in range(1, 4):
            r = safe_get(f"https://www.politifact.com/factchecks/list/?ruling=false&page={page}")
            if not r:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/factchecks/" in href and len(href) > 30:
                    full = "https://www.politifact.com" + href if href.startswith("/") else href
                    links.add(full)
            for link in list(links)[:15]:
                res = safe_get(link)
                if not res:
                    continue
                s = BeautifulSoup(res.text, "html.parser")
                text = extract_text_from_soup(s)
                if len(text.split()) > 80:
                    articles.append(text)
                    print(f"    ✓ PolitiFact fake ({len(text.split())} words)")
                time.sleep(random.uniform(0.5, 1.2))
    except Exception as e:
        print(f"    PolitiFact error: {e}")
    return articles


def scrape_vishvas_hindi_fake():
    """Scrape Hindi fake news from Vishvas News fact-checker — translates to English."""
    articles = []
    print("\n  🔴 [Hindi] Vishvas News Fake Claims...")
    try:
        for page in range(1, 4):
            r = safe_get(f"https://www.vishvasnews.com/viral/fake-news/?page={page}")
            if not r:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "vishvasnews.com" in href and len(href) > 50:
                    links.add(href)
            for link in list(links)[:12]:
                res = safe_get(link)
                if not res:
                    continue
                s = BeautifulSoup(res.text, "html.parser")
                text = extract_text_from_soup(s, min_len=20)
                if len(text.split()) > 40:
                    translated = translate_to_english(text)
                    if len(translated.split()) > 40:
                        articles.append(translated)
                        print(f"    ✓ Vishvas Hindi Fake→EN ({len(translated.split())} words)")
                time.sleep(random.uniform(0.5, 1.0))
    except Exception as e:
        print(f"    Vishvas Hindi error: {e}")
    return articles


def scrape_vishvas_gujarati_fake():
    """Scrape Gujarati fake news from Vishvas News — translates to English."""
    articles = []
    print("\n  🔴 [Gujarati] Vishvas News Gujarati Fake Claims...")
    try:
        for page in range(1, 3):
            r = safe_get(f"https://www.vishvasnews.com/gujarati/fake-news/?page={page}")
            if not r:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "vishvasnews.com/gujarati" in href and len(href) > 50:
                    links.add(href)
            for link in list(links)[:12]:
                res = safe_get(link)
                if not res:
                    continue
                s = BeautifulSoup(res.text, "html.parser")
                text = extract_text_from_soup(s, min_len=20)
                if len(text.split()) > 30:
                    translated = translate_to_english(text)
                    if len(translated.split()) > 40:
                        articles.append(translated)
                        print(f"    ✓ Vishvas Gujarati Fake→EN ({len(translated.split())} words)")
                time.sleep(random.uniform(0.5, 1.0))
    except Exception as e:
        print(f"    Vishvas Gujarati error: {e}")
    return articles


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  🌍 MULTI-LANGUAGE FAKE NEWS MODEL TRAINER")
    print("  Supports: English | Hindi | Gujarati | Hinglish | Gujlish")
    print("=" * 60)

    # ── Scrape FAKE news ──
    print("\n\n🔴 === SCRAPING FAKE NEWS SOURCES ===")
    fake_articles = []
    fake_articles += scrape_snopes_false()
    fake_articles += scrape_politifact_false()
    fake_articles += scrape_vishvas_hindi_fake()
    fake_articles += scrape_vishvas_gujarati_fake()
    print(f"\n✅ Total FAKE articles: {len(fake_articles)}")

    # ── Scrape REAL news ──
    print("\n\n🟢 === SCRAPING REAL NEWS SOURCES ===")
    real_articles = []
    real_articles += scrape_bbc_english()
    real_articles += scrape_reuters_english()
    real_articles += scrape_ap_english()
    real_articles += scrape_ndtv_hindi()
    real_articles += scrape_aajtak_hindi()
    real_articles += scrape_divya_bhaskar_gujarati()
    print(f"\n✅ Total REAL articles: {len(real_articles)}")

    # ── Validation ──
    if len(fake_articles) < 10 or len(real_articles) < 10:
        print("\n⚠️  Not enough data scraped!")
        print(f"   Fake: {len(fake_articles)} | Real: {len(real_articles)}")
        print("   Check your internet connection and try again.")
        exit(1)

    # Balance dataset (equal fake & real)
    min_count = min(len(fake_articles), len(real_articles))
    fake_articles = fake_articles[:min_count]
    real_articles = real_articles[:min_count]

    # ── Build DataFrame ──
    df_fake = pd.DataFrame({"text": fake_articles, "label": 0})
    df_real = pd.DataFrame({"text": real_articles, "label": 1})
    df = pd.concat([df_fake, df_real]).sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\n📊 Balanced Dataset: {len(df_fake)} fake + {len(df_real)} real = {len(df)} total")

    # Save scraped data
    df.to_csv("live_scraped_data.csv", index=False)
    print("💾 Raw data saved → live_scraped_data.csv")

    # ── Train Model ──
    print("\n🤖 Training multilingual model...")
    X = df["text"]
    y = df["label"]

    # Character + word n-grams for multilingual robustness
    vectorizer = TfidfVectorizer(
        analyzer='word',
        stop_words='english',
        max_df=0.85,
        min_df=2,
        ngram_range=(1, 2),
        max_features=50000,
        sublinear_tf=True
    )
    X_vec = vectorizer.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_vec, y, test_size=0.2, random_state=42, stratify=y
    )

    model = LogisticRegression(
        max_iter=1000,
        class_weight='balanced',
        C=1.0,
        solver='lbfgs'
    )
    model.fit(X_train, y_train)

    # ── Evaluate ──
    print("\n📈 Model Evaluation:")
    preds = model.predict(X_test)
    print(classification_report(y_test, preds, target_names=["Fake", "Real"]))

    # ── Save Model ──
    os.makedirs("model", exist_ok=True)
    pickle.dump(model, open("model/model.pkl", "wb"))
    pickle.dump(vectorizer, open("model/vectorizer.pkl", "wb"))

    print("\n" + "=" * 60)
    print("✅ Model saved → model/model.pkl & model/vectorizer.pkl")
    print("🌍 Languages supported: English, Hindi, Gujarati, Hinglish, Gujlish")
    print("🚀 Run the app: python app.py")
    print("=" * 60)