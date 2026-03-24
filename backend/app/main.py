from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import auth, users, projects, materials, topics, study_plans, sessions, quiz, content, audio, spaced_repetition, wellbeing, notifications, gamification

app = FastAPI(
    title="The Adaptive Brain API",
    description="AI-driven exam preparation companion",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(materials.router, prefix="/api", tags=["materials"])
app.include_router(topics.router, prefix="/api", tags=["topics"])
app.include_router(study_plans.router, prefix="/api", tags=["study_plans"])
app.include_router(sessions.router, prefix="/api", tags=["sessions"])
app.include_router(quiz.router, prefix="/api", tags=["quiz"])
app.include_router(content.router, prefix="/api", tags=["content"])
app.include_router(audio.router, prefix="/api", tags=["audio"])
app.include_router(spaced_repetition.router, prefix="/api", tags=["spaced_repetition"])
app.include_router(wellbeing.router, prefix="/api", tags=["wellbeing"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])


@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "The Adaptive Brain API"}
