from langdetect import detect, detect_langs, LangDetectException
import groq
import os
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()

# Configure Groq client
client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "gu": "Gujarati",
    "ar": "Arabic", "fr": "French", "es": "Spanish",
    "pt": "Portuguese", "de": "German", "zh-cn": "Chinese",
    "zh-tw": "Chinese Traditional", "ja": "Japanese",
    "ko": "Korean", "ru": "Russian", "it": "Italian",
    "tr": "Turkish", "bn": "Bengali", "ur": "Urdu",
    "ta": "Tamil", "te": "Telugu", "mr": "Marathi",
    "pa": "Punjabi", "ml": "Malayalam", "kn": "Kannada",
    "th": "Thai", "vi": "Vietnamese", "id": "Indonesian",
    "ms": "Malay", "nl": "Dutch", "pl": "Polish",
    "uk": "Ukrainian", "ro": "Romanian", "cs": "Czech",
    "sv": "Swedish", "da": "Danish", "fi": "Finnish",
    "hu": "Hungarian", "el": "Greek", "he": "Hebrew",
    "fa": "Persian", "no": "Norwegian", "sk": "Slovak",
}

# Translation cache shared across sessions
# translation_cache[lang_code][original_text] = translated_text
translation_cache: Dict[str, Dict[str, str]] = {}

def get_language_name(code: str) -> str:
    """Returns the full language name for an ISO code, defaulting to English."""
    return LANGUAGE_NAMES.get(code, "English")

def detect_language(text: str) -> str:
    """
    Detects the ISO language code from the given text.
    If text is too short (< 3 words) or detection fails, returns "en".
    """
    if not text or len(text.split()) < 3:
        return "en"
    
    try:
        lang_code = detect(text)
        # Ensure it's a supported code or default to en
        return lang_code if lang_code in LANGUAGE_NAMES else "en"
    except LangDetectException:
        return "en"

def translate_to_language(text: str, target_lang_code: str) -> str:
    """
    Translates text to target language using GPT-4o.
    Uses cache and fails gracefully by returning original text.
    """
    if not text or target_lang_code == "en":
        return text

    if target_lang_code not in translation_cache:
        translation_cache[target_lang_code] = {}

    if text in translation_cache[target_lang_code]:
        return translation_cache[target_lang_code][text]

    language_name = get_language_name(target_lang_code)

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": f"Translate the following text to {language_name}. Keep the same tone, formatting, and line breaks. Only return the translated text, nothing else."},
                {"role": "user", "content": text}
            ],
            temperature=0,
            max_tokens=1000
        )
        translated_text = response.choices[0].message.content.strip()
        translation_cache[target_lang_code][text] = translated_text
        return translated_text
    except Exception as e:
        print(f"Translation Error: {e}")
        return text

def get_language_instruction(lang_code: str) -> str:
    """Returns instructions for the RAG chain to respond in specific language."""
    language_name = get_language_name(lang_code)
    return f"Always respond in {language_name}. The user is communicating in {language_name}. Do not switch languages under any circumstance."

def is_supported_language(lang_code: str) -> bool:
    """Checks if a language code is in our supported list."""
    return lang_code in LANGUAGE_NAMES

def is_rtl(lang_code: str) -> bool:
    """Checks if the language is Right-to-Left."""
    return lang_code in ["ar", "he", "ur", "fa"]
