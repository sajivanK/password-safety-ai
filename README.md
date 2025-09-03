
```markdown
# 🔐 Password Safety AI

A multi-agent AI-powered password safety system built with **FastAPI** (backend) and **Next.js + TailwindCSS** (frontend).  
This project is designed as a **university project** but follows **industrial standards**, supporting both normal users and subscription-based advanced features.

---

## 🚀 Features

### ✅ Current Features
- **Password Analyzer (Agent 1 – Guardian)**  
  - Checks password strength using `zxcvbn`.  
  - Provides **score (0–4)**, warnings, and improvement suggestions.  

- **Frontend + Backend Connection**  
  - Next.js frontend fetches data from FastAPI backend.  
  - CORS enabled for smooth communication.  

- **UI Styling with TailwindCSS**  
  - Clean, responsive interface for password testing.  

### 🔮 Upcoming Features
- **Password Breach Check (Agent 2 – Watchdog)**  
  - Integrates with **HaveIBeenPwned API** to check if passwords were leaked in breaches.  

- **Password Generator (Agent 3 – Artisan)**  
  - Generates secure yet memorable passwords (hybrid of native language + English).  

- **Enterprise Features (Future)**  
  - Policy Enforcer (custom password rules).  
  - Security Auditor Dashboard (analytics + compliance).  
  - Shared Vaults with Role-Based Access Control (RBAC).  

---

## 🏗️ Tech Stack

**Frontend:**  
- Next.js 15 (React framework)  
- TailwindCSS (styling)  

**Backend:**  
- FastAPI (Python web framework)  
- zxcvbn (password strength estimator)  

**Other Tools:**  
- CORS Middleware (secure frontend-backend communication)  
- Git & GitHub (version control)  

---

## 📂 Project Structure

```

password-safety-ai/
│
├── backend/                  # FastAPI backend
│   ├── main.py                # API routes
│   └── venv/                  # Python virtual environment (not committed)
│
├── frontend/                 # Next.js frontend
│   ├── app/                   # App Router pages
│   │   ├── page.js            # Homepage
│   │   ├── layout.js          # Layout wrapper
│   │   └── globals.css        # Global styles (Tailwind)
│   ├── utils/                 # API helpers
│   │   └── api.js
│   └── package.json
│
├── .gitignore                # Ignored files (node\_modules, venv, etc.)
├── README.md                 # Project documentation

````

---

## ⚡ Getting Started

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/YOUR-USERNAME/password-safety-ai.git
cd password-safety-ai
````

### 2️⃣ Setup Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # (on macOS/Linux)
venv\Scripts\activate       # (on Windows)

pip install fastapi uvicorn zxcvbn pydantic requests
uvicorn main:app --reload
```

Backend will run on **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

### 3️⃣ Setup Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 How to Use

1. Run backend (`uvicorn main:app --reload`).
2. Run frontend (`npm run dev`).
3. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
4. Enter a password → click **Analyze** → see score, warning, suggestions.

---

## 👨‍💻 Team Members

* **Sajivan.K** – Backend (FastAPI, APIs, AI agents)
* **Mathushan.K** – Frontend (Next.js, UI/UX)
* **Kesigan.M** – Integration (Frontend + Backend)
* **Ajaniya.K** – Documentation & Testing

---

## 📌 Notes

* Current version is **MVP** (basic analyzer).
* Future updates will add breach checks, password generation, and enterprise features.
* Project is developed as part of a **university coursework** but designed with **industrial standards**.

---

## 📜 License

MIT License – feel free to use and modify for educational purposes.

```
