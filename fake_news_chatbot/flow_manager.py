from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

@dataclass
class SessionState:
    session_id: str
    current_path: Optional[str] = None
    current_step: int = 0
    chat_history: List[Dict[str, str]] = field(default_factory=list)
    is_free_qa: bool = False
    is_rtl: bool = False
    detected_language: str = "en"
    language_name: str = "English"

# Flow paths and steps
FLOW_RESPONSES = {
    "welcome": {
        "message": (
            "Hi! I'm VerifyBot 👋 — your AI guide and mini fact-checker for The Fake News Detector!\n\n"
            "I can help you:\n"
            "🔍 CHECK NEWS — Paste any news here in chat and I'll tell you if it looks fake or real!\n"
            "🌐 FIND REAL NEWS — I'll point you to the right verified sources\n"
            "📊 UNDERSTAND ANALYTICS — Decode the dashboard data\n"
            "📝 REPORT FAKE NEWS — Guide you through reporting suspicious content\n"
            "📚 LEARN — Understand how to spot misinformation yourself\n\n"
            "💡 NEW: Just paste any WhatsApp forward, headline, or news claim directly here — I'll analyze it instantly!\n\n"
            "What would you like to do today? 😊"
        ),
        "quick_replies": ["Check a News Claim", "Verify an Article", "Report Fake News", "Learn to Spot Fake News", "Latest News Trends"]
    },
    "verify_article": [
        {
            "message": "I can help verify if an article might be fake. Please provide the link or the full text of the article you'd like me to check.",
            "quick_replies": ["Cancel"]
        },
        {
            "message": "Thank you. Our system is now analyzing the source, sentiment, and cross-referencing with known fact-checks. This may take a moment. Do you have any specific concerns about this source?",
            "quick_replies": ["Source seems biased", "Facts look suspicious", "Headline is sensational"]
        },
        {
            "message": "Analysis complete! Based on our initial scan, this article shows high indicators of being trustworthy. However, always exercise caution. Would you like to check another article or move into the Free Q&A mode?",
            "quick_replies": ["Check another", "Free Q&A Mode"]
        }
    ],
    "report_news": [
        {
            "message": "Thank you for being proactive in fighting misinformation! Please describe the suspicious news item and where you saw it.",
            "quick_replies": ["Cancel"]
        },
        {
            "message": "Got it. Please provide a link (if available) so our fact-checking team can review it. This helps protect the community.",
            "quick_replies": ["Provide Link"]
        },
        {
            "message": "Your report has been submitted to our database! We will alert other users if we find evidence of misinformation. What would you like to do next?",
            "quick_replies": ["Verify an Article", "Free Q&A Mode"]
        }
    ],
    "learn_spotting": [
        {
            "message": "Education is the best defense! Do you want to learn about general verification techniques or see common signs of fake news?",
            "quick_replies": ["Verification Tips", "Common Red Flags"]
        },
        {
            "message": "Great choice! One major tip: Always check if the same story is being reported by other reputable news outlets. If only one site has it, be skeptical. Ready for more tips?",
            "quick_replies": ["Show More", "Exit to Q&A"]
        },
        {
            "message": "You can also check the author's track record and the 'About Us' section of the site. Many fake sites mimic real names but have subtle differences (like .co instead of .com). Should we try some actual RAG-powered Q&A?",
            "quick_replies": ["Let's do Q&A", "Go Back to Start"]
        }
    ],
    "news_trends": [
        {
            "message": "The latest trends in misinformation often revolve around health, politics, and emerging technologies. Would you like to see current hot topics?",
            "quick_replies": ["Show Trends", "Go back"]
        },
        {
            "message": "Current trending misinformation includes AI-generated deepfakes of public figures and misattributed historical quotes. Do you want tips on spotting AI deepfakes specifically?",
            "quick_replies": ["Spotting Deepfakes", "General Trends"]
        },
        {
            "message": "Deepfakes often have 'artifacts' like unnatural blinking or inconsistent lighting. I've switched your account to Free Q&A mode so you can ask me anything about these topics!",
            "quick_replies": ["Ask a Question", "Main Menu"]
        }
    ]
}

def get_next_step(session: SessionState, user_message: str) -> Dict[str, Any]:
    """Basic routing logic for the guided flow. Actual logic is currently in chatbot_engine.py"""
    return {} # Placeholder as per current architecture
