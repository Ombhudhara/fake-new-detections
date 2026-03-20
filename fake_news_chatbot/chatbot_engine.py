import os
import sys

# --- IDE/Linter Path Adjustment ---
# Ensures local modules like 'language_manager' are correctly found
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from language_manager import detect_language, translate_to_language, get_language_name, is_rtl
from flow_manager import SessionState, FLOW_RESPONSES
from typing import Dict, Any, List, Optional
import uuid

# In-memory session storage (can be replaced by Redis/DB later)
sessions: Dict[str, SessionState] = {}

def get_or_create_session(session_id: str) -> SessionState:
    if session_id not in sessions:
        sessions[session_id] = SessionState(session_id=session_id)
    return sessions[session_id]

def build_response(session: SessionState, message: str, quick_replies: Optional[List[str]] = None, use_rag: bool = False) -> Dict[str, Any]:
    """Helper to build and translate response before sending."""
    raw_message = message
    raw_replies = quick_replies or []
    
    # Translate to detected language if not English
    translated_message = translate_to_language(raw_message, session.detected_language)
    translated_replies = [translate_to_language(reply, session.detected_language) for reply in raw_replies]
    
    return {
        "session_id": session.session_id,
        "message": translated_message,
        "quick_replies": translated_replies,
        "use_rag": use_rag,
        "detected_language": session.detected_language,
        "language_name": session.language_name,
        "is_rtl": is_rtl(session.detected_language)
    }

def transition_to_free_qa(session: SessionState) -> Dict[str, Any]:
    """Switch user to RAG-powered Q&A mode."""
    session.is_free_qa = True
    session.current_path = None
    session.current_step = 0
    
    msg = "I've unlocked the Free Q&A Mode for you! You can now ask me any questions about fake news, verification techniques, or recent fact-checks."
    replies = ["How to check a source?", "Verify an article", "Main Menu"]
    
    return build_response(session, msg, replies, use_rag=True)

def route_message(session_id: str, user_message: str) -> Dict[str, Any]:
    """Primary routing engine for the chatbot."""
    session = get_or_create_session(session_id)
    
    # 1. Detect language from incoming message
    lang_code = detect_language(user_message)
    
    # 2. Update session language (if message is long enough)
    if not user_message.lower().strip() in ["cancel", "no", "yes", "stop", "go back"]:
        # Only update if current detected language is default OR it's a long message
        if len(user_message.split()) >= 3 or session.detected_language == "en":
            session.detected_language = lang_code
            session.language_name = get_language_name(lang_code)

    # 3. Translate user message to English for routing logic
    english_msg = translate_to_language(user_message, "en").strip().lower()
    msg = english_msg
    
    # Update chat history
    session.chat_history.append({"role": "user", "content": user_message})

    # 4. Handle Routing
    
    # Global Keywords
    if "main menu" in msg or "start over" in msg or ("re-detect" in msg and "language" in msg):
        session.current_path = None
        session.current_step = 0
        session.is_free_qa = False
        res = build_response(session, FLOW_RESPONSES["welcome"]["message"], FLOW_RESPONSES["welcome"]["quick_replies"])
        session.chat_history.append({"role": "assistant", "content": res["message"]})
        return res

    if "free q&a" in msg or "ask a question" in msg:
        return transition_to_free_qa(session)

    # Path Initialization if no path set
    if session.current_path is None and not session.is_free_qa:
        # ── VerifyBot Inline News Detection ──────────────────────
        # Trigger phrases that signal the user wants news checked in chat
        NEWS_TRIGGER_PHRASES = [
            "is this fake", "is this true", "check this", "verify this",
            "fact check", "fact-check", "i heard that", "someone sent me",
            "whatsapp forward", "i saw on facebook", "i saw on twitter",
            "i saw on instagram", "kya ye sach hai", "ye fake hai kya",
            "sach batao", "fact check karo", "is it true", "real or fake",
            "fake or real", "check karo", "check kar", "ye sach hai kya",
        ]
        is_news_trigger = any(phrase in msg for phrase in NEWS_TRIGGER_PHRASES)

        # Also detect long news-like text (>15 words) pasted directly
        word_count = len(user_message.split())
        is_long_news_text = word_count > 15 and not any(
            nav in msg for nav in ["how to use", "how do i", "where is", "what is the website", "open dashboard"]
        )

        if is_news_trigger or is_long_news_text:
            # Route directly to VerifyBot RAG mode for inline analysis
            return transition_to_free_qa(session)

        if any(kw in msg for kw in ["verify", "check article", "detector", "check a news"]):
            session.current_path = "verify_article"
            session.current_step = 0
        elif any(kw in msg for kw in ["report", "fake news report", "suspicious"]):
            session.current_path = "report_news"
            session.current_step = 0
        elif any(kw in msg for kw in ["learn", "how to spot", "spotting", "tips", "red flag"]):
            session.current_path = "learn_spotting"
            session.current_step = 0
        elif any(kw in msg for kw in ["trend", "latest", "recent"]):
            session.current_path = "news_trends"
            session.current_step = 0
        else:
            # First message or unknown
            if not session.chat_history or len(session.chat_history) <= 1:
                res = build_response(session, FLOW_RESPONSES["welcome"]["message"], FLOW_RESPONSES["welcome"]["quick_replies"])
            else:
                # If unknown but session exists, suggest RAG
                return transition_to_free_qa(session)
            
            session.chat_history.append({"role": "assistant", "content": res["message"]})
            return res


    # Guided Flow Advancement
    if session.current_path and not session.is_free_qa:
        path_data = FLOW_RESPONSES[session.current_path]
        step_idx = session.current_step
        
        # Move to next step if possible
        if step_idx < len(path_data):
            current_response = path_data[step_idx]
            session.current_step += 1
            
            # If we reached the end of a path
            if session.current_step >= len(path_data):
                # Optionally switch to Free Q&A after the final message in some paths
                if session.current_path in ["news_trends", "learn_spotting"]:
                    session.is_free_qa = True
                
            res = build_response(session, current_response["message"], current_response["quick_replies"])
            session.chat_history.append({"role": "assistant", "content": res["message"]})
            return res
        else:
            # Path exhausted, move to Free Q&A
            return transition_to_free_qa(session)

    # RAG Mode
    if session.is_free_qa:
        # Signify that chain should be used
        return build_response(session, "Using RAG Mode", use_rag=True)

    # Fallback
    res = build_response(session, FLOW_RESPONSES["welcome"]["message"], FLOW_RESPONSES["welcome"]["quick_replies"])
    session.chat_history.append({"role": "assistant", "content": res["message"]})
    return res
