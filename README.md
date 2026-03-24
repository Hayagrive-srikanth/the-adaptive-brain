# 🧠 The Adaptive Brain

An AI-driven exam preparation companion that personalizes study experiences for university students. Built with Next.js, FastAPI, Supabase, and Claude AI.

## What It Does

Upload your study materials (PDFs, notes, slides) and The Adaptive Brain will:
- **Extract topics** from your materials using AI
- **Generate a personalized study plan** based on your exam date and learning style
- **Create adaptive content** — summaries, micro-lessons, flashcards, concept maps, audio lessons
- **Quiz you intelligently** — wrong answers trigger rephrased explanations, not just the correct answer
- **Track your progress** with spaced repetition (SM-2 algorithm) and mastery scores
- **Adapt to your wellbeing** — mood check-ins adjust session intensity
- **Gamify your learning** — XP, streaks, achievements, and celebrations
- **Simulate mock exams** — full exam simulations weighted toward your weak areas
- **Visualize knowledge** — interactive knowledge graph of topic relationships

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend | FastAPI, Python 3.12, Celery, Redis |
| Database | Supabase (PostgreSQL + Auth + Storage + pgvector) |
| AI | Claude API (Opus for complex tasks, Sonnet for content, Haiku for quick checks) |
| Audio | Deepgram (TTS/STT) |
| OCR | PyMuPDF + HunyuanOCR (optional) |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── models/       # Pydantic schemas
│   │   ├── prompts/      # Claude AI prompt templates
│   │   ├── services/     # Business logic
│   │   └── tasks/        # Celery async tasks
│   └── database/
│       └── migrations/   # SQL schema files
├── frontend/
│   └── src/
│       ├── app/          # Next.js pages (app router)
│       ├── components/   # React components
│       ├── lib/          # API client, Supabase client
│       ├── stores/       # Zustand state management
│       └── types/        # TypeScript interfaces
```

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker (for Redis)
- Supabase account
- Anthropic API key

### 1. Clone and install

```bash
git clone https://github.com/Hayagrive-srikanth/the-adaptive-brain.git
cd the-adaptive-brain
```

**Backend:**
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate    # Windows
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Database setup

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor and run these migrations in order:
   - `backend/database/migrations/001_initial_schema.sql`
   - `backend/database/migrations/002_phase2_schema.sql`
   - `backend/database/migrations/003_phase3_schema.sql`
3. Create a Storage bucket called `materials` (set to Public)
4. In Authentication → Providers → Email, turn OFF "Confirm email"

### 3. Environment variables

**Backend** — create `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://localhost:6379/0
DEEPGRAM_API_KEY=your-deepgram-key    # optional, for audio features
HUNYUAN_OCR_PATH=                      # optional, for scanned PDFs
```

**Frontend** — create `frontend/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Get your keys from: Supabase Dashboard → Settings → API

### 4. Start everything (4 terminals)

```bash
# Terminal 0: Redis
docker run -d -p 6379:6379 redis

# Terminal 1: Backend
cd backend
.\venv\Scripts\Activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Celery worker
cd backend
.\venv\Scripts\Activate
celery -A app.celery_app worker --loglevel=info --pool=solo

# Terminal 3: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

## Features by Phase

### Phase 1 — Core Platform
- User auth (email/password + Google)
- 7-question onboarding → personalized learning profile
- Project creation with material upload
- PDF/DOCX/PPTX text extraction
- AI topic extraction and study plan generation
- Duolingo-style study path
- Study sessions with content delivery + quizzes
- Session wrap-up with stats

### Phase 2 — Intelligence Layer
- Spaced repetition (SM-2 algorithm)
- Adaptive rephrasing (3 escalation levels for wrong answers)
- Multi-format content (flashcards, concept maps, comparison tables, mnemonics)
- Audio lessons with Deepgram TTS + pause-point quizzes
- Wellbeing check-ins (mood/energy → session adaptation)
- Breathing exercises for stress
- Attention span tracking with break reminders
- Notifications system

### Phase 3 — Polish
- Gamification (XP, streaks, 12 achievements, celebrations, confetti)
- Mock exam simulator with timer and section navigation
- Interactive knowledge graph visualization
- Focus mode (distraction-free with growing visual)
- Enhanced dashboard (priority recommendations, calendar view, sparkline trends)
- Exam eve support (calming summary, no pressure)
- Post-exam reflection
- Study Wrapped (Spotify Wrapped-style summary)
- TikTok-style micro-lesson player

## API Documentation

With the backend running, visit http://localhost:8000/docs for the full Swagger API docs.

## Design

- Primary: `#6C63FF` (purple)
- Secondary: `#FF6B35` (orange)
- Success: `#22C55E` (green)
- Background: `#F8F9FA`
- Aesthetic: Headspace meets Duolingo — calming, modern, mobile-first
