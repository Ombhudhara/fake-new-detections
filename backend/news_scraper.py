import requests
from bs4 import BeautifulSoup
import concurrent.futures
from datetime import datetime
import time
import random

# 🎯 LIVE SCRAPING SOURCES MAPPING

# National News Sources (India)
NATIONAL_NEWS_SOURCES = {
    "NDTV India": "https://ndtv.in/rss/india",
    "ABP News": "https://news.abplive.com/feed",
    "Zee News": "https://zeenews.india.com/rss/india-news.xml",
    "Times of India": "https://timesofindia.indiatimes.com/rssfeeds/29473.cms",
    "India Today": "https://www.indiatoday.in/rss/home"
}

# Regional State-wise Sources (RSS Feeds)
STATE_WISE_SOURCES = {
    "Gujarat": {
        "Divya Bhaskar": "https://news.google.com/rss/search?q=site:divyabhaskar.co.in&hl=gu&gl=IN&ceid=IN:gu",
        "Sandesh": "https://news.google.com/rss/search?q=site:sandesh.com&hl=gu&gl=IN&ceid=IN:gu"
    },
    "Maharashtra": {
        "Lokmat": "https://www.lokmat.com/rss/topnews.xml",
        "Maharashtra Times": "https://maharashtratimes.com/rssfeeds/2322.cms"
    },
    "Tamil Nadu": {
        "Dinamalar": "https://news.google.com/rss/search?q=site:dinamalar.com&hl=ta&gl=IN&ceid=IN:ta"
    },
    "Kerala": {
        "Malayala Manorama": "https://www.manoramaonline.com/rss/news/latest-news.xml",
        "Mathrubhumi": "https://www.mathrubhumi.com/rss/news/latest-news"
    },
    "West Bengal": {
        "Anandabazar Patrika": "https://news.google.com/rss/search?q=site:anandabazar.com&hl=bn&gl=IN&ceid=IN:bn"
    },
    "Uttar Pradesh": {
        "Dainik Jagran": "https://news.google.com/rss/search?q=site:jagran.com&hl=hi&gl=IN&ceid=IN:hi",
        "Amar Ujala": "https://www.amarujala.com/rss/india-news.xml"
    },
    "Rajasthan": {
        "Rajasthan Patrika": "https://www.patrika.com/rss/trending/"
    },
    "Punjab": {
        "Ajit": "https://news.google.com/rss/search?q=site:ajitjalandhar.com&hl=pa&gl=IN&ceid=IN:pa"
    },
    "Bihar": {
        "Prabhat Khabar": "https://news.google.com/rss/search?q=site:prabhatkhabar.com&hl=hi&gl=IN&ceid=IN:hi"
    },
    "Delhi": {
        "Indian Express": "https://indianexpress.com/section/cities/delhi/feed/"
    }
}

# Fake News Sources (Fact-Checkers)
FAKE_NEWS_SOURCES = {
    "BOOM Live": "https://www.boomlive.in/rss.xml",
    "Alt News": "https://www.altnews.in/feed",
    "Factly": "https://factly.in/feed",
    "AFP Fact Check": "https://factcheck.afp.com/rss.xml",
    "Reuters Fact Check": "https://www.reutersagency.com/en/reuters-best/fact-check/feed/",
    "Snopes": "https://www.snopes.com/feed/",
    "PolitiFact": "https://www.politifact.com/rss/all/",
    "FactCheck.org": "https://www.factcheck.org/feed/"
}

GLOBAL_REAL_NEWS = {
    "Reuters World": "https://www.reutersagency.com/en/reuters-best/topic/world-news/feed/",
    "AP News": "https://news.google.com/rss/search?q=source:Associated+Press&hl=en-US&gl=US&ceid=US:en"
}

def scrape_any_rss(source_name, rss_url, type="REAL", state="National"):
    articles = []
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
        }
        response = requests.get(rss_url, headers=headers, timeout=12)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all("item")
            
            for item in items[:10]:
                title = item.find("title").get_text(strip=True) if item.find("title") else "Breaking News"
                link = item.find("link").get_text(strip=True) if item.find("link") else "#"
                desc = item.find("description").get_text(strip=True) if item.find("description") else ""
                pub_date = item.find("pubDate").get_text(strip=True) if item.find("pubDate") else ""
                
                clean_desc = BeautifulSoup(desc, "html.parser").get_text(strip=True) if desc else ""
                
                articles.append({
                    "title": title,
                    "source": source_name,
                    "description": clean_desc[:170] + "..." if len(clean_desc) > 170 else clean_desc,
                    "url": link,
                    "timestamp": pub_date,
                    "verdict": "REAL" if type == "REAL" else "FAKE",
                    "state": state,
                    "type": "news" if type == "REAL" else "fact-check"
                })
    except Exception as e:
        pass
    return articles

def get_integrated_news(country="India", state=None):
    """Integrated scraper that handles state/national/global as per UI filter."""
    all_news = []
    task_list = []

    # Ensure robust state detection
    if state and "Worldwide" in state:
        state = "All"

    if country == "India" or country == "Worldwide":
        if not state or state == "All":
            # National News
            for name, url in NATIONAL_NEWS_SOURCES.items():
                task_list.append((name, url, "REAL", "National"))
            
            # Plus 2 items from each state for variety
            for state_name, sources in STATE_WISE_SOURCES.items():
                for s_name, s_url in list(sources.items())[:1]:
                    task_list.append((s_name, s_url, "REAL", state_name))
            
            # Plus top fake news
            for f_name, f_url in list(FAKE_NEWS_SOURCES.items())[:4]:
                task_list.append((f_name, f_url, "FAKE", "National"))
        
        else:
            # STATE specific news
            if state in STATE_WISE_SOURCES:
                for s_name, s_url in STATE_WISE_SOURCES[state].items():
                    task_list.append((s_name, s_url, "REAL", state))
            
            # Still fetch Indian fake news for context
            for f_name, f_url in list(FAKE_NEWS_SOURCES.items())[:5]:
                task_list.append((f_name, f_url, "FAKE", state))
    
    else:
        # GLOBAL News
        for name, url in GLOBAL_REAL_NEWS.items():
            task_list.append((name, url, "REAL", "Global"))
        for f_name, f_url in list(FAKE_NEWS_SOURCES.items()):
            if "ABP" not in f_name: 
                task_list.append((f_name, f_url, "FAKE", "Global"))

    # Execute
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(scrape_any_rss, *task): task for task in task_list}
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                all_news.extend(res)
            except:
                pass

    random.shuffle(all_news)
    return all_news[:50]
