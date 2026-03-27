import time
import requests
from bs4 import BeautifulSoup
import concurrent.futures
import re
import random
from ddgs import DDGS
from GLOBAL_COUNTRY_KEYWORDS import COMPREHENSIVE_COUNTRY_KEYWORDS

# In-memory session cache
_CACHE = {
    "all_data": [],
    "timestamp": 0.0
}
CACHE_TTL = 300  # 5 minutes

SOURCES = {
    "India": {
        "Alt News": "https://www.altnews.in/feed/",
        "Boom Live": "https://www.boomlive.in/feed",
        "Factly": "https://factly.in/feed"
    },
    "USA": {
        "Snopes": "https://www.snopes.com/feed/",
        "PolitiFact": "https://www.politifact.com/rss/rulings/",
        "FactCheck.org": "https://www.factcheck.org/feed/"
    },
    "Global": {
        "AFP Fact Check": "https://factcheck.afp.com/rss/all"
    }
}

def get_fallback_global():
    """Fetch Reuters and PIB via DDGS news search effectively."""
    sources = []
    try:
        ddgs = DDGS()
        # Fetch Reuters Fact Check
        res = list(ddgs.news("site:reuters.com/fact-check", max_results=12))
        for r in res:
            sources.append({
                "title": r.get('title', ''), "link": r.get('url', ''), 
                "date": r.get('date', ''), "source": "Reuters Fact Check",
                "description": r.get('body', ''), "country": "Global"
            })
    except: pass
    
    try:
        ddgs = DDGS()
        # Fetch PIB
        res = list(ddgs.news("site:factcheck.pib.gov.in misinformation", max_results=8))
        for r in res:
            sources.append({
                "title": r.get('title', ''), "link": r.get('url', ''), 
                "date": r.get('date', ''), "source": "PIB Fact Check",
                "description": r.get('body', ''), "country": "India"
            })
    except: pass
    return sources

def scrape_rss(source_name, rss_url, country):
    results = []
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        r = requests.get(rss_url, headers=headers, timeout=10)
        if r.status_code == 200:
            soup = BeautifulSoup(r.content, "xml")
            items = soup.find_all("item")
            for item in items[:20]:
                title_tag = item.find("title")
                link_tag = item.find("link")
                desc_tag = item.find("description")
                pub_tag = item.find("pubDate")
                
                title = title_tag.get_text(strip=True) if title_tag else ""
                link = link_tag.get_text(strip=True) if link_tag else ""
                desc = desc_tag.get_text(strip=True) if desc_tag else ""
                date = pub_tag.get_text(strip=True) if pub_tag else "Just now"
                
                results.append({
                    "title": title,
                    "link": link,
                    "date": date,
                    "source": source_name,
                    "description": desc,
                    "country": country
                })
    except Exception as e:
        print(f"Error scraping {source_name}: {e}")
    return results

def detect_verdict(title):
    t = title.lower()
    if any(x in t for x in ["fake", "false", "hoax", "fabricated", "claimed falsely"]): return "Fake"
    if any(x in t for x in ["misleading", "distorted", "missing context", "clipped"]): return "Misleading"
    if any(x in t for x in ["true", "correct", "real", "accurate"]): return "True"
    return "Unverified"

def detect_country(title):
    t = title.lower()
    for country, keywords in COMPREHENSIVE_COUNTRY_KEYWORDS.items():
        for k in keywords:
            if k.lower() in t:
                return country.title()
    return "Global"

def calculate_trend_score(items):
    """Assign trend scores based on keyword overlap across items."""
    keyword_freq = {}
    for it in items:
        words = re.findall(r'\b\w{5,}\b', it['title'].lower())
        for w in words:
            keyword_freq[w] = keyword_freq.get(w, 0) + 1
    
    for it in items:
        score = 0
        words = re.findall(r'\b\w{5,}\b', it['title'].lower())
        for w in words:
            score += keyword_freq.get(w, 0)
        
        base = random.randint(40, 65)
        it['trend_score'] = min(99, base + (score * 4))
        
        t = it['title'].lower()
        if "whatsapp" in t: it['platform'] = "WhatsApp"
        elif any(x in t for x in ["video", "youtube", "clip"]): it['platform'] = "YouTube"
        elif any(x in t for x in ["twitter", " x ", "tweet"]): it['platform'] = "Twitter/X"
        else: it['platform'] = random.choice(["Facebook", "Web Feed", "Instagram"])
        
        it['verdict'] = detect_verdict(it['title'])
        if it.get('country') == "Global" or not it.get('country'):
            it['country'] = detect_country(it['title'])

def fetch_live_data():
    all_raw = []
    tasks = []
    for country, sources in SOURCES.items():
        for name, url in sources.items():
            tasks.append((name, url, country))
                
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(scrape_rss, n, u, c): n for n, u, c in tasks}
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                if res: all_raw.extend(res)
            except: pass
            
    all_raw.extend(get_fallback_global())
    calculate_trend_score(all_raw)
    return all_raw

def get_trending_data(country="all", topic=None, force_refresh=False):
    global _CACHE
    now = time.time()
    
    cached_data = _CACHE.get("all_data", [])
    cached_ts = float(_CACHE.get("timestamp", 0.0))
    
    if not cached_data or force_refresh or (now - cached_ts > CACHE_TTL):
        fresh_data = fetch_live_data()
        _CACHE["all_data"] = fresh_data
        _CACHE["timestamp"] = now
    
    data = _CACHE["all_data"]
    
    # Filter Logic
    filtered = []
    c_target = country.lower() if country else "all"
    
    # Country Mapping
    mapping = {"in": "india", "us": "usa", "gb": "united kingdom"}
    c_target = mapping.get(c_target, c_target)

    for d in data:
        match = True
        if c_target != "all":
            if d["country"].lower() != c_target:
                match = False
        
        if match and topic:
            t_low = topic.lower()
            if t_low not in d["title"].lower() and t_low not in d.get("description", "").lower():
                match = False
        
        if match:
            filtered.append(d)
            
    # Formatting
    final_output = []
    # Sort by trend score for global visibility
    sorted_filtered = sorted(filtered, key=lambda x: x.get('trend_score', 0), reverse=True)
    
    for d in sorted_filtered[:40]:
        final_output.append({
            "title": d["title"],
            "verdict": d.get("verdict", "Unverified"),
            "source": d["source"],
            "date": d.get("date", "Just now")[:25],
            "url": d["link"],
            "country": d["country"],
            "platform": d.get("platform", "Web"),
            "trend_score": d.get("trend_score", 50),
            "fake_score": d.get("trend_score", 50) 
        })
    return final_output
