# Developer B — Assessment & Engagement Layer

## Phase 1: Project Skeleton + Session Basics
**Goal:** Backend boots (reuse Dev A's skeleton), sessions can be started and ended.

> **Prerequisite:** Dev A must complete their Phase 1 first (project skeleton + `get_current_user()` dependency). OR clone their Phase 1 branch. This is the only sequential dependency in the entire project.

- [ ] **1.1** Set up your router files
  - `app/api/sessions.py` — Study session endpoints
  - `app/api/quiz.py` — Quiz + mock exam endpoints
  - `app/api/review.py` — Spaced repetition endpoints
  - `app/api/gamification.py` — XP, streaks, achievements
  - `app/api/notifications.py` — Notification endpoints
  - `app/api/history.py` — Session history + analytics
  - Register all routers in `main.py`

- [ ] **1.2** Create session schemas
  - `app/schemas/session.py` — Start request (project_id, topic_ids, mood, energy), end request, response

- [ ] **1.3** Build `POST /api/sessions/start`
  - Creates `study_sessions` row with status = 'active'
  - Creates `session_topics` junction rows
  - Stores wellbeing check-in (mood, energy) on the session row
  - Also creates a `wellbeing_checkins` row for history
  - Returns session ID + topic details

- [ ] **1.4** Build `PATCH /api/sessions/{id}/end`
  - Sets `ended_at`, calculates `duration_minutes`
  - Sets `status = 'completed'`
  - Calculates `accuracy` from quiz attempts in this session
  - Placeholder for XP calculation (will be built in Phase 4)
  - Returns session summary

- [ ] **1.5** Build `GET /api/sessions/{id}`
  - Returns session with topics, duration, accuracy, XP earned

- [ ] **1.6** Build `GET /api/projects/{id}/sessions`
  - List all sessions for a project, ordered by date desc

**Deliverable:** Frontend can start a study session, record wellbeing, and end it. Session appears in history.

**Test:** Start session → end session → verify row in `study_sessions` with correct duration.

---

## Phase 2: Quiz System
**Goal:** AI generates quiz questions, user can answer them with hints and rephrasing.

- [ ] **2.1** Create schemas
  - `app/schemas/quiz.py` — Question response, attempt request/response, hint response, rephrase response

- [ ] **2.2** Build quiz generation service
  - `app/services/quiz_service.py`
  - Takes a topic's content (from `content_blocks` or `topics.description` + material text)
  - Sends to LLM with prompt:
    - "Generate N quiz questions for this topic. Mix: multiple_choice, true_false, fill_blank. For each: question_text, options (for MCQ), correct_answer, explanation, and 3 hint layers (general → specific)."
  - Parses into `quiz_questions` rows

- [ ] **2.3** Build quiz endpoints
  - `POST /api/topics/{id}/generate-quiz` — Generate 5-10 questions for a topic
  - `GET /api/sessions/{id}/questions` — Get questions for current session's topics
  - `POST /api/quiz/attempt` — Submit answer
    - Body: `{ question_id, selected_answer, time_taken_seconds, hints_used }`
    - Checks correctness
    - Creates `quiz_attempts` row
    - Returns `{ is_correct, correct_answer, explanation }`

- [ ] **2.4** Build hint system
  - `POST /api/quiz/{id}/hint`
  - Returns next hint layer (1, 2, or 3) based on how many hints already requested
  - Tracks `hints_used` on the attempt

- [ ] **2.5** Build adaptive rephrasing
  - `POST /api/quiz/{id}/rephrase`
  - Sends question to LLM: "Rephrase this question in simpler language for a student who is struggling"
  - Returns rephrased question text
  - Sets `rephrasing_needed = true` on the attempt

**Deliverable:** During a session, user sees quiz questions, submits answers, gets feedback, can request hints and rephrasing.

**Test:** Generate quiz for a topic → answer correctly → verify attempt row. Answer wrong → request hint → verify hint returned.

---

## Phase 3: Mock Exams
**Goal:** Full timed exam experience with scoring and topic breakdown.

- [ ] **3.1** Create schemas
  - `app/schemas/mock_exam.py` — Exam response, submit request, results response

- [ ] **3.2** Build mock exam generation
  - `POST /api/projects/{id}/mock-exam`
  - Pulls questions across ALL project topics (proportional to topic weight)
  - If not enough questions exist, generates more via quiz service
  - Creates `mock_exams` row + `mock_exam_answers` rows (with answers blank)
  - Sets `time_allowed_minutes` based on question count (1.5 min per question)
  - Returns exam with all questions

- [ ] **3.3** Build exam submission + scoring
  - `POST /api/mock-exams/{id}/submit`
  - Body: `{ answers: [{ question_id, selected_answer, flagged }] }`
  - Scores each answer, updates `mock_exam_answers` rows
  - Calculates `score_percentage` and `grade`:
    - A+ (≥95), A (≥90), B+ (≥85), B (≥80), C+ (≥75), C (≥70), D (≥60), F (<60)
  - Calculates `topic_breakdown`: accuracy per topic
  - Updates `mock_exams` row with results

- [ ] **3.4** Build results endpoints
  - `GET /api/mock-exams/{id}/results` — Full results with per-question breakdown
  - `GET /api/projects/{id}/mock-exams` — List past exams with scores

- [ ] **3.5** Update project readiness score
  - After mock exam completion, recalculate `projects.readiness_score`
  - Formula: weighted average of topic mastery (60%) + latest mock exam score (40%)

**Deliverable:** User can take a timed mock exam and see detailed results with topic-level breakdown.

**Test:** Generate mock exam → submit all answers → verify score, grade, and topic breakdown are correct.

---

## Phase 4: Gamification Engine
**Goal:** XP, streaks, achievements, and daily goals all work automatically.

- [ ] **4.1** Build XP calculator service
  - `app/services/gamification_service.py`
  - XP sources and amounts:
    - Session completed: 20 XP base + (accuracy% × 0.3) bonus
    - Quiz question correct: 10 XP (−2 per hint used, min 2)
    - Quiz question correct first try: +5 bonus
    - Streak bonus: current_streak × 2 (capped at 20)
    - Mock exam: score% × 1.5
    - Spaced review card: 5 XP per card
  - Creates `xp_history` row for each award
  - Updates `users.total_xp` and `users.daily_xp_earned`

- [ ] **4.2** Build streak logic
  - On every session end or review completion:
    - If `last_active_date` == today → no change
    - If `last_active_date` == yesterday → increment `current_streak`
    - If `last_active_date` < yesterday → reset `current_streak = 1`
    - Update `longest_streak` if current > longest
    - Set `last_active_date = today`
  - Reset `daily_xp_earned = 0` if new day

- [ ] **4.3** Build achievement checker
  - After each session/quiz/review, check all achievement conditions:
    - `first_steps`: sessions_completed >= 1
    - `streak_3/7/30`: current_streak >= threshold
    - `topic_master`: any topic mastery == 100
    - `perfect_score`: session accuracy == 100
    - `bookworm`: total sessions >= 50
    - etc.
  - If newly earned: insert `user_achievements` row + award XP

- [ ] **4.4** Build gamification endpoints
  - `GET /api/users/stats` — Return XP, streak, sessions, accuracy, daily progress
  - `GET /api/achievements` — List all achievements with earned/locked status for user
  - `POST /api/gamification/daily-goal` — Update user's `daily_xp_goal`

- [ ] **4.5** Wire XP + streak + achievements into session/quiz flows
  - Update `PATCH /api/sessions/{id}/end` to call XP calculator + streak updater + achievement checker
  - Update `POST /api/quiz/attempt` to award per-question XP
  - Update `POST /api/mock-exams/{id}/submit` to award exam XP

**Deliverable:** Every action in the app awards XP, maintains streaks, and unlocks achievements automatically.

**Test:** Complete 3 sessions on consecutive days → verify streak = 3, `streak_3` achievement earned, XP history has entries.

---

## Phase 5: Spaced Repetition (SM-2)
**Goal:** Missed quiz questions become review cards that resurface on a scientifically-optimized schedule.

- [ ] **5.1** Build SM-2 engine
  - `app/services/sm2_engine.py`
  - Pure algorithm, no AI needed:
    ```
    Input: quality (0-5), current easiness_factor, interval, repetitions

    If quality >= 3 (correct):
      if repetitions == 0: interval = 1
      if repetitions == 1: interval = 6
      else: interval = round(interval × easiness_factor)
      repetitions += 1
    Else (incorrect):
      repetitions = 0
      interval = 1

    easiness_factor = max(1.3, EF + 0.1 - (5-quality) × (0.08 + (5-quality) × 0.02))
    next_review_date = today + interval days
    ```

- [ ] **5.2** Auto-create SR cards
  - After a quiz attempt where `is_correct = false`:
    - Check if `spaced_repetition_cards` row exists for this (user, question)
    - If not, create one with default SM-2 values
    - If yes, it will be updated on next review

- [ ] **5.3** Build review endpoints
  - `GET /api/review/due` — Get all cards where `next_review_date <= today`
    - Join with `quiz_questions` to return question text, options, etc.
    - Order by: overdue first, then by easiness_factor ascending (hardest first)
  - `POST /api/review/attempt`
    - Body: `{ card_id, quality }` where quality = 0-5 (0=forgot, 3=correct with effort, 5=easy)
    - Run SM-2 algorithm, update card
    - Award 5 XP per review
    - Return updated card stats
  - `GET /api/review/stats`
    - Return: total cards, due today, due this week, average easiness, review streak

- [ ] **5.4** Review → mastery feedback loop
  - After review session, update `topics.mastery_percentage`:
    - New mastery = weighted average of quiz accuracy (60%) + SR card easiness factors (40%)
  - Update `topics.status` if mastery hits thresholds:
    - ≥ 80% → 'mastered'
    - ≥ 30% → 'in_progress'

**Deliverable:** Missed questions appear in the Review page on a spaced schedule. Answering them correctly pushes them further out.

**Test:** Miss a quiz question → verify SR card created with `next_review = tomorrow`. Review it correctly → verify interval jumps to 6 days.

---

## Phase 6: Notifications, History & Polish
**Goal:** Notification system, full history/analytics, and final integration polish.

- [ ] **6.1** Build notification service
  - `app/services/notification_service.py`
  - Auto-create notifications for:
    - Cards due for review (daily check)
    - Streak about to break (if no activity by 8pm)
    - Achievement earned
    - Daily goal reached
  - Types: `spaced_review`, `daily_reminder`, `streak_warning`, `milestone`

- [ ] **6.2** Build notification endpoints
  - `GET /api/notifications` — Get user's notifications (unread first)
  - `PATCH /api/notifications/{id}/read` — Mark as read
  - `PATCH /api/notifications/read-all` — Mark all as read

- [ ] **6.3** Build history endpoint
  - `GET /api/history`
  - Query params: `project_id` (optional), `from_date`, `to_date`, `limit`, `offset`
  - Returns session list with: date, project name, duration, topics covered, XP earned, accuracy
  - Include daily aggregation for the activity heatmap

- [ ] **6.4** Build bookmarks & notes endpoints
  - `POST /api/bookmarks` — Save a content block
  - `GET /api/bookmarks` — List user's bookmarks
  - `DELETE /api/bookmarks/{id}` — Remove bookmark
  - `POST /api/sessions/{id}/notes` — Add a note during session
  - `GET /api/topics/{id}/notes` — Get notes for a topic

- [ ] **6.5** Build wellbeing history
  - `GET /api/wellbeing/history` — Past check-ins with trends
  - Used by frontend to suggest breaks or adapt difficulty

- [ ] **6.6** Integration testing & polish
  - Test full flow: start session → answer quiz → end session → XP awarded → streak updated → achievement checked → SR cards created → notification sent
  - Error handling consistency
  - Verify all endpoints in `/docs`

**Deliverable:** Complete Developer B scope. All 22 endpoints working, gamification engine fully wired.

---

## Summary Timeline

| Phase | Endpoints | Key Dependency | Estimated Effort |
|-------|-----------|---------------|-----------------|
| 1 — Skeleton + Sessions | 4 | Dev A's Phase 1 (skeleton + auth) | 1-2 days |
| 2 — Quiz System | 5 | Phase 1 + topics in DB (Dev A Phase 3) | 3-4 days |
| 3 — Mock Exams | 4 | Phase 2 (needs quiz questions) | 2-3 days |
| 4 — Gamification | 3 | Phase 1 (wires into sessions/quiz) | 2-3 days |
| 5 — Spaced Repetition | 3 | Phase 2 (needs quiz attempts) | 2-3 days |
| 6 — Notifications + Polish | 8+ | Phases 1-5 | 2-3 days |

**Total: ~22+ endpoints across 6 phases, ~13-18 days**

**Notes:**
- Phase 2 needs topics in the DB to generate quiz questions. If Dev A hasn't reached Phase 3 yet, you can seed test topics manually.
- Phase 4 (Gamification) and Phase 5 (SR) can run in parallel — they're independent of each other.
- Phase 3 (Mock Exams) depends on Phase 2 (Quiz) since it reuses quiz questions.

---

## Parallel Execution Map

```
Dev A's Phase 1 (skeleton) ──→ Dev B Phase 1 (sessions)
                                    │
                              ┌─────┴─────┐
                              ▼           ▼
                         Phase 2      Phase 4
                         (Quiz)    (Gamification)
                              │           │
                         ┌────┤     ┌─────┘
                         ▼    ▼     ▼
                      Phase 3  Phase 5
                    (Mock Exam) (SR)
                         │       │
                         └───┬───┘
                             ▼
                          Phase 6
                     (Notifications +
                       History + Polish)
```
