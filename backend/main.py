from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agents import guardian, watchdog, generator, advisor #


# Import agents
from agents import guardian  # we’ll add watchdog later
from agents import advisor  # added for use advisor.py

app = FastAPI()

# Allow frontend (Next.js) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Password Safety Backend is running 🚀"}

# Register Guardian agent routes
app.include_router(guardian.router, prefix="/guardian")
app.include_router(watchdog.router, prefix="/watchdog")
app.include_router(watchdog.router, prefix="/report")
app.include_router(generator.router, prefix="/generator")

# register advisor agent routes
app.include_router(advisor.router, prefix="/advisor")
