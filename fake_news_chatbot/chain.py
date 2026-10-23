import os
import sys

# --- IDE/Linter Path Adjustment ---
# Ensures local modules like 'language_manager' are correctly found
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from language_manager import get_language_instruction
from typing import List, Any, Dict
from dotenv import load_dotenv

# Load .env from chatbot, backend, and repository root
load_dotenv(os.path.join(current_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(current_dir), ".env"))
load_dotenv(os.path.join(os.path.dirname(current_dir), "backend", ".env"))


def get_rag_chain():
    """
    Initializes and returns all RAG components (vectorstore + LLM).
    Returns a dict with 'vectorstore' and 'llm', or None if unavailable.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    # If openrouter_key starts with gsk_, it is actually a Groq key
    if openrouter_key and openrouter_key.startswith("gsk_") and not groq_key:
        groq_key = openrouter_key
        openrouter_key = None

    llm = None

    # Try Groq first if key starts with gsk_ or GROQ_API_KEY is available
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            llm = ChatGroq(
                model_name="llama-3.3-70b-versatile",
                temperature=0,
                api_key=groq_key
            )
        except Exception as e:
            print(f"[Chatbot] Groq init notice: {e}")

    # Try OpenRouter if not initialized yet
    if llm is None and openrouter_key and not openrouter_key.startswith("gsk_"):
        try:
            llm = ChatOpenAI(
                model="meta-llama/llama-3.3-70b-instruct",
                temperature=0,
                api_key=openrouter_key,
                base_url="https://openrouter.ai/api/v1",
            )
        except Exception as e:
            print(f"[Chatbot] OpenRouter init notice: {e}")

    # Fallback to whatever key is present
    if llm is None:
        any_key = openrouter_key or groq_key
        if any_key:
            try:
                llm = ChatOpenAI(
                    model="meta-llama/llama-3.3-70b-instruct",
                    temperature=0,
                    api_key=any_key,
                    base_url="https://openrouter.ai/api/v1",
                )
            except Exception:
                llm = None

    # Load or create vector store gracefully
    vectorstore = None
    try:
        persist_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        if os.path.exists(persist_directory):
            vectorstore = Chroma(
                persist_directory=persist_directory,
                embedding_function=embeddings
            )
        else:
            vectorstore = Chroma(
                embedding_function=embeddings,
                persist_directory=persist_directory
            )
    except Exception as e:
        print(f"[Chatbot] Note: Vectorstore/embeddings deferred ({e}). Running with direct LLM intelligence.")

    if llm is None:
        return None

    return {"vectorstore": vectorstore, "llm": llm}


def get_rag_response(
    chain_components: Any, 
    question: str, 
    history: List[Dict[str, Any]], 
    lang_code: str,
    page_context: str = "CURRENT PAGE: Home (/)",
    response_mode: str = "auto",
    mode_instruction: str = ""
) -> Dict[str, Any]:
    """
    Performs a RAG query using the provided question, chat history, and language.
    """
    if not chain_components or not chain_components.get("llm"):
        return {
            "answer": "I'm VerifyBot! I can guide you through verifying news claims, checking credibility, and using our analytics dashboard. How can I help you?",
            "sources": []
        }

    vectorstore = chain_components.get("vectorstore")
    llm = chain_components["llm"]
    lang_instruction = get_language_instruction(lang_code)

    # Retrieve relevant documents if vectorstore available
    context = ""
    if vectorstore:
        try:
            retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
            docs = retriever.invoke(question)
            context = "\n\n".join([doc.page_content for doc in docs]) if docs else "No specific articles found in the database."
        except Exception:
            context = "The Fake News Detector uses machine learning and AI fact-checking to verify claims."
    else:
        context = "The Fake News Detector uses machine learning and AI fact-checking to verify claims."
    # Build message history for prompt (last 10 messages)
    messages = []
    start_idx = max(0, len(history) - 10)
    
    # Use range loop to avoid slicing which can trip up some type checkers
    for i in range(start_idx, len(history)):
        entry = history[i]
        role = entry.get("role", "user")
        content = entry.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    # Build the prompt
    system_prompt = f"""You are a helpful, conversational AI assistant with two strengths:
1) you can talk naturally about general topics like programming, learning, technology, science, business, writing, and everyday questions;
2) you also know how The Fake News Detector website works and can explain its pages, features, and functionality.

Follow these rules:

RULE 1 — GENERAL CONVERSATION IS ALWAYS ALLOWED
If the user asks about programming, education, technology, AI, productivity, health, business, science, writing, or everyday life, answer naturally and helpfully.
Do not restrict the response to website-only topics.

RULE 2 — WEBSITE KNOWLEDGE REMAINS AVAILABLE
If the user asks about the platform, pages, features, services, or how the website works, answer using the site context below.
Examples: "what is this page", "how does the dashboard work", "what features do you offer", "how do I report news", "what is this website for".

RULE 3 — CONTEXT-AWARE FOLLOW-UP
Keep track of prior messages in the conversation. If the user references earlier context, remember it and answer accordingly.
Examples: "as we discussed earlier", "what did I ask before?", "can you expand on that?"

RULE 4 — CLARIFY WHEN NEEDED
If the user question is ambiguous, ask one concise clarifying question instead of guessing.

RULE 5 — READABLE RESPONSE FORMAT
Use paragraphs, bullet points, numbered steps, or code blocks when helpful.
Keep responses clear, natural, and human-like.

RULE 6 — WEBSITE-SPECIFIC PAGE GUIDANCE
If the user asks about a page, use the CURRENT PAGE context at the end of this prompt and answer only about that page.
Do not mention the wrong page if they are already on a different one.

RULE 7 — RESPONSE LENGTH
- Short questions: brief but complete answers.
- Complex questions: clear explanations with structure.
- General help: helpful, natural conversation with examples when useful.

RULE 8 — LANGUAGE
Match the user’s language or a comfortable mixed-language style when appropriate.

You are VerifyBot, an AI assistant for The Fake News Detector website and a capable general-purpose conversation partner.

## IDENTITY
Name: VerifyBot
Role: AI assistant, site guide, and general conversational helper
Style: friendly, intelligent, helpful, conversational, and clear

## WEBSITE OVERVIEW
The Fake News Detector has 5 main pages:

PAGE 1 — HOME (/)
  Main detector — paste news text or URL → get result
  Supports: Short Claims + Full Articles
  Languages: English, Hindi, Gujarati, Hinglish, Gujlish

PAGE 2 — DASHBOARD (/dashboard)
  Analytics command center with:
  - World heatmap (click any country)
  - Category filters, country/state filters
  - Platform filters (WhatsApp, Facebook etc.)
  - Live misinformation feed
  - Radar charts, donut chart, trend lines
  - Model Intelligence Card (ML stats)

PAGE 3 — ANALYTICS (/analytics)
  Deep data analysis:
  - Velocity chart, bubble chart, heatmap grid
  - Funnel, treemap, lifecycle timeline
  - Source credibility index
  - Suspicious domains table

PAGE 4 — LEARN (/learn)
  Media literacy education:
  - 6 detection tips, 6 misinformation types
  - Fact-check resources (Snopes, AltNews etc.)
  - Interactive 5-question quiz

PAGE 5 — REPORT (/report)
  Community reporting of suspicious news:
  - Platform selector, URL field, category, description
  - Anonymous submission, unique Report ID

## GENERAL ASSISTANT MODE
You can answer questions about:
- programming and software development
- AI, machine learning, and data
- education, study tips, and explanations
- technology and digital literacy
- productivity, writing, and research
- everyday life and practical advice

When a question is unrelated to the website, do not refuse it. Answer usefully and naturally.

## WEBSITE HELP MODE
When the user asks to explain the site:
- answer with the specific page structure and purpose
- explain practical actions users can take
- keep it grounded in the current page context
- avoid generic phrasing such as “what would you like to explore?”

## NEWS CHECKING MODE
For suspicious or news-like text, still offer a quick evaluation or guidance, but do not let that block normal general conversation.

## CONTEXT FROM KNOWLEDGE BASE
If retrieved content is relevant, use it to answer accurately.
If the context is not relevant, rely on general knowledge.
If a question is unclear, ask a short clarifying question.

---
{context}
---

CURRENT SESSION CONTEXT:
Page: {page_context}
Language: {lang_code}
Response mode: {response_mode}
{mode_instruction}

LANGUAGE INSTRUCTION:
{lang_instruction}

Always answer in a way that feels helpful, natural, and conversational.
"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}")
    ])

    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({
        "chat_history": messages,
        "question": question
    })

    return {"answer": answer}
