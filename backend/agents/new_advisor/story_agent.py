# backend/agents/new_advisor/story_agent.py
"""
🧠 Story Agent — Habit-based, human stories for password recall (Gemini)
- Splits a password into safe tokens (letters / numbers / symbols).
- Sends only these abstract hints to Gemini (never the raw password).
- Gemini returns a human, everyday-habit style story which preserves the
  order of tokens as clues (letters => mapped friendly name/word,
  symbols => words like "at" or "hash road", numbers => years/dates/times).
- Story is encrypted at rest and linked to user.
- If Gemini is unavailable, a deterministic local fallback builds a readable story.

SECURITY: raw password characters are NEVER sent to Gemini.
"""

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional
import os, re, hashlib
import google.generativeai as genai
from bson import ObjectId
from datetime import datetime, timezone

from database import db
from . import pattern_agent
from crypto_utils import encrypt_text, decrypt_text
from auth_utils import decode_token  # 🆕 for /latest/me

router = APIRouter()

# Configure Gemini (main also configures; this is a safe attempt)
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
except Exception as e:
    print("⚠️ Gemini not configured in story_agent:", e)

MN_COLL = db["mnemonics"]
MN_COLL.create_index([("userId", 1), ("createdAt", -1)], background=True)

# ---------- Models ----------
class PreviewIn(BaseModel):
    password: str = Field(..., min_length=1, max_length=1024)

class SaveIn(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=1, max_length=1024)

class LatestOut(BaseModel):
    story: Optional[str] = None

# ---------- Tokenization ----------
def split_password_secure(pwd: str) -> List[Dict]:
    """
    Split into ordered tokens:
      - letters sequences
      - digit sequences
      - symbol sequences
    Returns list of {"type": "letters"|"number"|"symbols", "raw": "<segment>"}
    raw is kept only locally for mapping; never sent to LLM.
    """
    parts = re.findall(r"[A-Za-z]+|\d+|[^A-Za-z0-9]+", pwd)
    tokens = []
    for p in parts:
        if p.isalpha():
            tokens.append({"type": "letters", "raw": p})
        elif p.isdigit():
            tokens.append({"type": "number", "raw": p})
        else:
            tokens.append({"type": "symbols", "raw": p})
    return tokens

# ---------- Deterministic mapping helpers (we send only the HINTS to Gemini) ----------
_WORD_LIST = [
    "Nimal","Siri","Kamal","Sunil","Rani","Meera","Ravi","Anu","Pawan","Maya",
    "Lanka","Ocean","Blue","Cedar","Lotus","River","Hill","Harbor","Forest","Pearl"
]

def _map_letters_to_name(segment: str) -> str:
    """
    Map a letters-segment deterministically to a common-sounding name or word.
    We will send this NAME as a hint to Gemini (NOT the letters).
    """
    h = hashlib.sha256(segment.encode("utf-8")).digest()
    idx = h[0] % len(_WORD_LIST)
    name = _WORD_LIST[idx]
    case = "title" if segment[:1].isupper() and segment[1:].islower() else \
           "upper" if segment.isupper() else \
           "lower" if segment.islower() else "mixed"
    return f"{name} ({len(segment)} letters, {case})"

_SYMBOL_MAP = {
    "@": "at",
    "#": "hash",
    "$": "dollar",
    "%": "percent",
    "&": "and",
    "*": "star",
    "!": "bang",
    "?": "question",
    "-": "dash",
    "_": "underscore",
    "+": "plus",
    "=": "equals",
    "/": "slash",
    "\\": "backslash",
    ":": "colon",
    ";": "semicolon",
    ".": "dot",
    ",": "comma",
    "~": "tilde",
    "`": "backtick",
    "(": "paren",
    ")": "paren",
    "[": "bracket",
    "]": "bracket",
    "{": "brace",
    "}": "brace",
    "<": "less",
    ">": "greater",
    "|": "bar",
    '"': "quote",
    "'": "quote",
}

def _map_symbol_sequence(seq: str) -> List[str]:
    """Map each symbol to a common-word hint (e.g., '@' -> 'at')"""
    return [_SYMBOL_MAP.get(ch, f"symbol_{ord(ch)}") for ch in seq]

def _map_number_sequence(seq: str) -> str:
    """
    Map numeric sequences to readable date/year/time or grouped numbers.
    We return a string that can be used as a hint (may include digits).
    """
    if len(seq) == 8:
        y, m, d = seq[:4], seq[4:6], seq[6:8]
        try:
            yi, mi, di = int(y), int(m), int(d)
            month_names = ["", "January","February","March","April","May","June","July","August","September","October","November","December"]
            month = month_names[mi] if 1 <= mi <= 12 else f"month{mi}"
            return f"{di}{_day_suffix(di)} {month} {yi}"
        except Exception:
            pass
    if len(seq) == 4 and (seq.startswith("19") or seq.startswith("20")):
        return f"{seq}"
    if len(seq) % 3 == 0:
        parts = [seq[i:i+3] for i in range(0, len(seq), 3)]
        return " ".join(parts)
    parts = [seq[i:i+2] for i in range(0, len(seq), 2)]
    return " ".join(parts)

def _day_suffix(d: int) -> str:
    if 11 <= (d % 100) <= 13:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(d % 10, "th")

def tokens_to_safe_hints(tokens: List[Dict]) -> List[Dict]:
    """
    Convert internal tokens to safe hints that are suitable to send to Gemini.
    Each hint is a dict: {"type": "...", "hint": "..."}
    We do NOT include raw password characters.
    """
    safe = []
    for t in tokens:
        if t["type"] == "letters":
            hint = _map_letters_to_name(t["raw"])
            safe.append({"type": "letters", "hint": hint})
        elif t["type"] == "symbols":
            mapped = _map_symbol_sequence(t["raw"])
            safe.append({"type": "symbols", "hint": " ".join(mapped)})
        elif t["type"] == "number":
            hint = _map_number_sequence(t["raw"])
            safe.append({"type": "number", "hint": hint})
    return safe

# ---------- Gemini prompt / builder (rich habit-based stories) ----------
def build_story_with_gemini(tokens: List[Dict]) -> str:
    safe_hints = tokens_to_safe_hints(tokens)

    hints_text = []
    for i, h in enumerate(safe_hints):
        hints_text.append(f"{i+1}. {h['type'].upper()}: {h['hint']}")

    examples = (
        "Example hint -> story mapping (for style reference):\n"
        "- Letters: 'Maya (4 letters, title)' ; Symbols: 'at' ; Number: '2003' -> "
        "'Maya walked to the bus stop, put a small note at the bench, and remembered 2003 as the year she moved.'\n"
        "- Letters: 'River (5 letters, lower)' ; Number: '12th September 2002' -> "
        "'Each morning River drank tea by the riverbank; on 12th September 2002 she learned to swim.'\n"
    )

    prompt = (
        "You are a compassionate memory coach. Use the following SAFE hints "
        "to create a human, everyday-life mini-story (3-6 sentences) that helps "
        "a person recall the pieces of their password in order. Important rules:\n"
        "1) DO NOT request or output the original password characters.\n"
        "2) Use ONLY the provided SAFE hints (they describe tokens like letters mapped to a name, symbols mapped to words like 'at', and numbers as readable dates or groups).\n"
        "3) Produce a vivid, realistic mini-story describing daily habits, places, or small events (e.g., catching a bus, writing a note, meeting a friend, walking a dog). The story should be easy to picture.\n"
        "4) The story must include clues for each token in the same order as the hints. Each clue should be natural language.\n"
        "5) Keep it friendly, slightly conversational, and memorable (not a dry list). Aim for 3-6 sentences; moderate length is fine.\n"
        "6) Avoid technical words and unusual vocabulary. Use common, everyday words only.\n\n"
        "HINTS (ordered):\n" + "\n".join(hints_text) + "\n\n"
        + "Style guidance and examples:\n" + examples + "\n"
        + "Now write the mini-story that a user can easily visualize and remember. Return only the story (do not add commentary)."
    )

    try:
        model = genai.GenerativeModel("gemini-flash-latest")
        res = model.generate_content(prompt)
        out = (res.text or "").strip()
        out = re.sub(r"\s+", " ", out).strip()
        if len(out.split()) < 6:
            raise ValueError("Gemini response too short, fallback.")
        return out
    except Exception as e:
        print("⚠️ Gemini failed or returned unsuitable output:", str(e))
        return build_local_story(tokens)

# ---------- Local fallback (no LLM) ----------
def build_local_story(tokens: List[Dict]) -> str:
    parts = []
    for t in tokens:
        if t["type"] == "letters":
            parts.append(_map_letters_to_name(t["raw"]))
        elif t["type"] == "symbols":
            parts.append(" ".join(_map_symbol_sequence(t["raw"])))
        elif t["type"] == "number":
            parts.append(_map_number_sequence(t["raw"]))

    if not parts:
        return "A short familiar scene to help you remember."

    sentences = []
    sentences.append(f"One morning, {parts[0]} was following their usual routine.")
    for idx in range(1, len(parts)):
        p = parts[idx]
        t = tokens[idx]["type"]
        if t == "symbols":
            sentences.append(f"They left a small sign {p} on the corner where they always wait.")
        elif t == "number":
            sentences.append(f"That day happened on {p}, a date they still remember clearly.")
        else:
            sentences.append(f"Then they met {p} while walking to the market, and it felt ordinary but memorable.")
    sentences.append("This simple sequence of moments helps lock the details in memory.")
    story = " ".join(sentences)
    story = re.sub(r"\s+", " ", story).strip()
    if not story.endswith("."):
        story += "."
    return story

# ---------- Core helpers ----------
def generate_story_for_password(pwd: str) -> Dict:
    features = pattern_agent.extract_features(pwd)
    tokens = split_password_secure(pwd)
    story = build_story_with_gemini(tokens)
    return {"features": features, "tokens": tokens, "story": story}

def save_for_user(user_id: str, story: str):
    nonce, ct = encrypt_text(story)
    MN_COLL.insert_one({
        "userId": ObjectId(user_id),
        "nonce": nonce,
        "ciphertext": ct,
        "createdAt": datetime.now(timezone.utc),
        "version": 1,
    })

def latest_story_for_user(user_id: ObjectId) -> Optional[str]:
    doc = MN_COLL.find_one({"userId": user_id}, sort=[("createdAt", -1)])
    if not doc:
        return None
    try:
        return decrypt_text(doc["nonce"], doc["ciphertext"])
    except Exception:
        return None

# ---------- auth helper for /latest/me  🆕 ----------
def _current_user_id(authorization: str = Header(default=None)) -> ObjectId:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    claims = decode_token(token)
    if not claims or "sub" not in claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    uid = ObjectId(claims["sub"])
    exists = db.users.find_one({"_id": uid}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=401, detail="User not found")
    return uid

# ---------- API endpoints ----------
@router.post("/preview")
def preview(data: PreviewIn):
    out = generate_story_for_password(data.password)
    return {"tokens": out["tokens"], "story": out["story"]}

@router.post("/save")
def save_story(data: SaveIn):
    oid = _resolve_user_id_from_any(data.user_id, data.username, str(data.email) if data.email else None)
    out = generate_story_for_password(data.password)
    save_for_user(str(oid), out["story"])
    return {"ok": True, "story": out["story"]}

@router.get("/latest", response_model=LatestOut)
def latest(username: Optional[str] = Query(default=None),
           email: Optional[EmailStr] = Query(default=None)):
    if not username and not email:
        raise HTTPException(status_code=400, detail="Provide username or email")
    if email:
        q = {"email": str(email).lower()}
    else:
        q = {"username": username.strip()}
    user = db.users.find_one(q, {"_id": 1})
    if not user:
        return {"story": None}
    story = latest_story_for_user(user["_id"])
    return {"story": story}

@router.get("/latest/me", response_model=LatestOut)  # 🆕 logged-in user's latest story
def latest_me(user_id: ObjectId = Depends(_current_user_id)):
    story = latest_story_for_user(user_id)
    return {"story": story}

@router.get("/user-exists")
def user_exists(username: Optional[str] = Query(default=None),
                email: Optional[EmailStr] = Query(default=None)):
    if email:
        e = str(email).lower()
        return {"exists": db.users.count_documents({"email": e}) > 0, "by": "email"}
    if username:
        u = username.strip()
        return {"exists": db.users.count_documents({"username": u}) > 0, "by": "username"}
    raise HTTPException(status_code=400, detail="Provide username or email")

# ---------- user resolver ----------
def _resolve_user_id_from_any(user_id: Optional[str], username: Optional[str], email: Optional[str]) -> ObjectId:
    if user_id:
        try:
            oid = ObjectId(user_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid user_id")
        user = db.users.find_one({"_id": oid}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found (user_id)")
        return user["_id"]
    if username:
        u = username.strip()
        user = db.users.find_one({"username": u}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found (username)")
        return user["_id"]
    if email:
        e = email.strip().lower()
        user = db.users.find_one({"email": e}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found (email)")
        return user["_id"]
    raise HTTPException(status_code=400, detail="Provide one of: user_id, username, or email")
