# Fake News Detection

A Flask-based fake news detection web application that analyzes news articles for authenticity using machine learning models. Features include real-time article scraping, multi-language support (English, Hindi, Gujarati, etc.), AI-powered fact-checking with Groq API, and a user-friendly web interface.

## Features

- **Machine Learning Detection**: Uses trained ML models to classify news as real or fake
- **Article Scraping**: Automatically extracts content from news URLs
- **Multi-Language Support**: Supports English, Hindi, Gujarati, Marathi, Punjabi, Bengali, Urdu, Tamil, Telugu, and more
- **AI Fact-Checking**: Integrates with Groq API for additional verification
- **Web Interface**: Clean, responsive HTML interface for easy use
- **Real-time Analysis**: Instant results with credibility scores

## Technologies Used

- **Backend**: Python, Flask
- **Machine Learning**: scikit-learn, NLTK, pandas
- **Web Scraping**: BeautifulSoup, newspaper3k, requests
- **Translation**: deep-translator, langdetect
- **AI Integration**: Groq API
- **Frontend**: HTML, CSS (minimal)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ombhudhara/fake-new-detections.git
   cd fake-new-detections
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   pip install -r Requirements.txt
   ```

3. **Set up environment variables**:
   - Copy `.env` file and add your Groq API key:
     ```
     GROQ_API_KEY=your_api_key_here
     ```

## Usage

1. **Run the application**:
   ```bash
   python app.py
   ```

2. **Open your browser** and go to `http://localhost:5000`

3. **Enter a news article URL** and click "Analyze" to get the fake news detection result

## Project Structure

```
fake-news-detection/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── train_model.py         # Model training script
│   ├── model/                 # Trained ML models
│   ├── Requirements.txt       # Python dependencies
│   ├── live_scraped_data.csv  # Sample data
│   └── .env                   # Environment variables
├── frontend/
│   └── templates/
│       └── index.html         # Web interface
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Contact

For questions or suggestions, please open an issue on GitHub.