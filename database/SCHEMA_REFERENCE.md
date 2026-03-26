# The Adaptive Brain — Schema Reference

## 25 Tables, 3 Junction Tables

### Ownership Map

| # | Table | Owner | Dev A writes | Dev B writes |
|---|-------|-------|-------------|-------------|
| 1 | `users` | SHARED | profile, onboarding, name | xp, streak, daily_xp |
| 2 | `projects` | A | all columns | reads only |
| 3 | `source_materials` | A | all columns | — |
| 4 | `topics` | SHARED | creates rows, description, difficulty | mastery_%, accuracy, questions_answered |
| 5 | `topic_prerequisites` | A | all columns | reads only |
| 6 | `study_plans` | A | all columns | reads only |
| 7 | `study_plan_days` | SHARED | creates rows | marks `completed` |
| 8 | `study_plan_day_topics` | A | all columns | reads only |
| 9 | `content_blocks` | A | all columns | reads in sessions |
| 10 | `audio_content` | A | all columns | — |
| 11 | `quiz_questions` | B | — | all columns |
| 12 | `study_sessions` | B | — | all columns |
| 13 | `session_topics` | B | — | all columns |
| 14 | `quiz_attempts` | B | — | all columns |
| 15 | `mock_exams` | B | — | all columns |
| 16 | `mock_exam_answers` | B | — | all columns |
| 17 | `spaced_repetition_cards` | B | — | all columns |
| 18 | `achievements` | STATIC | seeded once | — |
| 19 | `user_achievements` | B | — | all columns |
| 20 | `xp_history` | B | — | all columns |
| 21 | `notifications` | B | — | all columns |
| 22 | `bookmarks` | B | — | all columns |
| 23 | `session_notes` | B | — | all columns |
| 24 | `wellbeing_checkins` | B | — | all columns |
| 25 | `post_exam_reflections` | A | all columns | — |

### Key Relationships

```
users ──┬── projects ──┬── source_materials
        │              ├── topics ──┬── content_blocks ── audio_content
        │              │            ├── quiz_questions ── quiz_attempts
        │              │            ├── topic_prerequisites
        │              │            └── session_notes
        │              ├── study_plans ── study_plan_days ── study_plan_day_topics
        │              ├── mock_exams ── mock_exam_answers
        │              └── post_exam_reflections
        ├── study_sessions ── session_topics
        ├── spaced_repetition_cards
        ├── user_achievements
        ├── xp_history
        ├── notifications
        ├── bookmarks
        └── wellbeing_checkins
```

### Shared Column Rules (No Conflicts)

**`users` table:**
- Dev A columns: `full_name`, `avatar_url`, `onboarding_completed`, `learning_modality`, `attention_span`, `engagement_style`, `language_*`, `neuro_*`, `preferred_study_time`, `motivation`
- Dev B columns: `total_xp`, `daily_xp_goal`, `daily_xp_earned`, `current_streak`, `longest_streak`, `last_active_date`

**`topics` table:**
- Dev A columns: `name`, `description`, `difficulty`, `path_order`, `estimated_minutes`, `graph_x`, `graph_y`
- Dev B columns: `status`, `mastery_percentage`, `time_spent_minutes`, `questions_answered`, `accuracy`

### How to Run

Paste the contents of `schema.sql` into **Supabase SQL Editor** and execute.
