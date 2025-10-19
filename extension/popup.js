const apiBaseEl = document.getElementById("apiBase");
const tokenEl = document.getElementById("token");
const passEl = document.getElementById("passphrase");
const msg = document.getElementById("msg");

// Load stored settings
chrome.storage.sync.get(["apiBase", "token", "passphrase"], (r) => {
  apiBaseEl.value = r.apiBase || "";
  tokenEl.value = r.token || "";
  passEl.value = r.passphrase || "";
});

// Save on click
document.getElementById("save").onclick = async () => {
  await chrome.storage.sync.set({
    apiBase: apiBaseEl.value.trim(),
    token: tokenEl.value.trim(),
    passphrase: passEl.value
  });
  msg.textContent = "✅ Saved!";
  setTimeout(() => (msg.textContent = ""), 1500);
};
