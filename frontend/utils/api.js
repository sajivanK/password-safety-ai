export const API_URL = "http://127.0.0.1:8000";

// Root check (for testing backend)
export async function getRoot() {
  const res = await fetch(`${API_URL}/`);
  return res.json();
}

// Guardian – Password Analyzer
export async function analyzePassword(password) {
  const res = await fetch(`${API_URL}/guardian/analyze-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw new Error("Password analysis failed");
  }

  return res.json();
}
