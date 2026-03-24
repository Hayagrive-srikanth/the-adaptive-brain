# The Adaptive Brain — Project Architecture

## Overview

The Adaptive Brain is an AI-driven exam preparation companion that transforms any user-provided academic content into a personalized learning experience. It adapts to each student's unique learning style, cognitive profile, and study preferences using AI-powered content transformation, gamification, and spaced repetition.

---

## Tech Stack

### Frontend
- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion (gamification UI, path visualization, celebrations)
- **State Management**: Zustand
- **Notifications**: Firebase Cloud Messaging (web push)

### Backend
- **Framework**: FastAPI (Python)
- **Task Queue**: Celery with Redis as broker
- **Background Jobs**: Heavy processing (OCR, AI generation, audio creation)

### Database & Infrastructure
- **Primary Database**: Supabase (PostgreSQL)
  - Authentication (replaces NextAuth)
  - File Storage (uploaded materials, generated audio)
  - Real-time subscriptions (live progress updates)
  - pgvector extension (semantic search across materials)
- **Cache**: Redis (session state, streaks, XP, active study data)

### AI Layer
- **Core Reasoning**: Claude (Anthropic)
  - **Claude Opus**: Study plan generation, topic extraction, exam question generation, content analysis, conversational profile editing
  - **Claude Sonnet**: Real-time quiz feedback, explanation rephrasing, hint generation, content transformation
  - **Claude Haiku**: Classification, routing, content tagging, sentiment detection for wellbeing check-ins
- **OCR**: Hunyuan OCR (open source, runs locally) — used for ALL document types
- **Audio TTS**: Deepgram Text-to-Speech
- **Audio STT**: Deepgram Speech-to-Text
- **Spaced Repetition**: SM-2 algorithm (custom Python implementation, NOT AI-driven)

### File Processing
- **PDF**: PyMuPDF
- **PowerPoint**: python-pptx
- **Word**: python-docx
- **Images**: Pillow (preprocessing before OCR)
- **Audio**: FFmpeg (lecture recording processing)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │Onboarding│ │Dashboard │ │ Study    │ │  Profile   │ │
│  │   Flow   │ │& Projects│ │ Session  │ │   Editor   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Duolingo │ │ Progress │ │  Quiz    │ │  Gamify    │ │
│  │   Path   │ │   Map    │ │  Engine  │ │  (XP/Streak│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                    BACKEND (FastAPI)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │                   API Layer                       │   │
│  │  /auth  /users  /projects  /sessions  /quiz      │   │
│  │  /content  /audio  /spaced-repetition  /wellbeing│   │
│  └──────────────────────┬───────────────────────────┘   │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │               Service Layer                       │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │   │
│  │  │  AI Engine  │ │  OCR Engine │ │Audio Engine│ │   │
│  │  │  (Claude)   │ │ (Hunyuan)   │ │ (Deepgram) │ │   │
│  │  └─────────────┘ └─────────────┘ └────────────┘ │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │   │
│  │  │  SM-2       │ │  Content    │ │  Study Plan│ │   │
│  │  │  Algorithm  │ │  Transform  │ │  Generator │ │   │
│  │  └─────────────┘ └─────────────┘ └────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Background Jobs (Celery + Redis)         │   │
│  │  • Material processing & OCR                      │   │
│  │  • Study plan generation                          │   │
│  │  • Audio content generation                       │   │
│  │  • Spaced repetition scheduling                   │   │
│  │  • Notification dispatching                       │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   SUPABASE                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │PostgreSQL│ │  Auth    │ │ Storage  │ │ Real-time  │ │
│  │+pgvector │ │          │ │ (Files)  │ │ Subscript. │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model & Schema

### Entity Relationship Overview

```
User
 ├── Profile (JSON — learning preferences, adaptive)
 ├── Projects (many)
 │    ├── Source Materials (many)
 │    │    └── Vector Embeddings (pgvector)
 │    ├── Topics (many, with prerequisite graph)
 │    │    ├── Content Blocks (many, multi-format)
 │    │    │    └── Audio Content (optional)
 │    │    └── Quiz Questions (many)
 │    │         └── Quiz Attempts (many)
 │    ├── Study Plan (one active)
 │    │    └── Study Plan Days (many)
 │    └── Study Sessions (many)
 │         ├── Wellbeing Check-ins (optional)
 │         └── Quiz Attempts (many)
 ├── Spaced Repetition Cards (many)
 ├── Notifications (many)
 ├── Profile Edit Log (many)
 └── Gamification (XP, streaks, achievements)
```

### Table Definitions

#### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key (Supabase auth UID) |
| email | VARCHAR | Unique |
| name | VARCHAR | |
| profile | JSONB | Full learning profile (see Profile Schema below) |
| total_xp | INTEGER | Default 0 |
| current_streak | INTEGER | Default 0 |
| longest_streak | INTEGER | Default 0 |
| last_active_date | DATE | For streak calculation |
| onboarding_completed | BOOLEAN | Default false |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### Profile JSON Schema
```json
{
  "learning_modality": "audio" | "visual" | "reading" | "mixed",
  "attention_span_minutes": 15,
  "engagement_style": "gamified" | "moderate" | "self_paced",
  "language": {
    "first_language": "en",
    "english_comfort": "native" | "comfortable" | "struggling"
  },
  "neurodivergent": {
    "adhd": false,
    "dyslexia": false,
    "autism": false,
    "other": null
  },
  "study_time_preference": "morning" | "afternoon" | "evening" | "night" | "varies",
  "motivation_type": "progress_stats" | "streaks" | "social" | "outcome_focused",
  "custom_notes": ""
}
```

#### projects
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| name | VARCHAR | e.g. "Bio 101 Final" |
| exam_date | DATE | |
| hours_per_day | DECIMAL | Available study hours |
| comfort_level | VARCHAR | "beginner" / "intermediate" / "review" |
| readiness_score | DECIMAL | 0-100, updated dynamically |
| status | VARCHAR | "active" / "completed" / "archived" |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### source_materials
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| original_filename | VARCHAR | |
| file_type | VARCHAR | "pdf" / "image" / "audio" / "docx" / "pptx" |
| storage_path | VARCHAR | Supabase storage path |
| processing_status | VARCHAR | "pending" / "processing" / "completed" / "failed" |
| ocr_text | TEXT | Extracted text content |
| embedding | VECTOR(1536) | pgvector semantic embedding |
| page_count | INTEGER | |
| created_at | TIMESTAMPTZ | |

#### topics
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| name | VARCHAR | |
| description | TEXT | |
| difficulty | VARCHAR | "foundational" / "intermediate" / "advanced" |
| prerequisite_ids | UUID[] | Array of topic IDs |
| mastery_percentage | DECIMAL | 0-100, default 0 |
| status | VARCHAR | "not_started" / "in_progress" / "mastered" |
| estimated_minutes | INTEGER | |
| path_order | INTEGER | Position in study path |
| source_material_ids | UUID[] | Which materials this topic came from |
| embedding | VECTOR(1536) | For cross-topic connections |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### study_plans
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| total_days | INTEGER | |
| daily_target_minutes | INTEGER | |
| status | VARCHAR | "active" / "outdated" / "completed" |
| generated_at | TIMESTAMPTZ | |
| regenerated_count | INTEGER | Default 0 |

#### study_plan_days
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| plan_id | UUID | FK → study_plans |
| day_number | INTEGER | |
| date | DATE | |
| topic_ids | UUID[] | Scheduled topics |
| session_type | VARCHAR | "new_material" / "review" / "mixed" / "mock_exam" |
| estimated_minutes | INTEGER | |
| completed | BOOLEAN | Default false |
| actual_minutes | INTEGER | Null until completed |

#### study_sessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| plan_day_id | UUID | FK → study_plan_days (nullable for ad-hoc sessions) |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | Null if in progress |
| duration_minutes | INTEGER | Calculated on end |
| topics_covered | UUID[] | |
| session_type | VARCHAR | |
| pauses_taken | INTEGER | Default 0 |
| completed | BOOLEAN | |
| xp_earned | INTEGER | Default 0 |

#### content_blocks
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| topic_id | UUID | FK → topics |
| content_type | VARCHAR | "audio_lesson" / "flashcard_deck" / "summary" / "concept_map" / "quiz" / "micro_lesson" / "interactive_challenge" |
| content_body | JSONB | Structure varies by type |
| format_metadata | JSONB | vocabulary_level, pacing, depth, etc. |
| generated_by | VARCHAR | "opus" / "sonnet" / "haiku" |
| duration_estimate_minutes | INTEGER | |
| created_at | TIMESTAMPTZ | |

#### audio_content
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| content_block_id | UUID | FK → content_blocks |
| storage_path | VARCHAR | Supabase storage |
| duration_seconds | INTEGER | |
| voice_settings | JSONB | voice, pacing, style |
| transcript | TEXT | |
| interactive_pauses | JSONB | [{timestamp, question_id}] |
| created_at | TIMESTAMPTZ | |

#### quiz_questions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| topic_id | UUID | FK → topics |
| question_type | VARCHAR | "multiple_choice" / "fill_blank" / "short_answer" / "true_false" |
| question_text | TEXT | |
| options | JSONB | For multiple choice |
| correct_answer | TEXT | |
| explanation | TEXT | Shown on wrong answer |
| difficulty | VARCHAR | "easy" / "medium" / "hard" |
| hint_layers | JSONB | ["hint1", "hint2", "hint3"] progressive hints |
| times_shown | INTEGER | Default 0 |
| times_correct | INTEGER | Default 0 |
| last_shown_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### quiz_attempts
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| question_id | UUID | FK → quiz_questions |
| session_id | UUID | FK → study_sessions |
| user_answer | TEXT | |
| correct | BOOLEAN | |
| time_taken_seconds | INTEGER | |
| hints_used | INTEGER | Default 0 |
| rephrasing_needed | BOOLEAN | Default false |
| rephrase_format | VARCHAR | Null or the format used for rephrase |
| attempted_at | TIMESTAMPTZ | |

#### spaced_repetition_cards
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| question_id | UUID | FK → quiz_questions |
| easiness_factor | DECIMAL | Default 2.5 (SM-2) |
| interval_days | INTEGER | Default 1 |
| repetition_count | INTEGER | Default 0 |
| next_review_date | DATE | |
| last_review_date | DATE | |
| last_quality_score | INTEGER | 0-5 (SM-2 quality) |

#### notifications
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| type | VARCHAR | "spaced_review" / "daily_reminder" / "streak_warning" / "wellbeing" / "milestone" |
| title | VARCHAR | |
| body | TEXT | |
| scheduled_at | TIMESTAMPTZ | |
| sent | BOOLEAN | Default false |
| opened | BOOLEAN | Default false |
| project_id | UUID | FK → projects (nullable) |
| question_ids | UUID[] | For review nudges |

#### profile_edit_log
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| user_prompt | TEXT | What the user typed |
| fields_changed | JSONB | {field: {before, after}} |
| ai_interpretation | TEXT | How Claude interpreted the request |
| created_at | TIMESTAMPTZ | |

#### wellbeing_checkins
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| session_id | UUID | FK → study_sessions |
| mood | VARCHAR | "great" / "okay" / "stressed" / "burnt_out" |
| energy_level | VARCHAR | "high" / "medium" / "low" |
| adaptation_made | VARCHAR | What the system changed |
| created_at | TIMESTAMPTZ | |

#### achievements
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| achievement_type | VARCHAR | "first_session" / "streak_7" / "topic_mastered" / "perfect_quiz" / etc. |
| project_id | UUID | FK → projects (nullable) |
| earned_at | TIMESTAMPTZ | |
| xp_awarded | INTEGER | |

### Key Indexes
- `spaced_repetition_cards`: (user_id, next_review_date) — queried constantly for due reviews
- `quiz_attempts`: (question_id, correct) — mastery percentage calculation
- `topics`: (project_id, mastery_percentage) — progress dashboard
- `study_sessions`: (user_id, started_at) — streak calculation
- `source_materials`: (project_id, processing_status) — upload pipeline monitoring
- `notifications`: (user_id, scheduled_at, sent) — notification dispatch queue

---

## AI Prompt Strategy (High-Level)

Each AI task uses a specific Claude model tier and well-defined prompts:

| Task | Model | Input | Output |
|------|-------|-------|--------|
| Topic extraction from materials | Opus | OCR text + material metadata | Structured topic list with descriptions, difficulty, prerequisites |
| Study plan generation | Opus | Topics + user profile + days available + hours/day | Day-by-day plan with topic sequencing |
| Content transformation | Sonnet | Topic content + user profile + target format | Formatted content block (summary, flashcards, micro-lesson, etc.) |
| Quiz question generation | Opus | Topic content + difficulty level + question type | Structured quiz questions with answers, explanations, hints |
| Answer evaluation | Sonnet | Question + user answer + correct answer | Correct/incorrect + explanation + rephrase if wrong |
| Concept rephrasing | Sonnet | Original explanation + user profile + failure context | Alternative explanation in different format/vocabulary |
| Audio script generation | Sonnet | Topic content + user profile + interactive pause points | Natural spoken script with pause markers |
| Profile edit interpretation | Sonnet | User prompt + current profile | Updated profile fields |
| Wellbeing adaptation | Haiku | Check-in response + session context | Session modification recommendation |
| Material gap detection | Opus | All topics + coverage analysis | List of undertaught topics with recommendations |
| Mock exam generation | Opus | All topics + mastery data + exam format hints | Full mock exam with scoring rubric |

---

## Key Design Principles

1. **Personalization is the product** — Every output is shaped by the user profile. No two users see the same content.
2. **The system is proactive, not passive** — It suggests, adapts, warns, and encourages without being asked.
3. **Bite-sized over monolithic** — TikTok-style micro-lessons. Nothing feels heavy.
4. **Accuracy over simplification** — Content is adapted in format and vocabulary but never loses technical precision.
5. **The student is human** — Wellbeing, energy, stress levels matter. The system respects the whole person.
6. **Invisible complexity** — OCR pipelines, SM-2 math, AI routing — the user sees none of this. They see a study companion.
