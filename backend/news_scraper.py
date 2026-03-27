import requests
from bs4 import BeautifulSoup
import concurrent.futures
from datetime import datetime
import time

# Indian News Sources (RSS Feeds)
INDIAN_NEWS_SOURCES = {
    "ABP News": "https://news.abplive.com/feed",
    "NDTV India": "https://ndtv.in/rss/india",
    "Zee News": "https://zeenews.india.com/rss/india-news.xml",
    "Times of India": "https://timesofindia.indiatimes.com/rssfeeds/29473.cms",
    "India Today": "https://www.indiatoday.in/rss/home"
}

def scrape_india_news(source_name, rss_url):
    articles = []
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(rss_url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all("item")
            
            for item in items[:10]: # Top 10 from each source
                title = item.find("title").get_text(strip=True) if item.find("title") else ""
                link = item.find("link").get_text(strip=True) if item.find("link") else ""
                desc = item.find("description").get_text(strip=True) if item.find("description") else ""
                pub_date = item.find("pubDate").get_text(strip=True) if item.find("pubDate") else ""
                
                # Clean description (remove HTML tags if any)
                clean_desc = BeautifulSoup(desc, "html.parser").get_text(strip=True) if desc else ""
                
                # Try to parse timestamp
                try:
                    # Generic RSS date format: Wed, 26 Mar 2026 10:10:35 GMT
                    # We'll just pass it as a string for now, script.js handles parsing
                    timestamp = pub_date
                except:
                    timestamp = datetime.now().isoformat()

                articles.append({
                    "title": title,
                    "source": source_name,
                    "description": clean_desc[:200] + "..." if len(clean_desc) > 200 else clean_desc,
                    "url": link,
                    "timestamp": timestamp
                })
    except Exception as e:
        print(f"Error scraping {source_name}: {e}")
    return articles

def get_latest_india_news():
    all_news = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_source = {executor.submit(scrape_india_news, name, url): name for name, url in INDIAN_NEWS_SOURCES.items()}
        for future in concurrent.futures.as_completed(future_to_source):
            try:
                source_news = future.result()
                all_news.extend(source_news)
            except Exception as e:
                print(f"Future error: {e}")
    
    # Sort by "newness" if possible, otherwise keep shuffled
    # The source_news is already sorted by freshness per source. 
    # Let's shuffle the pool to show variety
    import random
    random.shuffle(all_news)
    
    return all_news[:40] # Return top 40 across all Indian sources
