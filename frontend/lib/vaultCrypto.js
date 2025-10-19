function b64ToBytes(b64){ return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
function bytesToB64(bytes){ return btoa(String.fromCharCode(...bytes)); }
export function genSalt(len=16){ return bytesToB64(crypto.getRandomValues(new Uint8Array(len))); }
export function genIv(len=12){ return bytesToB64(crypto.getRandomValues(new Uint8Array(len))); }

async function deriveKey(passphrase, saltB64){
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt:b64ToBytes(saltB64), iterations:600000, hash:"SHA-256" },
    km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}
export async function encryptSecret(plain, passphrase){
  const salt = genSalt(); const iv = genIv();
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv:b64ToBytes(iv) }, key, new TextEncoder().encode(plain));
  return { salt, iv, ciphertext: bytesToB64(new Uint8Array(ct)) };
}
export async function decryptSecret(ciphertextB64, passphrase, salt, iv){
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv:b64ToBytes(iv) }, key, b64ToBytes(ciphertextB64));
  return new TextDecoder().decode(pt);
}

