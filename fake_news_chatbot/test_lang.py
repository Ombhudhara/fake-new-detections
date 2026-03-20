import os
import sys

# Ensure local modules are found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from language_manager import detect_language, get_language_name

# Force UTF-8 for output
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

test_cases = [
    ("Check this article", "en"),
    ("यह लेख चेक करो", "hi"),
    ("هل هذا الخبر حقيقي", "ar"),
    ("Vérifier cet article", "fr"),
    ("આ સમાચાર તપાસો", "gu")
]

for text, expected in test_cases:
    detected = detect_language(text)
    name = get_language_name(detected)
    print(f"Text: {text} | Detected: {detected} ({name}) | Expected: {expected}")
