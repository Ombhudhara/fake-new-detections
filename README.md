# Fake News Detection

A Flask-based fake news detection project that combines web scraping, machine learning, multilingual support, and AI-enhanced fact-checking. It includes a Flask frontend backend, a separate chatbot backend, and a responsive frontend UI.

## What this project includes

- **Fake news classification** powered by a trained ML model
- **Article scraping** from news URLs using BeautifulSoup and newspaper3k
- **Multilingual support** for English, Hindi, Gujarati, Marathi, Punjabi, Bengali, Urdu, Tamil, Telugu, and more
- **AI fact-checking** via Groq API
- **Guided fake news chatbot backend** with conversation flow and vector search support
- **Frontend UI** for news credibility checks, dashboards, and reporting

## Technologies Used

- Python 3
- Flask
- FastAPI (chatbot backend)
- scikit-learn, pandas, NLTK
- BeautifulSoup, newspaper3k, requests
- deep-translator, langdetect
- Groq API
- ChromaDB (local vector store)
- HTML, CSS, JavaScript

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Ombhudhara/fake-new-detections.git
   cd fake-new-detections
   ```

2. Create a Python virtual environment and activate it:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r backend/Requirements.txt
   ```

4. If you want to use the chatbot backend, install its dependencies too:
   ```bash
   pip install -r fake_news_chatbot/requirements.txt
   ```

5. Configure environment variables:
    - Create `backend/.env` and `fake_news_chatbot/.env`
    - Configure the provider keys:
     ```env
       # backend/.env
     GROQ_API_KEY=your_api_key_here

       # fake_news_chatbot/.env
       OPENROUTER_API_KEY=your_openrouter_api_key_here
     ```

## Running the app

### Start the application

Start the Flask backend and chatbot API together from the project root:

```bash
python run.py
```

The backend runs at `http://localhost:5000` and the chatbot API at
`http://localhost:8000`. The launcher reuses a chatbot already responding on
port 8000 and stops any processes it started when the backend exits. Set
`PORT` or `CHATBOT_PORT` to change the default ports.

## Deploying on Render

The Flask app and chatbot API are separate services. Create two Render Web Services from this repository:

- **Flask app:** leave Root Directory blank; build with `pip install -r backend/Requirements.txt`; start with `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2`.
- **Chatbot API:** set Root Directory to `fake_news_chatbot`; build with `pip install -r requirements.txt`; start with `uvicorn api:app --host 0.0.0.0 --port $PORT`.

Set `GROQ_API_KEY` in both services. In the Flask service, set `CHATBOT_API_URL` to the chatbot service's public URL. In the chatbot service, set `FLASK_BASE_URL` to the Flask service's public URL. Redeploy both services after setting these variables.

## Project Structure

```
fake-news-detection/
+-- backend/                 # Flask fake news detector backend
�   +-- app.py
�   +-- train_model.py
�   +-- news_scraper.py
�   +-- trending_scraper.py
�   +-- fact_check_module.py
�   +-- GLOBAL_COUNTRY_KEYWORDS.py
�   +-- model/               # Saved ML model files
�   +-- Requirements.txt
�   +-- live_scraped_data.csv
�   +-- reports.csv
�   +-- stats_maximums.json
�   +-- .env
+-- fake_news_chatbot/       # Multilingual chatbot backend and RAG pipeline
�   +-- api.py
�   +-- chain.py
�   +-- chatbot_engine.py
�   +-- flow_manager.py
�   +-- language_manager.py
�   +-- ingest.py
�   +-- requirements.txt
�   +-- chroma_db/
+-- frontend/                # Static frontend assets and templates
�   +-- static/
�   �   +-- css/
�   �   +-- js/
�   �   +-- images/
�   +-- templates/
�       +-- analytics.html
�       +-- base.html
�       +-- credibility_checker.html
�       +-- dashboard.html
�       +-- index.html
�       +-- learn.html
�       +-- report.html
+-- requirements.txt         # Optional top-level dependency list
+-- runtime.txt              # Runtime config for deployment
+-- vercel.json              # Static deployment config
+-- Procfile                 # Deployment startup file
+-- README.md
```

## Notes

- The Flask app uses `frontend/templates` and `frontend/static` for UI rendering.
- `fake_news_chatbot` is a separate backend for chatbot-based fact checking and multilingual conversation flow.
- If the `LICENSE` file is missing, add one or update the license section as needed.

## Contributing

Contributions are welcome. Open a pull request or issue with suggested improvements.
