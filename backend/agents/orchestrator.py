# agents/orchestrator.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import re, asyncio, httpx
from typing import Optional, Literal, Dict, Any

router = APIRouter()

# ======================
# Request / Response DTO
# ======================

Plan = Literal["normal", "premium", "enterprise"]

class ChatIn(BaseModel):
    message: str = Field(..., description="User's natural language message")
    plan: Plan = "normal"
    # Optional structured hints (when UI sends buttons/toggles)
    length: Optional[int] = None
    symbols: Optional[bool] = None
    language: Optional[str] = None  # e.g., "si", "ta", "en"
    mode: Optional[Literal["deterministic","llm","multilingual"]] = None

class ChatOut(BaseModel):
    chat: str
    ui: Dict[str, Any] = {}
    warnings: list[str] = []

# ======================
# Simple NLU
# ======================

INTENT_ANALYZE = "analyze"
INTENT_GENERATE = "generate"
INTENT_BREACH = "check_breach"
INTENT_COMBO = "combo"

def parse_intent(msg: str) -> str:
    m = msg.lower()
    want_analyze = any(k in m for k in ["check", "analyze", "score", "safe", "strength"])
    want_breach  = any(k in m for k in ["breach", "leak", "compromised", "pwned"])
    want_gen     = any(k in m for k in ["generate", "suggest", "new password", "passphrase", "create"])

    if (want_analyze or want_breach) and want_gen:
        return INTENT_COMBO
    if want_breach:
        return INTENT_BREACH
    if want_gen:
        return INTENT_GENERATE
    return INTENT_ANALYZE

def extract_password(msg: str) -> Optional[str]:
    # Try quoted '...' or "..."
    m = re.search(r"[\"']([^\"']+)[\"']", msg)
    if m:
        return m.group(1).strip()
    # Fallback: last token that has letters/numbers and > 4 chars
    tokens = re.findall(r"[^\s]+", msg)
    for tok in reversed(tokens):
        if len(tok) >= 5 and any(c.isalpha() for c in tok):
            return tok
    return None

# ======================
# HTTP helpers to agents
# ======================

# If your backend runs on a different host/port, edit this:
BACKEND_BASE = "http://localhost:8000"

async def call_guardian(password: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{BACKEND_BASE}/guardian/analyze-password", json={"password": password})
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, f"Guardian error: {resp.text}")
        return resp.json()

async def call_watchdog(password: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(f"{BACKEND_BASE}/watchdog/check-breach", json={"password": password})
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, f"Watchdog error: {resp.text}")
        return resp.json()

async def call_generator(mode: str = "deterministic",
                         length: int = 12,
                         symbols: bool = True,
                         language: Optional[str] = None) -> Dict[str, Any]:
    payload = {"mode": mode, "length": length}
    if symbols is not None:
        payload["symbols"] = symbols
    if mode == "multilingual":
        payload["language"] = language or "en"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(f"{BACKEND_BASE}/generator/create-password", json=payload)
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, f"Generator error: {resp.text}")
        return resp.json()

# ======================
# Compose final message
# ======================

def compose_reply(password: Optional[str],
                  guardian: Optional[Dict[str,Any]],
                  watchdog: Optional[Dict[str,Any]],
                  generator: Optional[Dict[str,Any]],
                  plan: Plan,
                  degraded: list[str]) -> ChatOut:

    parts = []
    ui: Dict[str,Any] = {}
    warnings: list[str] = []

    if degraded:
        warnings.append("Some services were unavailable: " + ", ".join(degraded))

    if guardian:
        score = guardian.get("score") or guardian.get("data",{}).get("score")
        reason = guardian.get("warning") or guardian.get("reasons") or guardian.get("data",{}).get("reasons")
        ui["strength"] = {"score": score, "details": reason}
        if password:
            tag = "Strong ✅" if (score and score >= 3) else "Weak ⚠️"
            parts.append(f"{tag} password analysis for {repr(password)}: score {score}/4.")

    if watchdog is not None:
        breached = watchdog.get("breached") or watchdog.get("found")
        count = watchdog.get("count") or watchdog.get("breach_count")
        ui["breach"] = {"breached": bool(breached), "count": count}
        if breached:
            parts.append(f"🔎 Found in ~{count} known breaches.")
        else:
            parts.append("🟢 Not found in known breach datasets.")

    if generator:
        suggestion = generator.get("password") or generator.get("suggestions") or generator.get("passphrase")
        if isinstance(suggestion, list):
            sug_list = suggestion
        else:
            sug_list = [suggestion] if suggestion else []
        ui["suggestions"] = sug_list
        if sug_list:
            parts.append("💡 Suggestions: " + ", ".join(sug_list[:2]))

    # If premium-only features were requested but gated
    if plan == "normal" and ("breach" not in ui or "suggestions" not in ui):
        warnings.append("Some features are premium. Upgrade to unlock breach checks and smart suggestions.")

    chat = " ".join(parts) if parts else "I analyzed your request."
    return ChatOut(chat=chat, ui=ui, warnings=warnings)

# ======================
# Orchestrator endpoint
# ======================

@router.post("/chat", response_model=ChatOut)
async def orchestrator_chat(body: ChatIn) -> ChatOut:
    intent = parse_intent(body.message)
    password = extract_password(body.message)

    # decide what to run
    run_analyze = (intent in (INTENT_ANALYZE, INTENT_COMBO, INTENT_BREACH)) and bool(password)
    run_breach  = (intent in (INTENT_BREACH, INTENT_COMBO, INTENT_ANALYZE)) and bool(password) and body.plan in ("premium","enterprise")
    want_generate = (intent in (INTENT_GENERATE, INTENT_COMBO))

    # if weak (later), we may also trigger generator; for now rely on explicit intent or UI mode hint
    gen_mode = body.mode or ("llm" if body.plan in ("premium","enterprise") else "deterministic")
    gen_length = body.length or 14
    gen_symbols = True if body.symbols is None else body.symbols

    # fan out calls
    degraded = []
    guardian_res = None
    watchdog_res = None
    generator_res = None

    async def maybe_guardian():
        nonlocal guardian_res
        if run_analyze:
            try:
                guardian_res = await call_guardian(password)  # expects {"score":..., ...}
            except Exception:
                degraded.append("guardian")

    async def maybe_watchdog():
        nonlocal watchdog_res
        if run_breach:
            try:
                watchdog_res = await call_watchdog(password)  # expects {"breached": bool, "count": int}
            except Exception:
                degraded.append("watchdog")

    async def maybe_generator():
        nonlocal generator_res
        if want_generate:
            try:
                generator_res = await call_generator(
                    mode=gen_mode,
                    length=gen_length,
                    symbols=gen_symbols,
                    language=body.language
                )
            except Exception:
                degraded.append("generator")

    # Run in parallel where possible
    await asyncio.gather(maybe_guardian(), maybe_watchdog(), maybe_generator())

    # If the user asked only to analyze but generator wasn’t requested and password looks weak,
    # you can auto-generate suggestions for premium. (Optional enhancement)
    # Example: if guardian_res and guardian_res.get("score", 0) < 3 and body.plan != "normal": ...

    return compose_reply(password, guardian_res, watchdog_res, generator_res, body.plan, degraded)
