# backend/crypto_utils.py
"""
🔐 AES-GCM helpers used to encrypt/decrypt the *story text* at rest.
ENV:
  STORY_SECRET_KEY = base64-encoded 32-byte key (e.g., from os.urandom(32))
"""

import os, base64, secrets
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_b64 = os.getenv("STORY_SECRET_KEY", "").strip()
if not _b64:
    key = os.urandom(32)
    print("⚠️ STORY_SECRET_KEY not set. Using ephemeral key (dev only).")
else:
    try:
        key = base64.b64decode(_b64)
        if len(key) != 32:
            raise ValueError("Key must decode to 32 bytes")
    except Exception as e:
        print("❌ STORY_SECRET_KEY invalid:", e)
        key = os.urandom(32)

def encrypt_text(plaintext: str) -> Tuple[str, str]:
    aes = AESGCM(key)
    nonce = secrets.token_bytes(12)
    ct = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    import base64 as b64
    return b64.b64encode(nonce).decode(), b64.b64encode(ct).decode()

def decrypt_text(nonce_b64: str, ciphertext_b64: str) -> str:
    aes = AESGCM(key)
    import base64 as b64
    nonce = b64.b64decode(nonce_b64)
    ct = b64.b64decode(ciphertext_b64)
    pt = aes.decrypt(nonce, ct, None)
    return pt.decode("utf-8")
