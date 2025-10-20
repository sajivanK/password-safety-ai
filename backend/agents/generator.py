import random
import string
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from wordfreq import top_n_list

# Configure Gemini (API key must be set in environment)
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter()

# --------- Sinhala Wordlist Loader ---------
SINHALA_WORDLIST = []

def load_sinhala_wordlist():
    """Load Sinhala words from sinhala_words.txt if available"""
    global SINHALA_WORDLIST
    try:
        if os.path.exists("sinhala_words.txt"):
            with open("sinhala_words.txt", "r", encoding="utf-8") as f:
                SINHALA_WORDLIST = [w.strip() for w in f.readlines() if w.strip()]
            print(f"✅ Loaded {len(SINHALA_WORDLIST)} Sinhala words")
        else:
            print("⚠️ Sinhala wordlist not found. Using Unicode fallback.")
    except Exception as e:
        print(f"⚠️ Failed to load Sinhala wordlist: {e}")


def random_sinhala_word(length: int = 3) -> str:
    """Generate Sinhala from wordlist if available, otherwise random Unicode."""
    if SINHALA_WORDLIST:
        return random.choice(SINHALA_WORDLIST)
    # Fallback: Unicode random chars
    return "".join(chr(random.randint(0x0D80, 0x0DFF)) for _ in range(length))


# --------- Input Schema ---------
class GeneratorInput(BaseModel):
    length: int = 12
    uppercase: bool = True
    lowercase: bool = True
    numbers: bool = True
    symbols: bool = True
    mode: str = "deterministic"   # deterministic | llm | multilingual
    language: str | None = None   # e.g. "ta"=Tamil, "si"=Sinhala, "fr"=French


# --------- Deterministic Generator ---------
def generate_deterministic(options: GeneratorInput) -> str:
    pool = ""
    if options.uppercase:
        pool += string.ascii_uppercase
    if options.lowercase:
        pool += string.ascii_lowercase
    if options.numbers:
        pool += string.digits
    if options.symbols:
        pool += "!@#$%^&*()-_=+[]{};:,.<>?/"

    if not pool:
        raise HTTPException(status_code=400, detail="No character sets selected")

    return "".join(random.choice(pool) for _ in range(options.length))


# --------- Gemini Passphrase Generator ---------
def generate_llm_passphrase(options: GeneratorInput) -> str:
    try:
        prompt = f"""
        Generate a secure but memorable password or passphrase.
        Rules:
        - Minimum {options.length} characters
        - Must include uppercase, lowercase, numbers, and symbols
        - Each time, use a *different style*, not just Color+Animal
        - Possible styles: sci-fi, fantasy, tech, random words, objects, verbs, mythological names
        - Do not repeat the same format in every generation
        - Return ONLY the password, nothing else.

        Examples:
        - Moon$Stream!1987
        - CyberWolf@Galaxy42
        - Iron_Shield!Future909
        - Neon-Dragon#Sky88
        - PixelStorm*Vault3000
        """

        #model = genai.GenerativeModel("gemini-1.5-flash")
        model = genai.GenerativeModel("gemini-flash-latest")

        response = model.generate_content(prompt)

        password = response.text.strip()
        return password

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {str(e)}")


# --------- Multilingual Generator (AI-generated, transliterated, plus English) ---------
def generate_multilingual(language: str, length: int) -> str:
    try:
        model = genai.GenerativeModel("gemini-flash-latest")

        # Map language codes to names
        lang_map = {
            "ta": "Tamil",
            "si": "Sinhala",
            "fr": "French",
            "ar": "Arabic",
            "hi": "Hindi",
            "es": "Spanish",
            "zh": "Chinese"
        }
        lang_name = lang_map.get(language, language)

        # AI prompt: generate one local word + one English word
        prompt = f"""
        Generate ONE {lang_name} word transliterated into English letters.
        Then select ONE meaningful English word.
        Combine them with a symbol (#,@,$,%,*,!) and append a 2-4 digit number at the end.
        Return ONLY the password, nothing else.
        Example outputs:
        - amma#Sky2025
        - api@River4312
        - pema$Star987
        """

        response = model.generate_content(prompt)
        password = response.text.strip()

        # Ensure symbol exists
        if not any(c in "!@#$%^&*()" for c in password):
            symbol = random.choice("!@#$%^&*()")
            password = f"{password}{symbol}"

        # Ensure number exists
        if not any(c.isdigit() for c in password):
            number = str(random.randint(10, 9999))
            password = f"{password}{number}"

        # Ensure requested length
        while len(password) < length:
            password += random.choice(string.ascii_letters + string.digits)

        return password[:length]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multilingual AI Error: {str(e)}")

# --------- API Endpoint ---------
# --------- Language code map ---------
LANG_FULLNAME = {
    "ta": "Tamil",
    "si": "Sinhala",
    "fr": "French",
    "ar": "Arabic",
    "hi": "Hindi",
    "es": "Spanish",
    "zh": "Chinese"
}

@router.post("/create-password")
def create_password(options: GeneratorInput):
    try:
        if options.mode == "deterministic":
            password = generate_deterministic(options)
        elif options.mode == "llm":
            password = generate_llm_passphrase(options)
        elif options.mode == "multilingual":
            if not options.language:
                raise HTTPException(status_code=400, detail="Language required for multilingual mode")
            password = generate_multilingual(options.language, options.length)
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid mode. Use 'deterministic', 'llm', or 'multilingual'."
            )

        # Map language code to full name if available
        full_language_name = LANG_FULLNAME.get(options.language, options.language)

        return {
            "password": password,
            "length": len(password),
            "mode": options.mode,
            "language": full_language_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------- Load Sinhala Words on Startup ---------
load_sinhala_wordlist()



