# The Adaptive Brain — Project Plan

## Phase Overview

| Phase | Name | Focus | Key Deliverable |
|-------|------|-------|-----------------|
| Phase 1 | The Core Loop | Account → Upload → Study Plan → Study Session → Quiz | A student can sign up, upload notes, get a study plan, and complete a study session with quizzes |
| Phase 2 | The Intelligence Layer | Spaced repetition, adaptive rephrasing, multi-format content, audio, wellbeing | The app genuinely adapts and feels personalized across sessions |
| Phase 3 | The Polish | Gamification, micro-lessons, mock exams, cross-material intelligence, focus mode | The app is delightful, sticky, and feature-complete |

---

## Phase 1 — The Core Loop

### Goal
A single user can create an account, complete onboarding, create an exam project, upload study materials, receive an AI-generated study plan, and complete study sessions with quiz-based active recall. The Duolingo-style path is visible and functional.

### Features

#### 1.1 Authentication & Account
- Supabase Auth integration (email + Google sign-in)
- Account creation flow
- Session management and protected routes

#### 1.2 Onboarding Questionnaire
- 7-question multiple-choice flow
- Questions cover: learning modality, attention span, engagement style, language background, neurodivergent profile, study time preference, motivation type
- Each question is single-tap, no typing
- Generates user profile JSON and stores in users table
- Profile confirmation screen after completion

#### 1.3 User Profile Page
- Displays current profile as a "learning identity card"
- Shows all profile dimensions with system's interpretation
- Explanation text next to each trait ("We noticed you prefer...")
- Prompt input bar at the bottom for conversational editing
- Claude Sonnet interprets prompt and updates profile fields
- Visual confirmation of changes after prompt submission

#### 1.4 Project Creation
- Create new project form: name, exam date (calendar picker with auto days-remaining calculation), hours per day, comfort level (3-point scale)
- Material upload zone: drag-and-drop or tap, accepts PDF, images, DOCX, PPTX, audio files
- Upload progress indicator with friendly processing message
- Multi-project support on dashboard (list of all projects)

#### 1.5 Material Processing Pipeline
- File upload to Supabase Storage
- Celery background job triggered on upload
- File type detection and routing to appropriate parser (PyMuPDF for PDF, python-docx for DOCX, python-pptx for PPTX, Pillow preprocessing for images)
- Hunyuan OCR processing for all documents
- Extracted text stored in source_materials.ocr_text
- Vector embeddings generated and stored in pgvector
- Processing status updates via Supabase real-time

#### 1.6 AI Topic Extraction
- Claude Opus analyzes all extracted text from project materials
- Identifies major topics, descriptions, difficulty levels, and prerequisite relationships
- Creates topic dependency graph (which topics must come before others)
- Estimates study time per topic
- Stores structured topics in database

#### 1.7 Study Plan Generation
- Claude Opus generates day-by-day plan based on: topics, user profile, days until exam, hours per day, comfort level
- Sequences topics by difficulty and prerequisites
- Allocates time based on topic complexity and user attention span
- Creates study_plan and study_plan_days records
- Final days automatically designated as review/mock exam days

#### 1.8 Project Dashboard
- Visual study path (Duolingo-style node path)
- Each node = a topic, showing: name, estimated time, status (locked/available/in-progress/mastered)
- Today's session highlighted prominently
- Readiness score display (starts at 0%)
- Topic strength indicators (strong/okay/weak/not started)
- "Start Studying" primary action button

#### 1.9 Study Session Engine
- Session opening: brief context setter for today's material
- Content delivery: Claude Sonnet transforms topic content based on user profile (text summaries for readers, structured explanations for visual learners, etc.)
- Active recall checkpoints: quiz questions after each content block
- Basic answer evaluation: correct/incorrect with explanation
- Session progress indicator
- Session wrap-up screen: topics covered, accuracy rate, time spent

#### 1.10 Quiz Engine (Basic)
- Claude Opus generates questions per topic (multiple choice, true/false, fill-in-blank)
- Question display with answer input
- Correct/incorrect feedback with explanation
- Stores all attempts in quiz_attempts table
- Updates topic mastery_percentage based on quiz performance
- Updates project readiness_score

#### 1.11 Progress Tracking
- Readiness score calculation and display
- Per-topic mastery percentages
- Session history log
- Basic stats: total study time, sessions completed, questions answered

### Phase 1 — Testing & Running Instructions

#### Prerequisites
1. Install Node.js (v18+) and Python (3.11+)
2. Install Redis locally or use Docker: `docker run -d -p 6379:6379 redis`
3. Create a Supabase project at https://supabase.com
4. Get API keys: Supabase URL + anon key + service role key, Anthropic API key
5. Set up Hunyuan OCR locally (follow their GitHub README)
6. Install FFmpeg: `sudo apt install ffmpeg` (or brew install on Mac)

#### Environment Setup
1. Copy `.env.example` to `.env` in both `/frontend` and `/backend`
2. Fill in all API keys and connection strings
3. Frontend `.env`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Backend `.env`: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REDIS_URL

#### Database Setup
1. Go to Supabase dashboard → SQL Editor
2. Run the migration file: `backend/database/migrations/001_initial_schema.sql`
3. Verify tables created in Supabase Table Editor
4. Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`

#### Running the Backend
```bash
cd backend
pip install -r requirements.txt
# Start FastAPI server
uvicorn app.main:app --reload --port 8000
# In a separate terminal, start Celery worker
celery -A app.celery_app worker --loglevel=info
```

#### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Testing Checklist — Phase 1
1. **Auth**: Sign up with email, sign in, sign out, sign in with Google
2. **Onboarding**: Complete all 7 questions, verify profile JSON saved in Supabase users table
3. **Profile Page**: View profile, type a prompt to change a preference, verify profile updates in DB
4. **Project Creation**: Create a project with name, date, hours, comfort level
5. **Upload**: Upload a PDF file, verify it appears in Supabase Storage, verify processing_status goes from "pending" → "processing" → "completed"
6. **OCR**: Check source_materials.ocr_text is populated with extracted text
7. **Topics**: Verify topics table has entries with names, descriptions, difficulty, prerequisites
8. **Study Plan**: Verify study_plan and study_plan_days records created
9. **Dashboard**: See the Duolingo path with topic nodes, readiness score at 0%
10. **Study Session**: Start a session, read through content, answer quiz questions
11. **Quiz**: Answer correctly → see success + explanation. Answer wrong → see correction + explanation
12. **Progress**: Verify readiness score increases after successful quiz answers
13. **Mastery**: Verify topic mastery_percentage updates based on quiz performance

---

## Phase 2 — The Intelligence Layer

### Goal
The app becomes genuinely adaptive. It remembers what you've studied, brings back concepts at the right time via spaced repetition, rephrases explanations when you struggle, generates content in multiple formats (audio, flashcards, concept maps), checks on your wellbeing, and adjusts session pacing in real-time.

### Features

#### 2.1 SM-2 Spaced Repetition Engine
- Custom Python implementation of SM-2 algorithm
- After each quiz attempt, creates or updates spaced_repetition_cards
- Calculates: easiness_factor, interval_days, next_review_date based on quality score
- Exam-deadline-aware: compresses intervals if exam is approaching
- Review questions mixed into daily sessions (30% review, 70% new material)
- Between-session review nudges via notifications
- Quick 2-minute review micro-sessions accessible from dashboard

#### 2.2 Adaptive Rephrasing Engine (Duolingo-Style)
- When a student answers incorrectly, system does NOT just show the answer
- Claude Sonnet rephrases the concept in a different way
- Escalating rephrase strategy based on user profile:
  - First rephrase: different wording, same format
  - Second rephrase: switch modality (text → visual diagram description, or simpler vocabulary)
  - Third rephrase: step-by-step walkthrough of the concept
- Re-tests after each rephrase
- Concept doesn't clear until student demonstrates understanding
- Tracks rephrasing_needed and rephrase_format in quiz_attempts
- Progressive hint system: 3 hint layers per question, student chooses when to use

#### 2.3 Multi-Format Content Generation
- From any topic, generate multiple content formats:
  - **Text Summary**: condensed explanation at appropriate vocabulary level
  - **Flashcard Deck**: key term ↔ definition pairs, stored as JSONB
  - **Concept Map**: structured relationships between sub-concepts (JSON representation)
  - **Micro-Lesson**: TikTok-style short learning blocks (5-7 min each)
  - **Comparison Table**: for topics with contrasting concepts
  - **Mnemonic Devices**: memory aids generated for complex terms
- System recommends best formats based on user profile
- User can request additional formats from content toolkit
- All stored as content_blocks with appropriate content_type

#### 2.4 Audio Study Sessions (Deepgram Integration)
- Claude Sonnet generates audio scripts from topic content
- Scripts tailored to user profile (pacing, vocabulary, depth)
- Deepgram TTS converts scripts to natural speech audio
- Audio stored in Supabase Storage, referenced in audio_content table
- Interactive audio: pause points with quiz questions
  - Audio pauses at marked points
  - Question appears on screen
  - Student answers (tap or voice via Deepgram STT)
  - Feedback given, audio continues
- Multiple audio styles: casual conversation, structured lecture, debate format
- Playback controls: speed adjustment, skip, replay section

#### 2.5 Session Awareness & Pacing
- Track session duration in real-time
- Compare against user's attention_span_minutes from profile
- Mid-session check-in at ~75% of attention span ("Feeling good or need a break?")
- If break taken: offer 1-2 minute breathing exercise (Headspace layer) or simple pause
- Auto-adjust content block length based on observed session patterns
- If user consistently goes longer than profile suggests, update profile automatically
- If user consistently drops off early, shorten blocks and add more breaks

#### 2.6 Wellbeing Check-In Layer
- Pre-session mood/energy check: "How are you feeling?" (great/okay/stressed/burnt_out) + energy level (high/medium/low)
- Claude Haiku interprets check-in and adapts session:
  - Stressed + low energy → lighter review session, no new material
  - Great + high energy → full session, can push harder
  - Burnt out → suggest short session or skip day, offer breathing exercise
- Store check-in data in wellbeing_checkins table
- Track patterns over time (are they always burnt out on Mondays?)

#### 2.7 Prompt-Based Profile Editing (Enhanced)
- Full conversational profile editing via prompt bar
- Claude Sonnet interprets complex natural language adjustments
- Handles nuanced inputs like "I can do longer sessions on weekends but short ones during the week"
- Shows before/after of profile changes for confirmation
- Logs all edits in profile_edit_log with AI interpretation
- Profile evolves as a living document, not static settings

#### 2.8 Smart Notifications
- Spaced repetition review reminders at optimal times
- Daily study reminders based on study_time_preference
- Streak warning: "You haven't studied today, don't break your 5-day streak!"
- Milestone celebrations: "You just mastered your 5th topic!"
- Adaptive timing: learns when user actually opens notifications and shifts schedule

#### 2.9 Study Plan Adaptation
- System monitors actual progress vs planned progress
- If ahead of schedule: can reallocate time to weaker topics
- If behind: adjusts remaining days, prioritizes high-impact topics
- Mid-project check-in at ~50% mark: full progress report
- Material gap detection: "Your notes don't cover much about X, consider finding more material"
- Can regenerate study plan with updated priorities

### Phase 2 — Testing & Running Instructions

#### Additional Prerequisites
1. Get Deepgram API key at https://deepgram.com
2. Add to backend `.env`: DEEPGRAM_API_KEY

#### Database Updates
1. Run migration: `backend/database/migrations/002_phase2_schema.sql`
2. Verify new tables/columns added

#### Testing Checklist — Phase 2
1. **Spaced Repetition**: Complete a quiz, wait for next_review_date, verify review questions appear in next session
2. **SR Scheduling**: Check spaced_repetition_cards table — easiness_factor and interval should change based on answer quality
3. **Adaptive Rephrase**: Answer a question wrong, verify system rephrases (not just shows answer). Answer wrong again, verify it tries a different approach. On third wrong answer, verify step-by-step walkthrough
4. **Hints**: During a quiz, use hints progressively. Verify 3 layers of increasing specificity
5. **Multi-Format**: Open a topic, request flashcards, then summary, then concept map. Verify each generates correctly and displays differently
6. **Audio Generation**: Generate an audio lesson for a topic. Verify audio file created in Supabase Storage. Play it back — should sound natural and match user's vocabulary level
7. **Interactive Audio**: Play an audio lesson with pause points. Verify it pauses and shows a question. Answer it. Verify audio resumes
8. **Session Pacing**: Set profile attention span to 10 minutes. Start a session. At ~7-8 minutes, verify check-in appears
9. **Wellbeing**: Start a session, select "burnt_out" + "low energy" at check-in. Verify session adapts (lighter content, shorter)
10. **Profile Editing**: Type complex prompt like "I prefer shorter sessions on weekdays but longer on weekends". Verify profile updates with nuance
11. **Notifications**: Verify spaced repetition reminders arrive. Verify streak warning if no activity
12. **Plan Adaptation**: Complete several sessions ahead of schedule. Check if system suggests reallocating time. Complete sessions poorly — check if system adds reinforcement
13. **Gap Detection**: Upload sparse notes missing an obvious topic. Check if system flags the gap

---

## Phase 3 — The Polish

### Goal
The app becomes delightful and sticky. Full gamification, TikTok-style micro-lessons, mock exam mode, knowledge graph visualization, focus mode, and the complete post-exam experience. Feature-complete for demo.

### Features

#### 3.1 Gamification Engine
- **XP System**: Earn XP for completing sessions, answering correctly, maintaining streaks, mastering topics
- XP multiplier for accuracy streaks (consecutive correct answers boost XP rate, resets on wrong answer)
- **Streak System**: Daily streak counter, visual flame/badge, streak freeze (1 grace day)
- **Achievements/Badges**: 
  - First Session, 7-Day Streak, Topic Mastered, Perfect Quiz, Night Owl (studying past midnight), Early Bird, Marathon (60+ min session), Speed Demon (quiz answered in under 5 sec), Comeback (recovered from low readiness)
- Store in achievements table with XP awards
- **Celebration Animations**: Confetti, particle effects, sound effects on milestones (Framer Motion)
- **Daily XP Goal**: Target based on profile, visual progress bar

#### 3.2 TikTok-Style Micro-Lessons
- Content broken into ultra-short blocks (3-5 minutes max)
- Vertical scroll/swipe format — each block is one "screen"
- Visual-first: key point + supporting visual/diagram + minimal text
- Auto-advance to next block with smooth transition
- "Just one more" psychology — each block ends with a teaser for the next
- Progress dots showing position in sequence
- Can be generated for any topic via Claude Sonnet
- Integrates with quiz checkpoints between blocks

#### 3.3 Mock Exam Mode
- Activated in final 2-3 days before exam (or manually anytime)
- Claude Opus generates full-length practice exam from all project materials
- Timed mode matching real exam conditions
- Question variety: MCQ, short answer, essay prompts, case-based
- Weighted toward weak topics and previously failed questions
- Scoring rubric and detailed feedback after completion
- Comparison to previous mock attempts
- Identifies last-minute focus areas

#### 3.4 Cross-Material Intelligence & Knowledge Graph
- Analyze vector embeddings across all topics and materials
- Identify concept relationships across different uploads
- Visual knowledge graph: interactive node-link diagram
  - Nodes = topics/concepts
  - Edges = relationships (prerequisite, related, overlapping)
  - Color-coded by mastery level
  - Clickable — tap a node to study that topic
- "Did you know?" connections: "This biology concept relates to what you studied in chemistry"
- Powered by pgvector similarity search across project materials

#### 3.5 Focus Mode
- Dedicated distraction-free study interface
- Visual growth element (plant/building/progress art) that grows while studying
- Pauses/degrades if user leaves the app
- Focus timer with session stats
- Optional ambient background sounds (lo-fi, nature, white noise)
- Post-focus summary: time focused, content covered, focus score

#### 3.6 Enhanced Dashboard
- Project overview with all stats at a glance
- Multi-project view: see all active exams, suggested daily priority
- Cross-project time balancing: "Bio exam in 3 days, Chem in 7 — focus on Bio today"
- Calendar view of study plan
- Historical performance trends (charts)

#### 3.7 Exam Eve Experience
- Special notification the night before exam
- No quizzes — a summary of preparation: hours studied, topics mastered, readiness score
- Encouragement message: "You've put in the work. Trust your preparation."
- Optional short calming breathing exercise
- Quick reference card: top 5 concepts to glance at

#### 3.8 Post-Exam Flow
- After exam date passes, check-in: "How did it go?"
- Optional: log actual grade when received
- Study Wrapped summary (Spotify-style):
  - Total hours studied
  - Topics mastered
  - Questions answered
  - Strongest subject areas
  - Study personality insights ("You're a night owl who peaks at 11pm")
  - Streak achievements
  - Shareable card format for social media
- Project marked as completed
- Profile carries forward with learnings for next project

#### 3.9 Onboarding Polish
- Animated transitions between questions
- Micro-animations on selection
- Progress indicator during questionnaire
- Smooth transition from onboarding to first project creation

### Phase 3 — Testing & Running Instructions

#### Database Updates
1. Run migration: `backend/database/migrations/003_phase3_schema.sql`
2. Verify achievements table and any new columns

#### Testing Checklist — Phase 3
1. **XP System**: Complete a session, verify XP earned and displayed. Get multiple correct answers in a row — verify multiplier increases. Get one wrong — verify multiplier resets
2. **Streaks**: Study today, verify streak = 1. Study tomorrow, verify streak = 2. Skip a day, verify streak resets (or use freeze if implemented)
3. **Achievements**: Trigger various achievements (first session, streak milestones, topic mastery). Verify badge appears with celebration animation
4. **Celebrations**: On milestone events, verify confetti/animation plays
5. **Micro-Lessons**: Open a topic in micro-lesson format. Verify content appears in short swipeable blocks. Verify quiz checkpoint appears between blocks
6. **Mock Exam**: Trigger mock exam mode. Verify full exam generates with timer. Complete it. Verify scoring and feedback
7. **Knowledge Graph**: With multiple materials uploaded, open knowledge graph. Verify nodes and connections render. Click a node — verify it links to study material
8. **Focus Mode**: Enter focus mode, study for 5 minutes. Verify visual element grows. Leave and return — verify it paused. Check post-focus summary
9. **Enhanced Dashboard**: With multiple projects, verify priority suggestions appear. Verify calendar view shows study plan. Verify performance charts render
10. **Exam Eve**: Set exam date to tomorrow. Verify special notification and encouragement screen appears
11. **Post-Exam**: Set exam date to yesterday. Open project. Verify "How did it go?" flow triggers. Complete the flow. Verify Study Wrapped summary generates with stats
12. **Full Journey**: Run through the ENTIRE flow — sign up, onboard, create project, upload, study for multiple sessions, complete spaced reviews, take mock exam, see exam eve, complete post-exam. Verify everything connects smoothly

---

## Folder Structure

```
the-adaptive-brain/
├── frontend/
│   ├── public/
│   │   └── assets/           # Static images, sounds, icons
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── (auth)/       # Login, signup pages
│   │   │   ├── onboarding/   # Questionnaire flow
│   │   │   ├── dashboard/    # Main dashboard
│   │   │   ├── project/[id]/ # Project dashboard, study path
│   │   │   ├── session/[id]/ # Active study session
│   │   │   ├── profile/      # User profile page
│   │   │   ├── review/       # Spaced repetition review sessions
│   │   │   └── layout.tsx    # Root layout
│   │   ├── components/
│   │   │   ├── auth/         # Auth forms, guards
│   │   │   ├── onboarding/   # Question cards, progress bar
│   │   │   ├── dashboard/    # Project cards, stats widgets
│   │   │   ├── project/      # Study path, topic map, readiness score
│   │   │   ├── session/      # Content display, quiz UI, timer
│   │   │   ├── profile/      # Profile card, prompt editor
│   │   │   ├── gamification/ # XP bar, streak counter, achievements, celebrations
│   │   │   ├── audio/        # Audio player, interactive pause UI
│   │   │   ├── wellbeing/    # Check-in modal, breathing exercise
│   │   │   ├── knowledge-graph/ # Interactive graph visualization
│   │   │   └── ui/           # Shared UI components (buttons, modals, cards)
│   │   ├── stores/           # Zustand stores
│   │   │   ├── authStore.ts
│   │   │   ├── profileStore.ts
│   │   │   ├── projectStore.ts
│   │   │   ├── sessionStore.ts
│   │   │   └── gamificationStore.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts   # Supabase client
│   │   │   ├── api.ts        # Backend API client
│   │   │   └── utils.ts      # Helpers
│   │   ├── hooks/            # Custom React hooks
│   │   └── types/            # TypeScript type definitions
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── celery_app.py     # Celery configuration
│   │   ├── config.py         # Environment config
│   │   ├── api/
│   │   │   ├── auth.py       # Auth endpoints
│   │   │   ├── users.py      # User profile endpoints
│   │   │   ├── projects.py   # Project CRUD endpoints
│   │   │   ├── materials.py  # Material upload & processing endpoints
│   │   │   ├── topics.py     # Topic endpoints
│   │   │   ├── study_plans.py # Study plan endpoints
│   │   │   ├── sessions.py   # Study session endpoints
│   │   │   ├── quiz.py       # Quiz generation & attempt endpoints
│   │   │   ├── content.py    # Content transformation endpoints
│   │   │   ├── audio.py      # Audio generation endpoints
│   │   │   ├── spaced_repetition.py # SR card endpoints
│   │   │   ├── wellbeing.py  # Wellbeing check-in endpoints
│   │   │   ├── notifications.py # Notification endpoints
│   │   │   └── gamification.py # XP, streaks, achievements endpoints
│   │   ├── services/
│   │   │   ├── ai_engine.py      # Claude API integration (all tiers)
│   │   │   ├── ocr_engine.py     # Hunyuan OCR processing
│   │   │   ├── audio_engine.py   # Deepgram TTS/STT integration
│   │   │   ├── embedding_engine.py # Vector embedding generation
│   │   │   ├── sm2_engine.py     # SM-2 spaced repetition algorithm
│   │   │   ├── study_plan_service.py # Plan generation logic
│   │   │   ├── content_service.py    # Content transformation logic
│   │   │   ├── quiz_service.py       # Quiz generation & evaluation
│   │   │   ├── session_service.py    # Session management logic
│   │   │   ├── profile_service.py    # Profile interpretation & update
│   │   │   ├── gamification_service.py # XP calculation, streaks, achievements
│   │   │   └── notification_service.py # Notification scheduling & dispatch
│   │   ├── tasks/
│   │   │   ├── process_material.py   # Celery task: OCR + embedding
│   │   │   ├── generate_plan.py      # Celery task: study plan creation
│   │   │   ├── generate_audio.py     # Celery task: audio content
│   │   │   ├── generate_content.py   # Celery task: content blocks
│   │   │   └── schedule_reviews.py   # Celery task: SR notification scheduling
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic models for request/response
│   │   └── prompts/
│   │       ├── topic_extraction.py    # Prompt templates for topic extraction
│   │       ├── study_plan.py          # Prompt templates for plan generation
│   │       ├── content_transform.py   # Prompt templates for content formats
│   │       ├── quiz_generation.py     # Prompt templates for quiz creation
│   │       ├── answer_evaluation.py   # Prompt templates for answer checking
│   │       ├── rephrase.py            # Prompt templates for concept rephrasing
│   │       ├── audio_script.py        # Prompt templates for audio scripts
│   │       ├── profile_edit.py        # Prompt templates for profile interpretation
│   │       ├── wellbeing.py           # Prompt templates for wellbeing adaptation
│   │       ├── mock_exam.py           # Prompt templates for mock exam generation
│   │       └── gap_detection.py       # Prompt templates for material gap analysis
│   ├── database/
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql  # Phase 1 tables
│   │       ├── 002_phase2_schema.sql   # Phase 2 additions
│   │       └── 003_phase3_schema.sql   # Phase 3 additions
│   ├── .env.example
│   └── requirements.txt
├── architecture.md
├── project_plan.md
├── task.md
└── README.md
```
