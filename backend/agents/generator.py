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


# --------- Multilingual Generator ---------
def generate_multilingual(language: str, length: int) -> str:
    try:
        words = top_n_list(language, 10000)

        # Sinhala: use custom loader if available, else Unicode fallback
        if language == "si":
            chosen_local = random_sinhala_word()
        elif not words:
            # For unsupported langs, fallback to random Unicode chars
            chosen_local = "".join(chr(random.randint(0x0D80, 0x0DFF)) for _ in range(3))
        else:
            chosen_local = random.choice(words)

        chosen_eng = random.choice(["Sky", "River", "Star", "Cloud", "Dream"])
        chosen_symbol = random.choice("!@#$%^&*()")
        chosen_number = str(random.randint(10, 9999))

        password = f"{chosen_local}{chosen_symbol}{chosen_eng}{chosen_number}"

        # Ensure required length
        while len(password) < length:
            password += random.choice(string.ascii_letters + string.digits)

        return password[:length]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multilingual Error: {str(e)}")


# --------- API Endpoint ---------
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

        return {
            "password": password,
            "length": len(password),
            "mode": options.mode,
            "language": options.language
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------- Load Sinhala Words on Startup ---------
load_sinhala_wordlist()



