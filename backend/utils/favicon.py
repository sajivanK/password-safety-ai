# backend/utils/favicon.py
def favicon_url_for(domain: str, size: int = 64) -> str:
    """
    Return a favicon URL for a given domain using Google's favicon service.
    Example: https://www.google.com/s2/favicons?domain=facebook.com&sz=64
    """
    if not domain:
        return ""
    return f"https://www.google.com/s2/favicons?domain={domain}&sz={size}"
