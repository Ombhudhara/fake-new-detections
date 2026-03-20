from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import os
import sys

# --- IDE Compatibility Patch ---
# Ensures local modules like 'chatbot_engine' are found even if run from a parent folder
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from chatbot_engine import route_message, get_or_create_session
from language_manager import LANGUAGE_NAMES, detect_language, get_language_name
from chain import get_rag_chain, get_rag_response
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import sys
import logging

# Configure logging to help debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global persistent chain
rag_chain = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Modern substitute for @app.on_event("startup")
    """
    global rag_chain
    print("[INFO] Initializing RAG pipeline (this takes a few seconds)...")
    rag_chain = get_rag_chain()
    print("[SUCCESS] RAG pipeline initialized and ready.")
    yield
    # Shutdown logic if needed
    print("Shutting down API...")

app = FastAPI(title="Fake News Detection Chatbot API — Multilingual", lifespan=lifespan)

# Add CORS Middleware for development/browser testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    session_id: str
    message: str
    page: Optional[str] = "/"
    response_mode: Optional[str] = "auto"
    mode_instruction: Optional[str] = ""

class ChatResponse(BaseModel):
    session_id: str
    message: str
    quick_replies: List[str]
    use_rag: bool
    detected_language: str = "en"
    language_name: str = "English"
    is_rtl: bool = False

class LanguageSetRequest(BaseModel):
    session_id: str
    language_code: str

def get_page_context(path: Optional[str]) -> str:
    p = (path or '/').lower().strip()
    if not p.startswith('/'):
        p = '/' + p
    if len(p) > 1 and p.endswith('/'):
        p = p[:-1]

    if 'dashboard' in p and 'analytics' not in p:
        return """
CURRENT PAGE: /dashboard (The Analytics Dashboard)

When user asks to explain this page, tell them:
- This is the ANALYTICS COMMAND CENTER
- TOP: Sticky filter bar with:
    Category pills: All, Health, Politics, Finance, 
    Technology, International, Local, Deepfakes & AI
    Country dropdown (30+ countries)
    State dropdown (auto-updates per country)
    Platform: WhatsApp, Facebook, Twitter, Telegram
    Time range: Today, 7 Days, 30 Days, 3 Months
- WORLD HEATMAP: D3 interactive map — click country
    to drill down into that country's fake news data
- CHARTS: Category bars, donut chart (verification mix)
- RADAR CHARTS: Threat profile, Platform risk, 
    Vulnerability index by category
- LIVE FEED: AI-powered real-time misinformation 
    headlines, refreshes every 45 seconds
- PLATFORM BARS: Shows which platforms spread most
- MODEL CARD: ML model accuracy (84%), F1 score, 
    precision, recall, total predictions made

DO NOT tell user to paste news here — 
that feature is on the HOME page (/), not here.
DO NOT say "go to the dashboard" — user IS here.
"""

    if 'analytics' in p and 'dashboard' not in p:
        return """
CURRENT PAGE: /analytics (Deep Analytics)

When user asks to explain this page, tell them:
- This is the DEEP DATA ANALYSIS page
- VELOCITY CHART: Shows how fast fake news spreads 
    hour by hour over 24 hours
- BUBBLE CHART: Virality vs Credibility matrix — 
    shows which topics are dangerous (low cred + 
    high viral = top-left danger zone)
- HEATMAP GRID: Hour x Day activity matrix showing 
    when fake news is most active
- FUNNEL CHART: Verification pipeline — how many 
    claims make it through each verification step
- TREEMAP: Sub-topic clusters within each category
- LIFECYCLE CHART: Shows a fake news story's journey 
    from origin to viral peak to debunk to decline
- SOURCE CREDIBILITY: BBC=92%, WhatsApp=12% etc.
- SUSPICIOUS DOMAINS TABLE: Blocked/warned domains
All charts update when the filter bar changes.
"""

    if 'analytics' in p and 'dashboard' in p:
        return """
CURRENT PAGE: /analytics (Analytics Dashboard)
Combined deep analytics page with all charts.
Includes velocity, bubble, heatmap, funnel, 
treemap, lifecycle, source credibility, and 
suspicious domains table. All filter-responsive.
"""

    if 'learn' in p:
        return """
CURRENT PAGE: /learn (Media Literacy Hub)

When user asks to explain this page, tell them:
- 6 DETECTION TIPS (card grid):
    01 Check the Source
    02 Verify with 2+ Sources
    03 Watch for Sensational Headlines
    04 Check the Date
    05 Reverse Image Search
    06 Check Your Own Bias
- 6 TYPES OF MISINFORMATION:
    Fabricated, Manipulated, Satire/Parody,
    Misleading Headlines, False Context, Imposter
- FACT-CHECK RESOURCES: Snopes, AltNews, BOOM, 
    PolitiFact, Full Fact, AFP Fact Check
- INTERACTIVE QUIZ: 5 questions to test skills
    Click any answer option to start
- CTA BANNER: Link to try the detector
"""

    if 'report' in p:
        return """
CURRENT PAGE: /report (Community Report Form)

When user asks to explain this page, tell them:
- PLATFORM SELECTOR: Visual buttons to pick where 
    you saw the suspicious news (WhatsApp, Facebook, 
    Twitter, Telegram, Instagram, YouTube, Other)
- URL FIELD (required): Paste the suspicious link
- CATEGORY: Health, Politics, Finance, Technology,
    International, Local, Deepfake, Other
- DESCRIPTION: Optional — why it seems suspicious
- ANONYMOUS TOGGLE: ON by default (privacy safe)
- SUBMIT BUTTON: Generates a unique Report ID
- SIDEBAR: Tips for a good report + activity stats
"""

    return """
CURRENT PAGE: / (Home — Main Detector)

When user asks to explain this page, tell them:
- LANGUAGE PILLS: Select English, Hindi, Gujarati,
    Hinglish, or Gujlish before checking
- MODE SELECTOR:
    Short Claims: Under 60 words → live web check
    Full Articles: 60+ words → ML pattern analysis
- INPUT TABS:
    "Paste Text / Claim" → type or paste news text
    "Scrape from URL" → paste article URL
- VERIFY THIS BUTTON: Dark button at bottom — 
    click after pasting your news
- RESULT: Shows FAKE/REAL verdict + confidence % + 
    claim vs fact + which fact-checkers debunked it
This is the MAIN verification page. 
Start here to check any news claim.
"""

@app.get("/")
async def root():
    return {"status": "online", "message": "Fake News Detection Multilingual API is active."}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint handling routing and RAG pipelines.
    """
    session = get_or_create_session(request.session_id)
    
    # 1. Routing & Base Reply Generation
    engine_res = route_message(request.session_id, request.message)
    
    page_context_str = get_page_context(request.page)
    
    # 2. RAG Logic (if engine decides it's Q&A mode)
    if engine_res.get("use_rag", False):
        try:
            # Call RAG Chain
            rag_result = get_rag_response(
                rag_chain,
                request.message,
                session.chat_history,
                session.detected_language,
                page_context=page_context_str,
                response_mode=request.response_mode,
                mode_instruction=request.mode_instruction
            )
            
            # Use the RAG answer as message
            engine_res["message"] = rag_result["answer"]
        except Exception as e:
            print(f"RAG Error: {e}")
            engine_res["message"] = "I had some trouble answering that based on the article database. Could you try rephrasing?"
            engine_res["use_rag"] = False

    return engine_res

@app.get("/languages")
async def list_languages():
    """Returns the full dictionary of supported languages."""
    return LANGUAGE_NAMES

@app.post("/set-language")
async def set_language(request: LanguageSetRequest):
    """Manually override the detected language for a session."""
    session = get_or_create_session(request.session_id)
    
    if request.language_code in LANGUAGE_NAMES:
        session.detected_language = request.language_code
        session.language_name = get_language_name(request.language_code)
        session.is_rtl = request.language_code in ["ar", "he", "ur", "fa"]
        
        return {
            "session_id": request.session_id,
            "language_set": session.language_name,
            "is_rtl": session.is_rtl
        }
    else:
        raise HTTPException(status_code=400, detail="Unsupported language code.")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
