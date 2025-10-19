// ---------- Crypto helpers ----------
async function deriveKey(passphrase, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decrypt(ciphertextB64, ivB64, key) {
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

// ---------- DOM helpers ----------
// Deep query across open shadow roots (not closed ones)
function* walkDeep(node = document) {
  yield node;
  const walkers = (node.querySelectorAll ? [...node.querySelectorAll("*")] : []);
  for (const el of walkers) {
    yield el;
    if (el.shadowRoot) {
      yield el.shadowRoot;
      yield* walkDeep(el.shadowRoot);
    }
  }
}

function deepQuerySelector(selector) {
  for (const root of walkDeep()) {
    try {
      const el = root.querySelector?.(selector);
      if (el) return el;
    } catch (_) {}
  }
  return null;
}

// Use native setter so React/Vue see the change
function nativeSet(el, value) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value")
    || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
    || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function findLoginFields() {
  // Expand selectors a bit
  const uSel = [
    'input[type="email"]',
    'input[type="text"]',
    'input[name*=user i]',
    'input[name*=login i]',
    'input[name*=email i]',
    'input[id*=email i]',
    'input[id*=user i]',
    'input[autocomplete="username"]'
  ].join(",");
  const pSel = [
    'input[type="password"]',
    'input[autocomplete="current-password"]'
  ].join(",");

  const u = deepQuerySelector(uSel);
  const p = deepQuerySelector(pSel);
  const s = deepQuerySelector('button[type="submit"], input[type="submit"]');
  return { u, p, s };
}

function waitForFields(timeoutMs = 8000, intervalMs = 200) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const fp = findLoginFields();
      if (fp.u || fp.p) {
        clearInterval(timer);
        resolve(fp);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve({ u: null, p: null, s: null });
      }
    }, intervalMs);
  });
}

// ---------- Main handler ----------
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "PSAI_AUTOFILL") return;

  const { passphrase } = await chrome.storage.sync.get(["passphrase"]);
  if (!passphrase) {
    console.warn("[PSAI] No passphrase set in popup.");
    return;
  }

  const entry = msg.payload?.exact?.[0];
  if (!entry) return;

  // 1) Decrypt first (distinct error log)
  let password;
  try {
    const key = await deriveKey(passphrase, entry.salt);
    password = await decrypt(entry.ciphertext, entry.iv, key);
  } catch (e) {
    console.warn("[PSAI] decrypt error (wrong passphrase or corrupted blobs)", e);
    return;
  }

  // 2) Wait for fields and fill
  try {
    const { u, p, s } = await waitForFields();
    if (!u && !p) {
      console.warn("[PSAI] No login fields found on this frame (try navigating to the actual login form).");
      return;
    }
    if (u && entry.login) {
      u.focus();
      nativeSet(u, entry.login);
    }
    if (p) {
      p.focus();
      nativeSet(p, password);
    }
    if (u || p) {
      console.log("[PSAI] Autofilled credentials.");
      // Optional auto-submit:
      // if (s) s.click();
    }
  } catch (err) {
    console.warn("[PSAI] DOM fill error", err);
  }
});
