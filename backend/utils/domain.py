# backend/utils/domain.py
from urllib.parse import urlparse
import idna

COMMON_PREFIXES = ("www.",)

def _strip_common_prefix(host: str) -> str:
    for p in COMMON_PREFIXES:
        if host.startswith(p):
            return host[len(p):]
    return host

def normalize_domain(url_or_host: str) -> str:
    """
    Best-effort domain normalizer (no PSL yet).
    - Accepts full URLs or bare hosts
    - Lowercases, strips scheme/port, strips 'www.'
    - IDN-safe
    """
    if not url_or_host:
        return ""
    parsed = urlparse(url_or_host if "://" in url_or_host else f"//{url_or_host}", scheme="http")
    host = (parsed.hostname or "").strip().lower()
    try:
        host = idna.decode(idna.encode(host))
    except Exception:
        pass
    return _strip_common_prefix(host)
