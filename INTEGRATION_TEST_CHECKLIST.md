# Integration Test Checklist — The Adaptive Brain

Run through each section in order. Check the box when it passes.
If something fails, note the error and fix before moving on.

---

## Prerequisites

- [ ] Redis running: `docker run -d -p 6379:6379 redis`
- [ ] Backend `.env` has: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, REDIS_URL
- [ ] Frontend `.env.local` has: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
- [ ] All 3 SQL migrations run in Supabase SQL Editor (001, 002, 003)
- [ ] Supabase Storage bucket `materials` exists (set to Public)
- [ ] Supabase Auth > Email > "Confirm email" is OFF
- [ ] Terminal 1: `uvicorn app.main:app --reload --port 8000`
- [ ] Terminal 2: `celery -A app.celery_app worker --loglevel=info --pool=solo`
- [ ] Terminal 3: `npm run dev`

---

## 1. Backend Health

- [ ] Open http://localhost:8000 — see `{"status": "healthy", "service": "The Adaptive Brain API"}`
- [ ] Open http://localhost:8000/docs — Swagger UI loads with all endpoints

---

## 2. Auth Flow

### Sign Up
- [ ] Go to http://localhost:3000/signup
- [ ] Enter name, email, password (min 6 chars)
- [ ] Click "Create Account"
- [ ] **Check**: Redirects to `/onboarding`
- [ ] **Check**: Supabase Dashboard > Authentication > Users shows new user
- [ ] **Check backend terminal**: `POST /api/auth/signup 200` or no auth errors

### Sign In
- [ ] Go to http://localhost:3000/login
- [ ] Enter email and password from signup
- [ ] Click "Sign In"
- [ ] **Check**: Redirects to `/onboarding` (first time) or `/dashboard` (returning user)

### Sign Out
- [ ] Click profile/logout (if available) or clear localStorage and refresh
- [ ] **Check**: Redirects to `/login`

---

## 3. Onboarding

- [ ] Complete all 7 questions (click an option for each)
- [ ] **Check**: Each question transitions smoothly (slide animation)
- [ ] **Check**: Progress bar updates per step
- [ ] After question 7, Profile Summary card appears
- [ ] Click "Looks good, let's go!"
- [ ] **Check**: Redirects to `/dashboard`
- [ ] **Check backend terminal**: `POST /api/users/onboarding 200`
- [ ] **Check Supabase**: `users` table > your user > `profile` column has JSON data
- [ ] **Check Supabase**: `users` table > `onboarding_completed` = true

---

## 4. Dashboard (Empty State)

- [ ] Dashboard loads without errors
- [ ] Greeting shows your name ("Good morning/afternoon/evening, [Name]!")
- [ ] XP badge shows (0 XP initially)
- [ ] Streak badge shows (0 day streak)
- [ ] Empty state message appears ("No projects yet" or similar)
- [ ] "Create New Project" button is visible and clickable

---

## 5. Project Creation

### Step 1: Details
- [ ] Click "Create New Project"
- [ ] Enter project name (e.g., "AI Exam")
- [ ] Set exam date (at least 7 days from now)
- [ ] Set hours per day (e.g., 2)
- [ ] Select comfort level (beginner/intermediate/review)
- [ ] Click "Next"
- [ ] **Check backend terminal**: `POST /api/projects 200`

### Step 2: Upload
- [ ] Upload a text-based PDF (not scanned)
- [ ] **Check**: File appears in the list with pending icon
- [ ] Click "Next"
- [ ] **Check backend terminal**: `POST /api/projects/{id}/materials 200`

### Step 3: Processing
- [ ] Processing animation shows (pulsing brain)
- [ ] **Check Celery terminal**: `Task process_material received` then `succeeded`
- [ ] **Check Celery terminal**: `[DEBUG] extracted text length = XXXX chars` (should be > 0)
- [ ] **Check Celery terminal**: `Task generate_study_plan received`
- [ ] **Check Celery terminal**: `[DEBUG] Extracted N topics` (should be > 0)
- [ ] **Check Celery terminal**: `Study plan generated for project`
- [ ] Auto-advances to Step 4

### Step 4: Magic Moment
- [ ] "Your study plan is ready!" message appears
- [ ] Shows topic count and day count
- [ ] "Start Day 1" button appears
- [ ] Click "Start Day 1"
- [ ] **Check**: Navigates to project dashboard

---

## 6. Project Dashboard

- [ ] Project name and exam date display correctly
- [ ] Days remaining badge shows correct count
- [ ] Readiness score shows (0% initially)
- [ ] **Study Path**: Duolingo-style path with topic nodes
- [ ] First topic node is "available" (colored, not locked)
- [ ] Remaining topics are "locked" (gray) or "available"
- [ ] **Topic Map**: Grid list of all topics with difficulty badges
- [ ] **Today's Session**: Card shows with "Start Studying" button
- [ ] **Check backend terminal**: `GET /api/projects/{id} 200`, `GET .../topics 200`, `GET .../plan 200`

---

## 7. Study Session

### Start Session
- [ ] Click "Start Studying"
- [ ] **Check**: Navigates to `/session/{id}`
- [ ] **Check backend terminal**: `POST /api/sessions/start 200`
- [ ] Wellbeing check-in modal appears (mood + energy)

### Check-In
- [ ] Select a mood (e.g., "Good")
- [ ] Select energy level (e.g., "Medium")
- [ ] Modal closes
- [ ] Session intro screen shows with topic names

### Content Phase
- [ ] Click "Let's Begin"
- [ ] **Check backend terminal**: `GET /api/sessions/{id}/content/{topic_id} 200`
- [ ] Content loads (summary text with headings, key terms, examples)
- [ ] "Ready for Questions" button appears at bottom
- [ ] **If content is empty**: Check Celery terminal for OpenAI errors

### Quiz Phase
- [ ] Click "Ready for Questions"
- [ ] Quiz questions appear (multiple choice buttons)
- [ ] Select an answer
- [ ] Click "Submit Answer"
- [ ] **Check backend terminal**: `POST /api/quiz/attempt 200`
- [ ] Feedback shows: green checkmark (correct) or red X with explanation (incorrect)
- [ ] Hint button works (if available)
- [ ] After all questions, "topic complete" screen shows score

### Session End
- [ ] After last topic, click "Finish Session"
- [ ] Session wrap-up shows: topics covered, questions answered, accuracy, XP earned
- [ ] Click "Back to Project"
- [ ] **Check**: Readiness score should have increased from 0%

---

## 8. Dashboard (With Data)

- [ ] Go to http://localhost:3000/dashboard
- [ ] Project card shows with updated readiness score
- [ ] XP badge updated
- [ ] "Today's Priority" section shows closest exam
- [ ] Delete button (trash icon) works on project card
  - [ ] Click trash icon
  - [ ] Confirmation overlay appears
  - [ ] Click "Cancel" — overlay dismisses
  - [ ] Click trash again > "Delete" — project removed from list
  - [ ] **Check backend terminal**: `DELETE /api/projects/{id} 200`

---

## 9. Profile Page

- [ ] Go to http://localhost:3000/profile
- [ ] Learning identity card shows with your preferences from onboarding
- [ ] Try editing via prompt bar (e.g., "I prefer visual learning")
- [ ] **Check backend terminal**: `POST /api/users/profile/edit 200`
- [ ] Profile updates reflect the change

---

## 10. Spaced Repetition

- [ ] Go to http://localhost:3000/review
- [ ] **If cards due**: Review cards appear with flip animation
- [ ] **If no cards due**: "All caught up!" empty state
- [ ] **Check backend terminal**: `GET /api/reviews/due 200`

---

## 11. Achievements

- [ ] Go to http://localhost:3000/achievements
- [ ] Grid of achievement badges loads
- [ ] Filter tabs work (All / Earned / Locked)
- [ ] Earned achievements are highlighted, locked are grayed
- [ ] **Check backend terminal**: `GET /api/gamification/achievements 200`

---

## 12. Mock Exam (Phase 3)

- [ ] From project dashboard, navigate to mock exam
- [ ] **Check backend terminal**: `POST /api/projects/{id}/mock-exam/generate 200`
- [ ] Exam loads with timer, questions, section navigation
- [ ] Answer questions, flag some for review
- [ ] Submit exam
- [ ] Results show: overall score, per-topic breakdown, recommendations

---

## 13. Knowledge Graph (Phase 3)

- [ ] From project dashboard, check for knowledge graph
- [ ] **Check backend terminal**: `GET /api/projects/{id}/knowledge-graph 200`
- [ ] Graph renders with topic nodes and edges
- [ ] Zoom and pan work
- [ ] Click a node to see topic details

---

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 401 Unauthorized | Token expired | Sign out and sign back in |
| 404 on API call | Wrong route prefix | Check `backend/app/main.py` router prefixes |
| 500 on API call | Backend exception | Check Terminal 1 for Python traceback |
| Celery task not running | Task not registered | Restart Celery worker |
| 0 topics extracted | OpenAI API issue | Check Celery terminal for API errors |
| "Cannot read properties of undefined" | Data shape mismatch | Add `|| []` or `?? 0` null guards |
| CORS error | Frontend/backend port mismatch | Check `FRONTEND_URL` in backend `.env` |
| Blank page after navigation | Component import error | Check browser console (F12) for exact error |
| "Element type is invalid" | Wrong import (default vs named) | Check the import statement matches the export |
