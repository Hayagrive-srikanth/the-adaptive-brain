# The Adaptive Brain — Task File for AI Agents

## IMPORTANT INSTRUCTIONS FOR AGENTS

### Rules
1. **DO NOT test or run files after creating them.** Just create the file, write the code, and move to the next task.
2. **DO NOT run npm test, pytest, or any test commands.** Testing is done manually by the developer at the end of each phase.
3. **DO NOT debug during build.** If you're unsure about something, make your best decision and move on.
4. **Create files in the exact order listed.** Later files may depend on earlier ones.
5. **Follow the folder structure defined in project_plan.md exactly.**
6. **Use the tech stack defined in architecture.md. Do not substitute libraries.**
7. **All prompts to Claude API should be thorough, well-structured, and include the user profile context for personalization.**
8. **Every API endpoint should include proper error handling with try/except and meaningful HTTP status codes.**
9. **All database operations go through Supabase Python client, not raw SQL.**
10. **Frontend components should be clean, accessible, and use Tailwind CSS exclusively for styling.**

### Tech Stack Reference
- Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Zustand
- Backend: FastAPI, Python 3.11+, Celery, Redis
- Database: Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime)
- AI: Anthropic Claude API (Opus/Sonnet/Haiku), Hunyuan OCR, Deepgram (TTS/STT)
- Spaced Repetition: SM-2 algorithm (custom implementation)

### Design Direction for UI/UX
- **Overall Aesthetic**: Modern, clean, calming. Think Headspace meets Duolingo. Rounded corners, soft shadows, generous whitespace.
- **Color Palette**: Primary — a calming blue-purple gradient. Secondary — warm orange for gamification elements (XP, streaks, celebrations). Success — green. Warning — amber. Error — soft red. Backgrounds — very light gray (#F8F9FA) with white cards.
- **Typography**: Clean sans-serif. Large readable headings. Body text at minimum 16px for accessibility.
- **Gamification Visuals**: The study path should feel playful like Duolingo — colorful nodes, connecting lines, bouncy animations. Progress bars should be chunky and satisfying. Celebrations should use confetti particles and scale animations.
- **Cards**: Content should be organized in cards with subtle shadows. Each card should have clear hierarchy — title, supporting info, action.
- **Accessibility**: All interactive elements must have proper focus states. Color should never be the only indicator — always pair with icons or text. Minimum contrast ratio 4.5:1.
- **Responsive**: Mobile-first design. Everything must work on 375px width and up. Desktop max-width container at 1280px.
- **Loading States**: Skeleton loaders for content, spinner for actions. Never show a blank screen.
- **Empty States**: Friendly illustrations or messages for empty dashboards, no projects, etc.
- **Animations**: Subtle entrance animations on page load (fade up). Path nodes should have a gentle pulse on the active node. Page transitions should be smooth fades. Quiz feedback should have quick satisfying animations (checkmark bounce for correct, gentle shake for incorrect).

---

## PHASE 1 — THE CORE LOOP

### Task 1.1: Project Initialization

#### Task 1.1.1: Initialize Frontend
Create the Next.js project with all dependencies.

```bash
npx create-next-app@14 frontend --typescript --tailwind --app --src-dir --eslint
cd frontend
npm install zustand framer-motion @supabase/supabase-js @supabase/auth-helpers-nextjs lucide-react
```

#### Task 1.1.2: Initialize Backend
Create the backend project structure.

```bash
mkdir -p backend/app/{api,services,tasks,models,prompts}
mkdir -p backend/database/migrations
```

Create `backend/requirements.txt`:
```
fastapi==0.109.0
uvicorn==0.27.0
celery==5.3.6
redis==5.0.1
supabase==2.3.0
anthropic==0.18.0
python-multipart==0.0.6
python-dotenv==1.0.0
pydantic==2.5.3
PyMuPDF==1.23.8
python-docx==1.1.0
python-pptx==0.6.23
Pillow==10.2.0
numpy==1.26.3
httpx==0.26.0
```

#### Task 1.1.3: Create Environment Files

Create `frontend/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `backend/.env.example`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
REDIS_URL=redis://localhost:6379/0
HUNYUAN_OCR_PATH=/path/to/hunyuan-ocr
```

---

### Task 1.2: Database Schema

#### Task 1.2.1: Create Phase 1 Migration
Create `backend/database/migrations/001_initial_schema.sql`

This SQL file should:
- Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Enable uuid-ossp extension: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Create `users` table: id (UUID, references auth.users), email (VARCHAR UNIQUE), name (VARCHAR), profile (JSONB DEFAULT '{}'), total_xp (INT DEFAULT 0), current_streak (INT DEFAULT 0), longest_streak (INT DEFAULT 0), last_active_date (DATE), onboarding_completed (BOOLEAN DEFAULT false), created_at (TIMESTAMPTZ DEFAULT now()), updated_at (TIMESTAMPTZ DEFAULT now())
- Create `projects` table: id (UUID DEFAULT uuid_generate_v4()), user_id (UUID FK → users), name (VARCHAR NOT NULL), exam_date (DATE NOT NULL), hours_per_day (DECIMAL), comfort_level (VARCHAR), readiness_score (DECIMAL DEFAULT 0), status (VARCHAR DEFAULT 'active'), created_at, updated_at
- Create `source_materials` table: id (UUID), project_id (UUID FK → projects), original_filename (VARCHAR), file_type (VARCHAR), storage_path (VARCHAR), processing_status (VARCHAR DEFAULT 'pending'), ocr_text (TEXT), embedding (vector(1536)), page_count (INT), created_at
- Create `topics` table: id (UUID), project_id (UUID FK → projects), name (VARCHAR), description (TEXT), difficulty (VARCHAR), prerequisite_ids (UUID[]), mastery_percentage (DECIMAL DEFAULT 0), status (VARCHAR DEFAULT 'not_started'), estimated_minutes (INT), path_order (INT), source_material_ids (UUID[]), embedding (vector(1536)), created_at, updated_at
- Create `study_plans` table: id (UUID), project_id (UUID FK → projects), total_days (INT), daily_target_minutes (INT), status (VARCHAR DEFAULT 'active'), generated_at (TIMESTAMPTZ DEFAULT now()), regenerated_count (INT DEFAULT 0)
- Create `study_plan_days` table: id (UUID), plan_id (UUID FK → study_plans), day_number (INT), date (DATE), topic_ids (UUID[]), session_type (VARCHAR), estimated_minutes (INT), completed (BOOLEAN DEFAULT false), actual_minutes (INT)
- Create `study_sessions` table: id (UUID), project_id (UUID FK → projects), plan_day_id (UUID FK → study_plan_days NULLABLE), started_at (TIMESTAMPTZ DEFAULT now()), ended_at (TIMESTAMPTZ), duration_minutes (INT), topics_covered (UUID[]), session_type (VARCHAR), pauses_taken (INT DEFAULT 0), completed (BOOLEAN DEFAULT false), xp_earned (INT DEFAULT 0)
- Create `content_blocks` table: id (UUID), topic_id (UUID FK → topics), content_type (VARCHAR), content_body (JSONB), format_metadata (JSONB), generated_by (VARCHAR), duration_estimate_minutes (INT), created_at
- Create `quiz_questions` table: id (UUID), topic_id (UUID FK → topics), question_type (VARCHAR), question_text (TEXT), options (JSONB), correct_answer (TEXT), explanation (TEXT), difficulty (VARCHAR), hint_layers (JSONB), times_shown (INT DEFAULT 0), times_correct (INT DEFAULT 0), last_shown_at (TIMESTAMPTZ), created_at
- Create `quiz_attempts` table: id (UUID), question_id (UUID FK → quiz_questions), session_id (UUID FK → study_sessions), user_answer (TEXT), correct (BOOLEAN), time_taken_seconds (INT), hints_used (INT DEFAULT 0), rephrasing_needed (BOOLEAN DEFAULT false), rephrase_format (VARCHAR), attempted_at (TIMESTAMPTZ DEFAULT now())
- Create `profile_edit_log` table: id (UUID), user_id (UUID FK → users), user_prompt (TEXT), fields_changed (JSONB), ai_interpretation (TEXT), created_at (TIMESTAMPTZ DEFAULT now())
- Create all indexes defined in architecture.md
- Add Row Level Security policies for all tables (user can only access their own data)

---

### Task 1.3: Backend Configuration

#### Task 1.3.1: Create Config
Create `backend/app/config.py`
- Load all env vars using python-dotenv
- Export as a Settings class: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REDIS_URL, HUNYUAN_OCR_PATH

#### Task 1.3.2: Create FastAPI App
Create `backend/app/main.py`
- Initialize FastAPI app with CORS middleware (allow frontend origin)
- Include all API routers from api/ directory
- Health check endpoint at GET /

#### Task 1.3.3: Create Celery App
Create `backend/app/celery_app.py`
- Configure Celery with Redis broker from config
- Auto-discover tasks from app.tasks package

#### Task 1.3.4: Create Pydantic Schemas
Create `backend/app/models/schemas.py`
- Define request/response models for ALL entities:
  - UserProfile, UserCreate, UserResponse
  - ProjectCreate, ProjectResponse
  - MaterialUploadResponse, MaterialStatus
  - TopicResponse, TopicListResponse
  - StudyPlanResponse, StudyPlanDayResponse
  - SessionCreate, SessionResponse, SessionWrapUp
  - ContentBlockResponse
  - QuizQuestionResponse, QuizAttemptCreate, QuizAttemptResponse, QuizFeedback
  - ProfileEditRequest, ProfileEditResponse
  - OnboardingRequest (list of question-answer pairs)

---

### Task 1.4: Backend Services

#### Task 1.4.1: AI Engine Service
Create `backend/app/services/ai_engine.py`
- Initialize Anthropic client
- Methods:
  - `call_opus(system_prompt, user_message)` → response text
  - `call_sonnet(system_prompt, user_message)` → response text
  - `call_haiku(system_prompt, user_message)` → response text
- All methods should handle errors gracefully and return structured responses
- Include retry logic (3 attempts with exponential backoff)

#### Task 1.4.2: OCR Engine Service
Create `backend/app/services/ocr_engine.py`
- Initialize Hunyuan OCR model
- Method: `process_document(file_path, file_type)` → extracted text string
- Handle different file types:
  - PDF: extract pages as images, run OCR on each
  - Images (PNG, JPG): run OCR directly
  - DOCX: extract text using python-docx (no OCR needed), extract embedded images and OCR those
  - PPTX: extract text using python-pptx (no OCR needed), extract embedded images and OCR those
- Combine all extracted text in page order
- Return clean text with page markers

#### Task 1.4.3: Embedding Engine Service
Create `backend/app/services/embedding_engine.py`
- Use Claude or a lightweight embedding approach to generate vector embeddings from text
- Method: `generate_embedding(text)` → list of floats (1536 dimensions)
- Method: `search_similar(query_embedding, project_id, limit)` → list of matching materials/topics
- Note: For prototype, can use a simple approach. If using Anthropic's Voyage embeddings or similar, configure here. If not available, use a local sentence-transformers model.

#### Task 1.4.4: Study Plan Service
Create `backend/app/services/study_plan_service.py`
- Method: `generate_plan(project_id, topics, user_profile, exam_date, hours_per_day, comfort_level)` → StudyPlan
- Calls Claude Opus with a detailed prompt that includes:
  - All topic names, descriptions, difficulties, prerequisites, estimated times
  - User profile (learning style, attention span, engagement preference)
  - Available days and hours per day
  - Comfort level with material
- Prompt should instruct Claude to return a structured JSON with:
  - Day-by-day schedule
  - Topics assigned to each day
  - Session type per day (new_material, review, mixed, mock_exam)
  - Estimated minutes per day
  - Last 2-3 days should be review + mock exam
- Parse Claude's response and create study_plan + study_plan_days records

#### Task 1.4.5: Content Service
Create `backend/app/services/content_service.py`
- Method: `generate_content_block(topic_id, user_profile, content_type)` → ContentBlock
- Calls Claude Sonnet with topic content and user profile
- Content types for Phase 1: "summary" and "micro_lesson"
- Prompt should:
  - Include the full topic text from source materials
  - Include user profile for personalization (vocabulary level, depth, pacing)
  - Specify the output format expected
  - For summaries: structured explanation with key points
  - For micro_lessons: broken into 5-7 minute chunks with clear sections
- Return structured JSON stored as content_body

#### Task 1.4.6: Quiz Service
Create `backend/app/services/quiz_service.py`
- Method: `generate_questions(topic_id, count, difficulty, user_profile)` → list of QuizQuestions
- Calls Claude Opus to generate quiz questions from topic content
- Prompt includes: topic content, desired count, difficulty level, user's vocabulary level
- Returns structured questions with: question_text, question_type, options (for MCQ), correct_answer, explanation, hint_layers (3 progressive hints)
- Method: `evaluate_answer(question_id, user_answer)` → QuizFeedback
- Compares user answer to correct answer
- For MCQ/true-false: exact match
- For fill_blank/short_answer: use Claude Sonnet to evaluate semantic correctness
- Returns: correct (bool), explanation, the correct answer if wrong
- Method: `update_mastery(topic_id)` → new mastery percentage
- Calculate from quiz_attempts: (correct_count / total_count) * 100 for that topic
- Update topic record and project readiness_score

#### Task 1.4.7: Session Service
Create `backend/app/services/session_service.py`
- Method: `start_session(project_id, plan_day_id)` → Session
- Creates study_session record
- Fetches today's planned topics and content
- Returns session data with content blocks and quiz questions ready
- Method: `end_session(session_id, topics_covered)` → SessionWrapUp
- Updates session record with end time, duration, topics covered
- Calculates XP earned (base XP per session + bonus for accuracy)
- Returns wrap-up data: topics covered, accuracy rate, XP earned, readiness score change
- Method: `get_session_content(session_id, topic_id, user_profile)` → content for next topic
- Generates or retrieves content blocks for the topic
- Includes quiz questions for active recall

#### Task 1.4.8: Profile Service
Create `backend/app/services/profile_service.py`
- Method: `create_profile_from_onboarding(answers)` → profile JSON
- Takes the 7 question-answer pairs from onboarding
- Maps answers to profile JSON structure defined in architecture.md
- Method: `interpret_profile_edit(current_profile, user_prompt)` → updated profile + changes
- Calls Claude Sonnet with current profile and user's natural language edit request
- Prompt instructs Claude to return JSON with: updated_profile (full), fields_changed (dict of {field: {before, after}}), interpretation (text summary of what was understood)
- Logs edit in profile_edit_log table

---

### Task 1.5: Prompt Templates

#### Task 1.5.1: Topic Extraction Prompts
Create `backend/app/prompts/topic_extraction.py`
- System prompt for Claude Opus that instructs it to:
  - Analyze provided academic text
  - Identify all major topics and subtopics
  - Determine difficulty level for each (foundational/intermediate/advanced)
  - Identify prerequisite relationships between topics
  - Estimate study time per topic in minutes
  - Return as structured JSON array
- Include few-shot example of expected output format

#### Task 1.5.2: Study Plan Prompts
Create `backend/app/prompts/study_plan.py`
- System prompt for Claude Opus that instructs it to:
  - Create an optimal day-by-day study schedule
  - Respect prerequisite ordering
  - Front-load foundational topics
  - Balance daily study load within available hours
  - Reserve final days for review and mock exams
  - Consider user's attention span for session sizing
  - Return as structured JSON

#### Task 1.5.3: Content Transform Prompts
Create `backend/app/prompts/content_transform.py`
- System prompt for Claude Sonnet for each content type:
  - Summary: "Create a clear, structured summary of this topic. Adapt vocabulary to {level}. Highlight key terms. Include examples."
  - Micro-lesson: "Break this topic into bite-sized learning blocks of ~5 minutes each. Each block should cover one concept. Use {modality} preferred format."
- All prompts include user profile context for personalization

#### Task 1.5.4: Quiz Generation Prompts
Create `backend/app/prompts/quiz_generation.py`
- System prompt for Claude Opus:
  - Generate {count} questions about the topic
  - Mix question types: MCQ, true/false, fill-in-blank
  - Each question must include: the question, correct answer, wrong answer explanation, 3 progressive hints
  - Difficulty should be {level}
  - Vocabulary adapted to user's language comfort level
  - Return as structured JSON array

#### Task 1.5.5: Answer Evaluation Prompts
Create `backend/app/prompts/answer_evaluation.py`
- System prompt for Claude Sonnet:
  - Evaluate if the student's answer is correct
  - For short-answer: accept semantically equivalent answers even if wording differs
  - Return: correct (bool), feedback (text), explanation if wrong

#### Task 1.5.6: Profile Edit Prompts
Create `backend/app/prompts/profile_edit.py`
- System prompt for Claude Sonnet:
  - Current profile provided as JSON
  - User's natural language request provided
  - Interpret what the user wants changed
  - Return updated profile JSON + summary of changes
  - Handle nuanced requests ("shorter sessions on weekdays")

---

### Task 1.6: Celery Tasks

#### Task 1.6.1: Material Processing Task
Create `backend/app/tasks/process_material.py`
- Celery task: `process_material(material_id)`
- Steps:
  1. Fetch material record from Supabase
  2. Download file from Supabase Storage to temp directory
  3. Update status to "processing"
  4. Run OCR engine on file
  5. Store extracted text in ocr_text column
  6. Generate vector embedding from extracted text
  7. Store embedding in embedding column
  8. Update status to "completed"
  9. If error at any step, update status to "failed" and log error

#### Task 1.6.2: Generate Plan Task
Create `backend/app/tasks/generate_plan.py`
- Celery task: `generate_study_plan(project_id)`
- Steps:
  1. Fetch all completed source materials for the project
  2. Combine all OCR text
  3. Call topic extraction via AI engine
  4. Store topics in database
  5. Call study plan generation via study plan service
  6. Store plan and plan days in database
  7. Update project status

#### Task 1.6.3: Generate Content Task
Create `backend/app/tasks/generate_content.py`
- Celery task: `generate_content_blocks(topic_id, user_profile, content_types)`
- Steps:
  1. Fetch topic and its source material text
  2. For each requested content type, call content service
  3. Store content blocks in database

---

### Task 1.7: API Endpoints

#### Task 1.7.1: Auth Endpoints
Create `backend/app/api/auth.py`
- POST `/api/auth/signup` — Create user in Supabase Auth + users table
- POST `/api/auth/signin` — Sign in via Supabase Auth
- POST `/api/auth/signout` — Sign out
- GET `/api/auth/me` — Get current user from Supabase auth token
- All endpoints validate Supabase JWT token from Authorization header

#### Task 1.7.2: User Endpoints
Create `backend/app/api/users.py`
- POST `/api/users/onboarding` — Accept 7 question-answer pairs, generate profile, update user
- GET `/api/users/profile` — Get current user profile
- POST `/api/users/profile/edit` — Accept natural language prompt, interpret and update profile
- GET `/api/users/stats` — Get user stats (total XP, streak, total study time)

#### Task 1.7.3: Project Endpoints
Create `backend/app/api/projects.py`
- POST `/api/projects` — Create new project (name, exam_date, hours_per_day, comfort_level)
- GET `/api/projects` — List all user projects
- GET `/api/projects/{id}` — Get project details with readiness score, topic summary
- PUT `/api/projects/{id}` — Update project details
- DELETE `/api/projects/{id}` — Archive project

#### Task 1.7.4: Material Endpoints
Create `backend/app/api/materials.py`
- POST `/api/projects/{id}/materials` — Upload file(s), store in Supabase Storage, create records, trigger Celery processing task
- GET `/api/projects/{id}/materials` — List materials with processing status
- GET `/api/materials/{id}/status` — Check individual material processing status
- DELETE `/api/materials/{id}` — Delete material and its storage file

#### Task 1.7.5: Topic Endpoints
Create `backend/app/api/topics.py`
- GET `/api/projects/{id}/topics` — List all topics for project with mastery percentages
- GET `/api/topics/{id}` — Get topic details with content blocks
- POST `/api/projects/{id}/topics/generate` — Trigger topic extraction from materials (calls Celery task)

#### Task 1.7.6: Study Plan Endpoints
Create `backend/app/api/study_plans.py`
- POST `/api/projects/{id}/plan/generate` — Generate study plan (calls Celery task)
- GET `/api/projects/{id}/plan` — Get active study plan with all days
- GET `/api/projects/{id}/plan/today` — Get today's plan day specifically

#### Task 1.7.7: Session Endpoints
Create `backend/app/api/sessions.py`
- POST `/api/sessions/start` — Start a new study session (project_id, plan_day_id)
- POST `/api/sessions/{id}/end` — End session, get wrap-up summary
- GET `/api/sessions/{id}` — Get session details
- GET `/api/sessions/{id}/content/{topic_id}` — Get content for a specific topic in the session
- GET `/api/projects/{id}/sessions` — List all sessions for a project

#### Task 1.7.8: Quiz Endpoints
Create `backend/app/api/quiz.py`
- POST `/api/topics/{id}/questions/generate` — Generate quiz questions for a topic
- GET `/api/topics/{id}/questions` — Get existing questions for a topic
- POST `/api/quiz/attempt` — Submit an answer attempt, get feedback
- GET `/api/sessions/{id}/quiz-results` — Get all quiz results for a session

---

### Task 1.8: Frontend — Foundation

#### Task 1.8.1: Supabase Client
Create `frontend/src/lib/supabase.ts`
- Initialize Supabase client with env vars
- Export client for use across app

#### Task 1.8.2: API Client
Create `frontend/src/lib/api.ts`
- Axios or fetch wrapper for backend API calls
- Base URL from env
- Auto-include Supabase auth token in headers
- Methods for all backend endpoints (organized by domain: auth, users, projects, materials, topics, plans, sessions, quiz)

#### Task 1.8.3: Type Definitions
Create `frontend/src/types/index.ts`
- TypeScript interfaces for all entities: User, UserProfile, Project, SourceMaterial, Topic, StudyPlan, StudyPlanDay, StudySession, ContentBlock, QuizQuestion, QuizAttempt, QuizFeedback, SessionWrapUp
- Match the Pydantic schemas from backend

#### Task 1.8.4: Zustand Stores
Create `frontend/src/stores/authStore.ts`
- State: user, session, loading
- Actions: signUp, signIn, signOut, fetchUser, setUser

Create `frontend/src/stores/profileStore.ts`
- State: profile, loading
- Actions: fetchProfile, updateProfile, submitOnboarding

Create `frontend/src/stores/projectStore.ts`
- State: projects, currentProject, loading
- Actions: fetchProjects, createProject, fetchProject, uploadMaterial, fetchMaterials

Create `frontend/src/stores/sessionStore.ts`
- State: currentSession, currentContent, currentQuiz, sessionProgress, loading
- Actions: startSession, endSession, fetchContent, submitAnswer, nextTopic

Create `frontend/src/stores/gamificationStore.ts`
- State: xp, streak, achievements
- Actions: fetchStats, addXP, updateStreak

---

### Task 1.9: Frontend — Pages & Components

#### Task 1.9.1: Root Layout
Create `frontend/src/app/layout.tsx`
- Global layout with Tailwind setup
- Font configuration (Inter or similar clean sans-serif)
- Metadata: title "The Adaptive Brain", description

#### Task 1.9.2: Auth Pages
Create `frontend/src/app/(auth)/login/page.tsx`
- Clean sign-in form: email + password
- Google sign-in button
- Link to signup
- Uses Supabase Auth

Create `frontend/src/app/(auth)/signup/page.tsx`
- Clean sign-up form: name, email, password
- Google sign-up button
- Link to login
- On success: create user record in users table, redirect to onboarding

Create `frontend/src/components/auth/AuthGuard.tsx`
- Wrapper component that checks auth state
- Redirects to login if not authenticated
- Redirects to onboarding if authenticated but onboarding not completed
- Renders children if authenticated and onboarded

#### Task 1.9.3: Onboarding
Create `frontend/src/app/onboarding/page.tsx`
- Full-screen onboarding flow
- Progress indicator (step X of 7)
- One question per screen with animated transitions (Framer Motion fade/slide)

Create `frontend/src/components/onboarding/QuestionCard.tsx`
- Displays question text
- Multiple choice options as large tappable cards/buttons
- Selected state with visual feedback
- Animated selection

Create `frontend/src/components/onboarding/ProfileSummary.tsx`
- After all questions: shows generated profile as a visual "learning identity card"
- Each trait displayed with an icon and friendly description
- "Looks good, let's go" button
- Subtle prompt to edit if needed

The 7 questions and their options:

1. "How do you prefer to take in information?"
   - Reading text
   - Listening to audio
   - Watching visuals & diagrams
   - A mix of everything

2. "When you sit down to study, how long before you usually lose focus?"
   - Under 10 minutes
   - 10 to 20 minutes
   - 20 to 40 minutes
   - Over 40 minutes

3. "How do you feel about quizzes and challenges while studying?"
   - Love them — they keep me engaged
   - They're fine in small doses
   - I prefer to just review at my own pace

4. "Is English your first language?"
   - Yes
   - No, but I'm comfortable with academic English
   - No, and I sometimes struggle with complex terminology

5. "Do you identify with any of these? (Select all that apply)"
   - ADHD or attention difficulties
   - Dyslexia or reading difficulties
   - Autism
   - None of these
   - Prefer not to say

6. "When do you usually study?"
   - Morning
   - Afternoon
   - Evening
   - Late night
   - It varies

7. "What motivates you most?"
   - Seeing my progress in stats
   - Daily streaks and goals
   - Competing with friends
   - Just passing the exam

#### Task 1.9.4: Dashboard
Create `frontend/src/app/dashboard/page.tsx`
- Main landing page after auth
- Greeting with user's name
- List of active projects as cards
- Each card shows: project name, exam date, days remaining, readiness score progress bar
- "Create New Project" button prominently placed
- If no projects: friendly empty state encouraging first project creation

Create `frontend/src/components/dashboard/ProjectCard.tsx`
- Card displaying project summary
- Visual readiness progress bar (0-100%)
- Days remaining badge
- Click navigates to project dashboard

#### Task 1.9.5: Project Creation
Create `frontend/src/app/project/new/page.tsx`
- Step-by-step project creation:
  - Step 1: Project name input + exam date picker (auto-calculates days remaining) + hours per day + comfort level (3 options: Starting from scratch / I know the basics / Just need to review)
  - Step 2: Material upload zone — large drag-and-drop area, or tap to browse. Accept .pdf, .png, .jpg, .docx, .pptx, .mp3, .wav. Show uploaded files as a list with file icons and names. Allow multiple uploads. Show individual processing status per file.
  - Step 3: Processing screen — friendly animation while materials are being processed. "Reading through your notes..." message. Poll material status endpoints. When all complete, show "Materials processed!" and trigger topic extraction + plan generation.
  - Step 4: The Magic Moment — show generated study plan as the Duolingo path. "I found X topics in your materials. Here's your Y-day plan." Big "Start Day 1" button.

#### Task 1.9.6: Project Dashboard
Create `frontend/src/app/project/[id]/page.tsx`
- The command center for a specific project
- Components:

Create `frontend/src/components/project/StudyPath.tsx`
- Duolingo-style vertical path with nodes
- Each node = a topic
- Node states: locked (gray, prerequisites not met), available (colored, pulsing gently), in_progress (highlighted), mastered (gold/green with checkmark)
- Connecting lines between nodes
- Scroll to current position
- Click on available/in-progress node to study that topic

Create `frontend/src/components/project/ReadinessScore.tsx`
- Large circular progress indicator
- Percentage in center
- Color changes as it increases (red → orange → yellow → green)
- Animated on change

Create `frontend/src/components/project/TopicMap.tsx`
- Grid or list of all topics
- Each shows: name, difficulty badge, mastery percentage bar, status icon
- Sortable by mastery or path order
- Click navigates to topic detail or starts study session for that topic

Create `frontend/src/components/project/TodaySession.tsx`
- Prominent card showing today's planned study
- Topics scheduled for today
- Estimated time
- "Start Studying" button
- If already completed today: show completion status

#### Task 1.9.7: Study Session
Create `frontend/src/app/session/[id]/page.tsx`
- The active study experience
- Flow:
  1. Session intro: brief context setter ("Today we're covering X")
  2. Content delivery: display content block for current topic
  3. After content: quiz checkpoint (questions appear one at a time)
  4. After quiz: topic completion status, move to next topic or session end
  5. Session wrap-up when all topics done or user ends early

Create `frontend/src/components/session/ContentDisplay.tsx`
- Renders content blocks based on content_type
- For "summary": formatted text with highlighted key terms, sections
- For "micro_lesson": step-through blocks with progress dots, each block is a card that transitions to next
- Clean readable typography, generous spacing

Create `frontend/src/components/session/QuizInterface.tsx`
- Question display with type-appropriate input:
  - Multiple choice: option buttons
  - True/false: two large buttons
  - Fill in blank: text input
- Submit button
- Feedback overlay: correct (green checkmark + animation) or incorrect (explanation + correct answer)
- Progress indicator (question X of Y)

Create `frontend/src/components/session/SessionWrapUp.tsx`
- Summary card after session ends
- Stats: topics covered, questions answered, accuracy percentage, time spent
- XP earned display
- Readiness score change (before → after with animation)
- "See you tomorrow" message with preview of next day's topics
- Button to return to project dashboard

#### Task 1.9.8: Profile Page
Create `frontend/src/app/profile/page.tsx`
- "Learning Identity Card" layout

Create `frontend/src/components/profile/ProfileCard.tsx`
- Visual display of all profile dimensions
- Each trait shown as a labeled section with icon:
  - Learning Modality (with icon: headphones/eye/book/mix)
  - Attention Span (clock icon + "~X minutes")
  - Engagement Style (game controller/book icon)
  - Language (globe icon + level)
  - Study Time (sun/moon icon)
  - Motivation (chart/fire/people/target icon)
- Each with a friendly explanation: "You learn best by listening. We'll prioritize audio content for you."
- Subtle visual personality to make it feel personal, not clinical

Create `frontend/src/components/profile/ProfilePromptEditor.tsx`
- Text input bar at bottom of profile page (like a chat input)
- Placeholder text: "Tell me what to change — e.g., 'I actually prefer shorter sessions'"
- Submit sends to backend profile edit endpoint
- On response: animate the changed fields on the profile card (highlight briefly)
- Show confirmation: "Got it! Updated your session preference."

#### Task 1.9.9: Shared UI Components
Create `frontend/src/components/ui/Button.tsx`
- Primary, secondary, ghost variants
- Loading state with spinner
- Disabled state
- Proper Tailwind styling with rounded corners, transitions

Create `frontend/src/components/ui/Card.tsx`
- Reusable card with subtle shadow
- Variants: default, highlighted, interactive (hover effect)

Create `frontend/src/components/ui/ProgressBar.tsx`
- Animated horizontal progress bar
- Color prop
- Percentage label option

Create `frontend/src/components/ui/Modal.tsx`
- Overlay modal with Framer Motion enter/exit animation
- Close button, click-outside to close

Create `frontend/src/components/ui/Loader.tsx`
- Skeleton loader for content areas
- Spinner for actions

Create `frontend/src/components/ui/EmptyState.tsx`
- Friendly message + optional illustration placeholder
- Action button

---

## PHASE 2 — THE INTELLIGENCE LAYER

### Task 2.1: Database Updates

#### Task 2.1.1: Phase 2 Migration
Create `backend/database/migrations/002_phase2_schema.sql`
- Create `spaced_repetition_cards` table (schema from architecture.md)
- Create `audio_content` table (schema from architecture.md)
- Create `wellbeing_checkins` table (schema from architecture.md)
- Create `notifications` table (schema from architecture.md)
- Add indexes on spaced_repetition_cards (user_id, next_review_date)
- Add indexes on notifications (user_id, scheduled_at, sent)

---

### Task 2.2: Backend — Spaced Repetition

#### Task 2.2.1: SM-2 Engine
Create `backend/app/services/sm2_engine.py`
- Implement SM-2 algorithm:
  - Input: quality (0-5), current easiness_factor, current interval, current repetition_count
  - Output: new easiness_factor, new interval, new repetition_count, next_review_date
  - SM-2 formula:
    - If quality >= 3: interval = 1 (first rep), 6 (second rep), then previous * easiness_factor
    - If quality < 3: reset interval to 1, repetition to 0
    - Easiness: EF' = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), minimum 1.3
  - Exam-deadline-aware: if next_review_date would be after exam_date, compress interval
- Method: `process_attempt(card_id, quality_score, exam_date)` → updated card
- Method: `get_due_cards(user_id, date)` → list of cards due for review
- Method: `create_card(user_id, question_id)` → new spaced_repetition_card

#### Task 2.2.2: Spaced Repetition API
Create `backend/app/api/spaced_repetition.py`
- GET `/api/reviews/due` — Get all cards due for review today
- POST `/api/reviews/attempt` — Submit a review attempt (question_id, quality_score), updates SM-2 card
- GET `/api/reviews/stats` — Get SR stats (cards due, cards reviewed today, total cards)

#### Task 2.2.3: Review Scheduling Task
Create `backend/app/tasks/schedule_reviews.py`
- Celery periodic task: runs daily
- For each user with active projects:
  - Check for cards due today
  - If due cards exist, create notification record
  - Schedule push notification

---

### Task 2.3: Backend — Adaptive Rephrasing

#### Task 2.3.1: Rephrase Prompts
Create `backend/app/prompts/rephrase.py`
- Three rephrase levels:
  - Level 1: Same format, different wording. "Explain this concept differently."
  - Level 2: Different modality. "Explain this using a visual analogy/simpler vocabulary/step-by-step."
  - Level 3: Full walkthrough. "Break this down into the simplest possible steps. Assume the student has no prior knowledge of this specific point."
- All prompts include user profile for vocabulary/style adaptation

#### Task 2.3.2: Enhanced Quiz Service
Update `backend/app/services/quiz_service.py`
- Add method: `rephrase_question(question_id, attempt_count, user_profile)` → rephrased explanation + new question
- Tracks rephrase level based on attempt_count (1 = level 1, 2 = level 2, 3+ = level 3)
- After successful rephrase+answer: creates spaced_repetition_card for this question
- Update evaluate_answer to trigger rephrasing flow on incorrect answer

#### Task 2.3.3: Enhanced Quiz API
Update `backend/app/api/quiz.py`
- POST `/api/quiz/rephrase` — Request a rephrase for a question after wrong answer. Returns rephrased explanation + new test question.
- Add hint endpoint: POST `/api/quiz/hint` — Get next hint layer for a question

---

### Task 2.4: Backend — Multi-Format Content

#### Task 2.4.1: Extended Content Prompts
Update `backend/app/prompts/content_transform.py`
- Add prompt templates for:
  - "flashcard_deck": Generate key-term / definition pairs as JSON array
  - "concept_map": Generate structured concept relationships as JSON (nodes + edges)
  - "comparison_table": Generate comparison data as JSON (rows + columns)
  - "mnemonic_devices": Generate memory aids for complex terms
- All adapted to user profile vocabulary level

#### Task 2.4.2: Extended Content Service
Update `backend/app/services/content_service.py`
- Add support for all new content types
- Add method: `recommend_formats(topic_id, user_profile)` → list of recommended content types based on profile
  - Audio learner → prioritize audio_lesson
  - Visual learner → prioritize concept_map, flashcard_deck
  - Reading learner → prioritize summary, comparison_table
  - Gamified engagement → prioritize micro_lesson with challenges

#### Task 2.4.3: Content API
Create `backend/app/api/content.py`
- POST `/api/topics/{id}/content/generate` — Generate content block of specified type
- GET `/api/topics/{id}/content` — List all content blocks for a topic
- GET `/api/topics/{id}/content/recommended` — Get recommended content types for user

---

### Task 2.5: Backend — Audio

#### Task 2.5.1: Audio Engine Service
Create `backend/app/services/audio_engine.py`
- Initialize Deepgram client
- Method: `generate_audio(script, voice_settings)` → audio file path
  - Calls Deepgram TTS API
  - Saves audio to Supabase Storage
  - Returns storage path
- Method: `transcribe_audio(audio_data)` → transcribed text
  - Calls Deepgram STT API
  - Returns text

#### Task 2.5.2: Audio Script Prompts
Create `backend/app/prompts/audio_script.py`
- System prompt for Claude Sonnet:
  - Generate a natural spoken script from topic content
  - Adapt pacing to user profile (shorter sentences for ADHD, simpler vocab for ESL)
  - Insert pause markers [PAUSE] at points where quiz questions should appear
  - Include question text at each pause point
  - Style options: conversational, structured lecture, exploratory
  - Return: script text + array of {pause_timestamp_estimate, question_text, question_answer}

#### Task 2.5.3: Audio Generation Task
Create `backend/app/tasks/generate_audio.py`
- Celery task: `generate_audio_content(content_block_id, user_profile)`
- Steps:
  1. Generate audio script via Claude Sonnet
  2. Send script to Deepgram TTS
  3. Store audio file in Supabase Storage
  4. Create audio_content record with pause points and transcript

#### Task 2.5.4: Audio API
Create `backend/app/api/audio.py`
- POST `/api/content/{id}/audio/generate` — Trigger audio generation for a content block
- GET `/api/audio/{id}` — Get audio content details (URL, duration, pause points)
- POST `/api/audio/transcribe` — Submit audio recording for transcription (for verbal answers)

---

### Task 2.6: Backend — Wellbeing & Session Awareness

#### Task 2.6.1: Wellbeing Prompts
Create `backend/app/prompts/wellbeing.py`
- System prompt for Claude Haiku:
  - Given mood and energy level, recommend session adaptation
  - Stressed + low energy → lighter session, review only
  - Okay + medium → normal session
  - Great + high → push harder, more challenging questions
  - Burnt out → suggest short session or break, breathing exercise

#### Task 2.6.2: Wellbeing API
Create `backend/app/api/wellbeing.py`
- POST `/api/sessions/{id}/checkin` — Submit wellbeing check-in (mood, energy_level)
- Returns: session_adaptation (recommendation for session adjustment)
- GET `/api/users/wellbeing/history` — Get check-in history for patterns

---

### Task 2.7: Backend — Notifications

#### Task 2.7.1: Notification Service
Create `backend/app/services/notification_service.py`
- Method: `create_notification(user_id, type, title, body, project_id, question_ids, scheduled_at)`
- Method: `get_pending_notifications(user_id)` → list of unsent notifications
- Method: `mark_sent(notification_id)`
- Method: `mark_opened(notification_id)`

#### Task 2.7.2: Notification API
Create `backend/app/api/notifications.py`
- GET `/api/notifications` — Get all pending notifications for user
- POST `/api/notifications/{id}/opened` — Mark notification as opened
- GET `/api/notifications/settings` — Get notification preferences (future use)

---

### Task 2.8: Backend — Study Plan Adaptation

Update `backend/app/services/study_plan_service.py`
- Add method: `evaluate_progress(project_id)` → progress report
  - Compare actual mastery vs expected mastery per topic
  - Identify topics ahead/behind schedule
  - Calculate if overall pace is on track
- Add method: `adapt_plan(project_id, progress_report)` → updated plan
  - If ahead: reallocate time from strong topics to weak ones
  - If behind: prioritize high-impact topics, compress less critical ones
  - Regenerate remaining plan days
- Add method: `detect_gaps(project_id)` → list of potential topic gaps
  - Calls Claude Opus to analyze topic coverage vs expected breadth
  - Returns list of potentially missing topics with recommendations

---

### Task 2.9: Frontend — Phase 2 Features

#### Task 2.9.1: Spaced Repetition Review Page
Create `frontend/src/app/review/page.tsx`
- Quick review session interface
- Shows count of due reviews
- Card-style question display (flip card metaphor)
- After answering: self-rate quality (1-5) or auto-rate based on correctness
- Tracks progress through review stack
- "All caught up!" state when no reviews due

#### Task 2.9.2: Enhanced Quiz with Rephrasing
Update `frontend/src/components/session/QuizInterface.tsx`
- On wrong answer: don't just show correct answer
- Show rephrased explanation with animation
- New question appears for same concept
- Hint button with progressive reveals (show hint count remaining)
- Visual escalation: first rephrase is subtle, second is more dramatic, third is a full walkthrough
- Concept doesn't clear from session until answered correctly

#### Task 2.9.3: Multi-Format Content Display
Create `frontend/src/components/session/FlashcardDeck.tsx`
- Swipeable flashcard interface
- Front: term/question. Back: definition/answer
- Flip animation on tap
- Swipe right (knew it) / left (didn't know) tracking

Create `frontend/src/components/session/ConceptMap.tsx`
- Visual node-link diagram of concept relationships
- Zoomable and pannable
- Nodes colored by mastery level
- Click node for definition popup

Create `frontend/src/components/session/ComparisonTable.tsx`
- Clean table layout comparing concepts
- Highlighted differences
- Mobile-responsive (horizontal scroll or stacked cards)

Update `frontend/src/components/session/ContentDisplay.tsx`
- Add rendering support for all new content types
- Format selector: user can switch between available formats for a topic
- System recommendation badge on suggested format

#### Task 2.9.4: Audio Player
Create `frontend/src/components/audio/AudioPlayer.tsx`
- Custom audio player UI (not browser default)
- Play/pause, progress bar, speed control (0.75x, 1x, 1.25x, 1.5x)
- Time display (current / total)
- Interactive pause: when audio hits a pause point, player pauses and quiz question appears
- Student answers question, feedback shown, audio resumes
- Visual waveform or progress indicator

#### Task 2.9.5: Wellbeing Check-In
Create `frontend/src/components/wellbeing/CheckInModal.tsx`
- Appears at start of session (if enabled)
- "How are you feeling?" with 4 emoji-style options (great, okay, stressed, burnt out)
- "Energy level?" with 3 options (high, medium, low)
- Soft, calming design (Headspace-inspired)
- Submit → system adapts session

Create `frontend/src/components/wellbeing/BreathingExercise.tsx`
- Animated breathing circle (expand on inhale, contract on exhale)
- 4-4-4 breathing pattern (4 sec inhale, 4 hold, 4 exhale)
- Calming color animation
- Timer (1 or 2 minutes)
- "Skip" and "Done" buttons

#### Task 2.9.6: Session Pacing
Update `frontend/src/app/session/[id]/page.tsx`
- Track elapsed time in session
- At ~75% of user's attention span: show gentle check-in banner
- "You've been going X minutes. Feeling good or need a break?"
- If break: show breathing exercise or simple pause screen with timer
- Resume button to continue

#### Task 2.9.7: Notification UI
Create `frontend/src/components/ui/NotificationBanner.tsx`
- In-app notification banner (top of screen)
- Slide-down animation
- Auto-dismiss after 5 seconds or click to dismiss
- Action button (e.g., "Start Review" for SR notification)

#### Task 2.9.8: Enhanced Profile Editor
Update `frontend/src/components/profile/ProfilePromptEditor.tsx`
- Show before/after changes when edit is processed
- Highlight changed fields with a brief glow animation
- Edit history accessible (last 5 edits shown)

---

## PHASE 3 — THE POLISH

### Task 3.1: Database Updates

#### Task 3.1.1: Phase 3 Migration
Create `backend/database/migrations/003_phase3_schema.sql`
- Create `achievements` table (schema from architecture.md)
- Add to users: daily_xp_goal (INT DEFAULT 100)
- Add to study_sessions: focus_mode (BOOLEAN DEFAULT false), focus_score (INT)

---

### Task 3.2: Backend — Gamification

#### Task 3.2.1: Gamification Service
Create `backend/app/services/gamification_service.py`
- Method: `calculate_session_xp(session_id)` → XP earned
  - Base XP: 10 per topic covered
  - Accuracy bonus: +5 per correct answer
  - Streak multiplier: consecutive correct answers multiply bonus (2x, 3x, max 5x), resets on wrong
  - Consistency bonus: +20 if daily goal met
- Method: `update_streak(user_id)` → streak info
  - Check last_active_date vs today
  - If consecutive: increment streak
  - If gap: reset (unless streak freeze available)
  - Update longest_streak if current > longest
- Method: `check_achievements(user_id, event_type, context)` → list of newly earned achievements
  - Event types: session_completed, topic_mastered, streak_milestone, quiz_perfect, etc.
  - Achievement definitions:
    - "first_session": First study session completed
    - "streak_3": 3-day streak
    - "streak_7": 7-day streak
    - "streak_30": 30-day streak
    - "topic_mastered": First topic at 100% mastery
    - "five_topics": 5 topics mastered
    - "perfect_quiz": All questions correct in a session
    - "night_owl": Session started after 11pm
    - "early_bird": Session started before 7am
    - "marathon": Session longer than 60 minutes
    - "speed_demon": Quiz answered correctly in under 5 seconds
    - "comeback": Readiness score recovered from below 30%
  - Returns list of newly earned achievements with XP awards

#### Task 3.2.2: Gamification API
Create `backend/app/api/gamification.py`
- GET `/api/gamification/stats` — XP, streak, daily progress, level
- GET `/api/gamification/achievements` — All earned achievements
- GET `/api/gamification/daily-goal` — Progress toward today's XP goal
- POST `/api/gamification/streak-freeze` — Use a streak freeze (if available)

---

### Task 3.3: Backend — Mock Exam

#### Task 3.3.1: Mock Exam Prompts
Create `backend/app/prompts/mock_exam.py`
- System prompt for Claude Opus:
  - Generate a comprehensive exam covering ALL topics in the project
  - Weight questions toward weak topics (lower mastery)
  - Include previously failed questions rephrased
  - Mix question types: MCQ, short answer, essay prompts, case-based
  - Include a scoring rubric
  - Set realistic time limits per section
  - Return structured JSON with sections, questions, time limits, and rubric

#### Task 3.3.2: Mock Exam Service
Update `backend/app/services/quiz_service.py`
- Add method: `generate_mock_exam(project_id, user_profile)` → full mock exam
- Add method: `score_mock_exam(exam_id, answers)` → detailed scoring and feedback

#### Task 3.3.3: Mock Exam API
Update `backend/app/api/quiz.py`
- POST `/api/projects/{id}/mock-exam/generate` — Generate full mock exam
- POST `/api/projects/{id}/mock-exam/submit` — Submit completed exam for scoring
- GET `/api/projects/{id}/mock-exam/results` — Get mock exam results with feedback

---

### Task 3.4: Backend — Knowledge Graph

#### Task 3.4.1: Knowledge Graph Service
Create `backend/app/services/knowledge_graph_service.py`
- Method: `build_graph(project_id)` → graph data (nodes + edges)
  - Nodes: all topics with mastery level, description
  - Edges: prerequisite relationships + semantic similarity from embeddings
  - Cross-material connections from vector similarity
- Method: `find_connections(topic_id)` → related topics across project

#### Task 3.4.2: Knowledge Graph API
Add to `backend/app/api/topics.py`
- GET `/api/projects/{id}/knowledge-graph` — Get full graph data for visualization

---

### Task 3.5: Backend — Gap Detection & Exam Eve

#### Task 3.5.1: Gap Detection Prompts
Create `backend/app/prompts/gap_detection.py`
- System prompt for Claude Opus:
  - Given all extracted topics and source material
  - Identify topics that seem important but have thin coverage
  - Suggest what additional material the student should find
  - Return structured list of gaps with severity

#### Task 3.5.2: Exam Eve & Post-Exam
Add to `backend/app/api/projects.py`
- GET `/api/projects/{id}/exam-eve` — Get exam eve summary (total hours, topics mastered, readiness, encouragement)
- POST `/api/projects/{id}/post-exam` — Submit post-exam reflection (how it went, optional grade)
- GET `/api/projects/{id}/wrapped` — Get Study Wrapped data (full stats summary for sharing)

---

### Task 3.6: Frontend — Gamification

#### Task 3.6.1: XP and Streak Display
Create `frontend/src/components/gamification/XPBar.tsx`
- Horizontal progress bar toward daily XP goal
- Current XP / goal display
- Animated fill on XP gain
- Level indicator (if implementing levels)

Create `frontend/src/components/gamification/StreakCounter.tsx`
- Flame icon with streak count
- Animated flame that grows with longer streaks
- "Streak freeze available" indicator
- Warning state if streak at risk (no activity today)

Create `frontend/src/components/gamification/XPPopup.tsx`
- Floating "+X XP" text that appears and fades up on XP gain
- Multiplier indicator when active ("2x!")
- Triggered after quiz correct answers and session completion

#### Task 3.6.2: Achievements
Create `frontend/src/components/gamification/AchievementBadge.tsx`
- Badge icon with name
- Locked (gray) vs earned (colored) states
- Click to see details (what it is, when earned, XP awarded)

Create `frontend/src/components/gamification/AchievementUnlock.tsx`
- Full-screen overlay animation when achievement earned
- Badge reveal with particle effects (Framer Motion)
- Achievement name, description, XP awarded
- "Awesome!" dismiss button
- Auto-dismiss after 5 seconds

Create `frontend/src/components/gamification/CelebrationEffects.tsx`
- Confetti particle system (Framer Motion)
- Can be triggered from anywhere in the app
- Different intensities: small (correct answer), medium (topic mastered), large (achievement)

#### Task 3.6.3: Achievements Page
Create `frontend/src/app/achievements/page.tsx`
- Grid of all possible achievements
- Earned ones are highlighted, unearned are grayed with hints on how to unlock
- Filter: all / earned / locked
- Total XP from achievements

---

### Task 3.7: Frontend — Micro-Lessons (TikTok Style)

Create `frontend/src/components/session/MicroLessonPlayer.tsx`
- Vertical swipe/scroll interface
- Each "screen" is one micro-lesson block (one concept)
- Content: key point as headline + supporting visual/diagram + brief explanation
- Smooth scroll-snap between blocks
- Progress dots on the side
- Quiz checkpoint screens interspersed (every 2-3 content blocks)
- Auto-advance option with configurable timer
- "Just one more" teaser at bottom of each block showing next topic preview

---

### Task 3.8: Frontend — Mock Exam Mode

Create `frontend/src/app/project/[id]/mock-exam/page.tsx`
- Exam simulation interface
- Timer at top (countdown based on exam duration)
- Section navigation sidebar
- Question display with appropriate input
- Flag question for review feature
- Submit exam button with confirmation modal
- Results page after submission:
  - Overall score
  - Per-section breakdown
  - Per-topic breakdown
  - Weak areas highlighted
  - Comparison to previous mock attempts (if any)
  - "Focus on these areas" recommendations

---

### Task 3.9: Frontend — Knowledge Graph

Create `frontend/src/components/knowledge-graph/InteractiveGraph.tsx`
- Force-directed graph visualization (use d3-force or similar via CDN/dynamic import)
- Nodes = topics, sized by importance, colored by mastery (red → yellow → green)
- Edges = relationships (prerequisite = solid line, related = dashed)
- Zoom and pan
- Click node: popup with topic name, mastery %, option to study
- Search/filter by topic name
- Legend for colors and edge types

---

### Task 3.10: Frontend — Focus Mode

Create `frontend/src/app/session/[id]/focus/page.tsx`
- Minimal distraction-free interface
- Only shows: current content block, timer, and minimal navigation
- Background: subtle ambient gradient animation
- Growing visual element (simple plant/tree or abstract shape that grows with time)
- If user navigates away: visual pauses (track via visibilitychange event)
- Session timer in corner
- End focus session: summary (time focused, content covered, focus score based on uninterrupted time)

---

### Task 3.11: Frontend — Enhanced Dashboard

Update `frontend/src/app/dashboard/page.tsx`
- Multi-project priority: if multiple active projects, show "Today's Priority" recommendation based on exam proximity
- Calendar view toggle: see study plan days across all projects on a calendar
- Performance trends: small line charts showing readiness score over time per project

---

### Task 3.12: Frontend — Exam Eve & Post-Exam

Create `frontend/src/components/project/ExamEve.tsx`
- Special card that appears when exam is tomorrow
- Summary: total hours studied, topics mastered, readiness score
- Encouragement message (personalized from Claude)
- Optional breathing exercise link
- Quick reference: top 5 concepts to review (generated from weakest areas)
- No quizzes, no pressure — purely supportive

Create `frontend/src/components/project/PostExam.tsx`
- Appears after exam date
- "How did it go?" with options (great, okay, tough, not sure)
- Optional grade input field
- Triggers Study Wrapped generation

Create `frontend/src/components/project/StudyWrapped.tsx`
- Spotify Wrapped-style multi-screen summary
- Animated card transitions (swipe or auto-advance)
- Screens:
  1. Total hours studied
  2. Topics mastered count
  3. Questions answered
  4. Longest streak
  5. Study personality insight ("You're a night owl who peaks at 11pm")
  6. Strongest topic area
  7. Most improved topic
  8. Final readiness score
- Shareable card: generates a summary image/card that could be saved (even as a styled div/screenshot)
- "Start Next Project" button at the end

---

### Task 3.13: Frontend — Onboarding Polish
Update `frontend/src/app/onboarding/page.tsx` and components
- Add entrance animations per question (slide from right)
- Add micro-animation on option selection (scale bounce)
- Add progress bar animation (smooth fill)
- Add transition to profile summary (fade + slide up)
- Add subtle background gradient that shifts color with each question

---

## POST-BUILD NOTES

### After Phase 1 Complete
The developer should:
1. Set up Supabase project and run migration 001
2. Configure all environment variables
3. Start Redis
4. Start backend (uvicorn) and Celery worker
5. Start frontend (npm run dev)
6. Run through the Phase 1 testing checklist in project_plan.md

### After Phase 2 Complete
The developer should:
1. Run migration 002 on Supabase
2. Add Deepgram API key to backend .env
3. Restart backend and Celery
4. Run through the Phase 2 testing checklist in project_plan.md

### After Phase 3 Complete
The developer should:
1. Run migration 003 on Supabase
2. Restart backend and Celery
3. Run through the Phase 3 testing checklist in project_plan.md
4. Run the full end-to-end journey test described in Phase 3 checklist
