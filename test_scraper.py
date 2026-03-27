import sys
import os

# Add the backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from news_scraper import get_latest_india_news
    news = get_latest_india_news()
    print(f"Scraped {len(news)} items.")
    for n in news[:3]:
        print(f" - {n['title']} ({n['source']})")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
