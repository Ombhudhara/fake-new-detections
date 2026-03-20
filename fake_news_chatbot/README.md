# Fake News Detection Chatbot — Multilingual Backend

A complete production-ready backend for a Fake News Detection Chatbot with a special guided conversation flow and full multilingual support for over 40+ languages.

## 🚀 Key Features

- **Guided Conversation Flow**: A 4-path wizard system for news verification, reporting, education, and trends.
- **Multilingual Support**: Automatic language detection and dynamic translation for guided flow and RAG answers.
- **RAG Pipeline**: Powered by LangChain, ChromaDB, and OpenAI GPT-4o for accurate, context-aware fact-checking.
- **Interactive API**: FastAPI server for easy integration with any frontend.
- **Searchable Vector Database**: Local ChromaDB using multilingual embeddings (`all-MiniLM-L6-v2`).

## 🌍 Multilingual System

The chatbot uses a 3-layer language system:

1. **Layer 1: Language Detection**: On every incoming message, language is detected using `langdetect`.
- **Layer 2: Guided Flow Translation**: Hardcoded guided flow messages are dynamically translated via Groq to the user's detected language.
- **Layer 3: RAG Answer Language Instruction**: The RAG chain is instructed to respond in the user's detected language natively.

**Supported languages:** English, Hindi, Gujarati, Arabic, French, Spanish, Chinese, Japanese, and 40+ more.

## 🛠️ Tech Stack

- **Framework**: FastAPI (API Server), LangChain (Orchestration)
- **AI Models**: Groq Llama-3.3-70b (LLM), HuggingFace `all-MiniLM-L6-v2` (Embeddings)
- **Vector DB**: ChromaDB (Memory-based persistence)
- **Detection & Translation**: `langdetect`, `groq`
- **Utilities**: `python-dotenv`, `pydantic-v2`, `WebBaseLoader`

## 📂 Project Structure

```text
fake_news_chatbot/
├── .env                  ← Environment variables (Groq/LangChain)
├── requirements.txt      ← Python dependencies
├── README.md             ← This file
├── ingest.py             ← Scrapes & populated the vector database
├── language_manager.py   ← Handles language detection & caching
├── flow_manager.py       ← Defines the wizard path logic
├── chatbot_engine.py     ← Routing & coordination logic
├── chain.py              ← The LangChain RAG pipeline
├── api.py                ← FastAPI REST endpoints
└── chroma_db/            ← Local persistent vector storage
```

## ⚙️ Initial Setup

1. **Clone & Setup Environment:**
   ```bash
   cd fake_news_chatbot
   # Install dependencies
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   Edit the `.env` file and set your `GROQ_API_KEY`.

3. **Ingest Initial Data (Optional - Seed Articles):**
   ```bash
   python ingest.py
   ```

4. **Run the API Server:**
   ```bash
   python api.py
   ```
   *Server will run at `http://localhost:8000`*

## 🛣️ API Endpoints

- `POST /chat`: Main message endpoint. `{ "session_id": "...", "message": "..." }`
- `GET /languages`: Returns a list of all supported ISO language codes and names.
- `POST /set-language`: Manually override the detected language. `{ "session_id": "...", "language_code": "hi" }`

## 🔄 Multilingual Edge Cases Handled

- **Mixed language detection**: Defaults to session history if ambiguous.
- **Short response handling**: Keeps existing session language for words like "Yes" or "Okay".
- **RTL Support**: Detects Arabic, Hebrew, Urdu, and Persian for frontend RTL UI toggling.
- **Translation caching**: Caches repetitive translations to minimize API costs and latency.
