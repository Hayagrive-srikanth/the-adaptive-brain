# Developer A — Foundation & Content Pipeline

## Phase 1: Project Skeleton + Auth Sync
**Goal:** Backend boots, connects to Supabase, and the frontend login flow works end-to-end.

- [ ] **1.1** Scaffold FastAPI project structure
  - `app/main.py` — FastAPI app with CORS middleware (allow `localhost:3000`)
  - `app/config.py` — Load env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`)
  - `app/database.py` — Supabase client init + async DB connection pool
  - `requirements.txt` — fastapi, uvicorn, supabase-py, python-dotenv, httpx
  - `.env.example` — template for required env vars

- [ ] **1.2** Create shared utilities
  - `app/dependencies.py` — `get_current_user()` dependency that validates the Supabase JWT from `Authorization: Bearer` header and returns `user_id`
  - `app/schemas/user.py` — Pydantic models for user sync, profile, onboarding

- [ ] **1.3** Build `POST /api/users/sync`
  - Receives `{ id, email, full_name }` from frontend AuthContext
  - Upserts into `users` table (insert if new, update `full_name`/`email` if exists)
  - Returns `{ id, email, full_name, onboarding_completed }`

- [ ] **1.4** Build `GET /api/users/profile`
  - Returns full user row (profile, onboarding status, XP, streak)
  - Protected by `get_current_user()` dependency

- [ ] **1.5** Build `POST /api/users/onboarding`
  - Accepts onboarding answers payload
  - Updates user columns: `learning_modality`, `attention_span`, `engagement_style`, `language_*`, `neuro_*`, `preferred_study_time`, `motivation`
  - Sets `onboarding_completed = true`

- [ ] **1.6** Build `POST /api/users/profile/edit`
  - Partial update of profile fields (name, avatar, learning preferences)

**Deliverable:** Frontend login → sync → onboarding → dashboard redirect works. Dev B can use `get_current_user()` dependency immediately.

**Test:** Login on frontend, check user row appears in Supabase `users` table.

---

## Phase 2: Projects + Material Upload
**Goal:** Users can create projects and upload study materials.

- [ ] **2.1** Create schemas
  - `app/schemas/project.py` — Create, Update, Response models
  - `app/schemas/material.py` — Upload response, list response

- [ ] **2.2** Build Project CRUD
  - `POST /api/projects` — Create project (name, exam_date, hours_per_day, comfort_level)
  - `GET /api/projects` — List user's projects (with stats summary)
  - `GET /api/projects/{id}` — Get single project with full stats
  - `PATCH /api/projects/{id}` — Update project fields
  - `DELETE /api/projects/{id}` — Soft delete (set status = 'archived')

- [ ] **2.3** Build Material Upload
  - `POST /api/projects/{id}/materials` — Accept file upload (multipart/form-data)
    - Upload file to Supabase Storage bucket `materials/{project_id}/{filename}`
    - Create `source_materials` row with `processing_status = 'pending'`
    - Return material metadata
  - `GET /api/projects/{id}/materials` — List materials for project
  - `DELETE /api/materials/{id}` — Delete material + storage file

- [ ] **2.4** Build text extraction (background task)
  - For PDFs: use `PyPDF2` or `pdfplumber` to extract text
  - For images: use Supabase Storage URL + OCR service (or skip for now, mark as TODO)
  - For txt/docx: direct text extraction
  - Update `source_materials` row: set `extracted_text`, `extracted_text_preview`, `processing_status = 'completed'`

**Deliverable:** Frontend "New Project" page works. User can create project, upload PDFs, see them listed.

**Test:** Create project on frontend, upload a PDF, verify row in `source_materials` with extracted text.

---

## Phase 3: Topic Extraction + Knowledge Graph
**Goal:** AI analyzes uploaded materials and generates a structured topic tree with prerequisites.

- [ ] **3.1** Create schemas
  - `app/schemas/topic.py` — Topic response, list response, knowledge graph response

- [ ] **3.2** Build AI topic extraction service
  - `app/services/topic_service.py`
  - Takes all `extracted_text` from a project's materials
  - Sends to LLM (Claude/OpenAI) with a prompt:
    - "Extract learning topics from this material. For each topic return: name, description, difficulty (foundational/intermediate/advanced), estimated_minutes, and prerequisites (which other topics should be learned first)."
  - Parses LLM response into `topics` rows + `topic_prerequisites` rows
  - Sets `path_order` based on topological sort of prerequisites
  - Computes `graph_x`, `graph_y` positions for knowledge graph visualization

- [ ] **3.3** Build topic endpoints
  - `POST /api/projects/{id}/generate-topics` — Trigger AI extraction (can be async)
  - `GET /api/projects/{id}/topics` — List topics ordered by `path_order` (for study path/snake map)
  - `GET /api/topics/{id}` — Get single topic with prerequisites and stats

- [ ] **3.4** Build knowledge graph endpoint
  - `GET /api/projects/{id}/knowledge-graph`
  - Returns `{ nodes: [...], edges: [...] }` for the frontend graph visualization
  - Nodes include mastery percentage and status for color coding

**Deliverable:** After uploading materials, user clicks "Generate Topics" and sees the snake path + knowledge graph populate.

**Test:** Upload a chemistry PDF → generate topics → verify 8-15 topics appear with logical prerequisites.

---

## Phase 4: Study Plan Generation
**Goal:** AI creates a personalized day-by-day study schedule based on topics, exam date, and user preferences.

- [ ] **4.1** Create schemas
  - `app/schemas/study_plan.py` — Plan response, day response

- [ ] **4.2** Build study plan service
  - `app/services/study_plan_service.py`
  - Inputs: project topics, exam_date, hours_per_day, comfort_level, user's attention_span
  - Logic:
    - Calculate total days until exam
    - Respect prerequisite ordering (foundational → intermediate → advanced)
    - Allocate topics across days based on estimated_minutes and daily budget
    - Intersperse review days every 3-4 learning days
    - Schedule mock exam on the last few days
  - Can be LLM-assisted or pure algorithm (recommend: algorithm with LLM fallback)

- [ ] **4.3** Build study plan endpoints
  - `POST /api/projects/{id}/study-plan` — Generate plan
    - Creates `study_plans` row + `study_plan_days` rows + `study_plan_day_topics` junction
  - `GET /api/projects/{id}/study-plan` — Get plan with all days and their topics
  - `GET /api/projects/{id}/today` — Get today's plan day (topics to study, session type)

- [ ] **4.4** Build plan adaptation logic (stretch)
  - If user is ahead/behind, recalculate remaining days
  - Endpoint: `POST /api/projects/{id}/study-plan/adapt`

**Deliverable:** Frontend project page shows a calendar/schedule of what to study each day.

**Test:** Create project with 10 topics and exam in 14 days → verify plan has 14 days with logical topic distribution.

---

## Phase 5: Content Generation (7 Types)
**Goal:** AI generates rich learning content for each topic in multiple formats.

- [ ] **5.1** Create schemas
  - `app/schemas/content.py` — Content block response, generation request

- [ ] **5.2** Build content generation service
  - `app/services/content_service.py`
  - One method per content type, each with a tailored LLM prompt:

  - [ ] **5.2a** `summary` — Sections with headings, paragraphs, and key terms with definitions
  - [ ] **5.2b** `micro_lesson` — Screens with title, key point, explanation, visual description
  - [ ] **5.2c** `flashcard_deck` — Array of front/back card pairs
  - [ ] **5.2d** `concept_map` — Nodes with positions + labeled edges
  - [ ] **5.2e** `comparison_table` — Column headers + row data
  - [ ] **5.2f** `mnemonics` — Term, mnemonic phrase, breakdown, explanation, emoji
  - [ ] **5.2g** `audio_lesson` — Script with pause points (TTS integration is stretch goal)

- [ ] **5.3** Build content endpoints
  - `POST /api/topics/{id}/content` — Generate content block by type
    - Body: `{ content_type: "summary" | "micro_lesson" | ... }`
    - Calls appropriate service method
    - Stores result in `content_blocks` table as JSONB
  - `GET /api/topics/{id}/content` — List all content blocks for topic

- [ ] **5.4** Build content adaptation (stretch)
  - Use user's `learning_modality` and `language_comfort` to adjust:
    - Visual learners get more concept maps and comparison tables
    - Reading learners get more summaries
    - Non-native speakers get simpler language in prompts

**Deliverable:** User clicks a topic → sees content toolkit with all 7 formats available → clicks one → AI generates and displays it.

**Test:** Generate each of the 7 content types for a topic → verify JSONB structure matches what the frontend expects.

---

## Phase 6: Polish + Exam Features
**Goal:** Final touches — exam eve summary, post-exam reflection, Study Wrapped.

- [ ] **6.1** Build Exam Eve endpoint
  - `GET /api/projects/{id}/exam-eve`
  - Returns: weakest topics, suggested last-day focus, confidence metrics
  - Uses topic mastery percentages + recent session accuracy

- [ ] **6.2** Build Post-Exam Reflection
  - `POST /api/projects/{id}/reflection`
  - Stores confidence before/after, free-text reflection
  - Marks project as `completed`

- [ ] **6.3** Build Study Wrapped
  - `GET /api/projects/{id}/wrapped`
  - Aggregates: total hours, sessions, topics mastered, questions answered
  - Computes "personality" (Early Bird / Night Owl based on session times)
  - Computes strongest topic, most improved topic
  - Returns calendar heatmap data

- [ ] **6.4** Error handling & validation polish
  - Consistent error responses across all endpoints
  - Input validation edge cases
  - Rate limiting on AI generation endpoints

- [ ] **6.5** API documentation
  - Verify all endpoints show correctly in `/docs` (Swagger)
  - Add descriptions and example responses to schemas

**Deliverable:** Complete Developer A scope. All 20 endpoints working and documented.

---

## Summary Timeline

| Phase | Endpoints | Key Dependency | Estimated Effort |
|-------|-----------|---------------|-----------------|
| 1 — Skeleton + Auth | 4 | None | 1-2 days |
| 2 — Projects + Materials | 6 | Phase 1 | 2-3 days |
| 3 — Topics + Graph | 4 | Phase 2 (needs materials) | 2-3 days |
| 4 — Study Plans | 3 | Phase 3 (needs topics) | 2 days |
| 5 — Content (7 types) | 2 | Phase 3 (needs topics) | 3-4 days |
| 6 — Polish + Exam | 3 | Phases 3-5 | 1-2 days |

**Total: ~20 endpoints across 6 phases, ~12-16 days**

**Note:** Phase 5 (content) and Phase 4 (plans) can run in parallel since both only depend on Phase 3.
