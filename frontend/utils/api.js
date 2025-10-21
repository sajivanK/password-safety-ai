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

// 🧠 Story-related API helpers
export async function getStoryPreview(password) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/story/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return data.story;
}

export async function getLatestStory(identifier) {
  const param = identifier.includes("@")
    ? `email=${identifier}`
    : `username=${identifier}`;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"}/story/latest?${param}`
  );
  const data = await res.json();
  return data.story;
}

