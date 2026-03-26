-- ============================================================
-- THE ADAPTIVE BRAIN — Shared Database Schema
-- Supabase (PostgreSQL) — Agreed upon by both developers
-- ============================================================
-- Run this in Supabase SQL Editor to create all tables.
-- Auth is handled by Supabase Auth (auth.users).
-- This schema lives in the `public` schema.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: users
-- Owner: SHARED (A writes profile, B writes XP/streaks)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY,                         -- matches auth.users.id
    email           TEXT UNIQUE NOT NULL,
    full_name       TEXT,
    avatar_url      TEXT,

    -- Onboarding & Profile (Developer A)
    onboarding_completed BOOLEAN DEFAULT FALSE,
    learning_modality    TEXT CHECK (learning_modality IN ('visual', 'auditory', 'reading', 'mixed')),
    attention_span       INTEGER DEFAULT 25,                  -- minutes
    engagement_style     TEXT CHECK (engagement_style IN ('gamified', 'progress_stats', 'social', 'minimal')),
    language_primary     TEXT DEFAULT 'English',
    language_comfort     TEXT CHECK (language_comfort IN ('native', 'comfortable', 'developing', 'beginner')),
    neuro_adhd           BOOLEAN DEFAULT FALSE,
    neuro_dyslexia       BOOLEAN DEFAULT FALSE,
    neuro_autism         BOOLEAN DEFAULT FALSE,
    neuro_other          BOOLEAN DEFAULT FALSE,
    preferred_study_time TEXT CHECK (preferred_study_time IN ('morning', 'afternoon', 'evening', 'varies')),
    motivation           TEXT CHECK (motivation IN ('exam_prep', 'understanding', 'catching_up', 'revision')),

    -- Gamification (Developer B)
    total_xp             INTEGER DEFAULT 0,
    daily_xp_goal        INTEGER DEFAULT 50,
    daily_xp_earned      INTEGER DEFAULT 0,
    current_streak       INTEGER DEFAULT 0,
    longest_streak       INTEGER DEFAULT 0,
    last_active_date     DATE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: projects
-- Owner: Developer A (creates), Developer B (reads)
-- ============================================================
CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    exam_date           DATE,
    hours_per_day       NUMERIC(3,1) DEFAULT 2.0,
    comfort_level       TEXT CHECK (comfort_level IN ('beginner', 'intermediate', 'review')) DEFAULT 'beginner',
    readiness_score     INTEGER DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
    status              TEXT CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',

    -- Aggregated stats (updated by triggers or periodic jobs)
    total_topics            INTEGER DEFAULT 0,
    topics_mastered         INTEGER DEFAULT 0,
    total_study_time_minutes INTEGER DEFAULT 0,
    sessions_completed      INTEGER DEFAULT 0,
    average_accuracy        INTEGER DEFAULT 0 CHECK (average_accuracy BETWEEN 0 AND 100),

    last_studied        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================
-- TABLE 3: source_materials
-- Owner: Developer A
-- ============================================================
CREATE TABLE source_materials (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename            TEXT NOT NULL,
    file_type           TEXT CHECK (file_type IN ('pdf', 'docx', 'image', 'txt')),
    file_size_bytes     BIGINT,
    page_count          INTEGER,
    storage_path        TEXT,                                 -- Supabase Storage path
    processing_status   TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    extracted_text      TEXT,                                 -- full OCR/parsed text
    extracted_text_preview TEXT,                              -- first ~200 chars
    uploaded_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_source_materials_project ON source_materials(project_id);

-- ============================================================
-- TABLE 4: topics
-- Owner: SHARED (A creates, B updates mastery after quiz)
-- ============================================================
CREATE TABLE topics (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    difficulty          TEXT CHECK (difficulty IN ('foundational', 'intermediate', 'advanced')) DEFAULT 'foundational',
    status              TEXT CHECK (status IN ('mastered', 'in_progress', 'not_started', 'locked')) DEFAULT 'not_started',
    mastery_percentage  INTEGER DEFAULT 0 CHECK (mastery_percentage BETWEEN 0 AND 100),
    path_order          INTEGER DEFAULT 0,                    -- sequence in study path
    estimated_minutes   INTEGER DEFAULT 30,
    time_spent_minutes  INTEGER DEFAULT 0,
    questions_answered  INTEGER DEFAULT 0,
    accuracy            INTEGER DEFAULT 0 CHECK (accuracy BETWEEN 0 AND 100),

    -- Knowledge graph positioning (optional, can be computed)
    graph_x             FLOAT,
    graph_y             FLOAT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_project ON topics(project_id);
CREATE INDEX idx_topics_status ON topics(status);

-- ============================================================
-- TABLE 5: topic_prerequisites
-- Owner: Developer A
-- Junction table for topic → prerequisite relationships
-- ============================================================
CREATE TABLE topic_prerequisites (
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    prerequisite_id     UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, prerequisite_id),
    CHECK (topic_id != prerequisite_id)
);

-- ============================================================
-- TABLE 6: study_plans
-- Owner: Developer A (creates), Developer B (reads)
-- ============================================================
CREATE TABLE study_plans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    total_days          INTEGER NOT NULL,
    daily_target_minutes INTEGER DEFAULT 120,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_plans_project ON study_plans(project_id);

-- ============================================================
-- TABLE 7: study_plan_days
-- Owner: Developer A (creates), Developer B (marks completed)
-- ============================================================
CREATE TABLE study_plan_days (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id             UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    day_number          INTEGER NOT NULL,
    scheduled_date      DATE NOT NULL,
    session_type        TEXT CHECK (session_type IN ('learn', 'review', 'mock_exam')) DEFAULT 'learn',
    estimated_minutes   INTEGER DEFAULT 60,
    completed           BOOLEAN DEFAULT FALSE,
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_plan_days_plan ON study_plan_days(plan_id);
CREATE INDEX idx_plan_days_date ON study_plan_days(scheduled_date);

-- ============================================================
-- TABLE 8: study_plan_day_topics
-- Junction: which topics are covered on each plan day
-- ============================================================
CREATE TABLE study_plan_day_topics (
    day_id              UUID NOT NULL REFERENCES study_plan_days(id) ON DELETE CASCADE,
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (day_id, topic_id)
);

-- ============================================================
-- TABLE 9: content_blocks
-- Owner: Developer A (creates), Developer B (reads in sessions)
-- ============================================================
CREATE TABLE content_blocks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    content_type        TEXT NOT NULL CHECK (content_type IN (
                            'summary', 'micro_lesson', 'flashcard_deck',
                            'concept_map', 'comparison_table', 'mnemonics', 'audio_lesson'
                        )),
    title               TEXT NOT NULL,
    data                JSONB NOT NULL,                       -- type-specific structured content
    generation_status   TEXT CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')) DEFAULT 'completed',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_blocks_topic ON content_blocks(topic_id);
CREATE INDEX idx_content_blocks_type ON content_blocks(content_type);

-- ============================================================
-- TABLE 10: audio_content
-- Owner: Developer A
-- ============================================================
CREATE TABLE audio_content (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_block_id    UUID REFERENCES content_blocks(id) ON DELETE SET NULL,
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    duration_seconds    INTEGER,
    storage_path        TEXT,                                 -- Supabase Storage path
    transcript          TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audio_content_topic ON audio_content(topic_id);

-- ============================================================
-- TABLE 11: quiz_questions
-- Owner: Developer B (creates), Developer A (reads for content)
-- ============================================================
CREATE TABLE quiz_questions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question_type       TEXT NOT NULL CHECK (question_type IN (
                            'multiple_choice', 'true_false', 'fill_blank', 'short_answer'
                        )),
    difficulty          TEXT CHECK (difficulty IN ('foundational', 'intermediate', 'advanced')) DEFAULT 'foundational',
    question_text       TEXT NOT NULL,
    options             JSONB,                                -- array of strings for MCQ
    correct_answer      TEXT NOT NULL,
    explanation         TEXT,
    hint_layers         JSONB,                                -- array of 3 hint strings
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_topic ON quiz_questions(topic_id);
CREATE INDEX idx_quiz_questions_difficulty ON quiz_questions(difficulty);

-- ============================================================
-- TABLE 12: study_sessions
-- Owner: Developer B
-- ============================================================
CREATE TABLE study_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_day_id         UUID REFERENCES study_plan_days(id) ON DELETE SET NULL,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    duration_minutes    INTEGER,
    status              TEXT CHECK (status IN ('active', 'paused', 'completed', 'abandoned')) DEFAULT 'active',
    xp_earned           INTEGER DEFAULT 0,
    accuracy            INTEGER CHECK (accuracy BETWEEN 0 AND 100),

    -- Wellbeing data captured at session start
    mood                TEXT CHECK (mood IN ('great', 'okay', 'stressed', 'burnt_out')),
    energy              TEXT CHECK (energy IN ('high', 'medium', 'low')),

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_sessions_project ON study_sessions(project_id);
CREATE INDEX idx_sessions_status ON study_sessions(status);

-- ============================================================
-- TABLE 13: session_topics
-- Junction: which topics were covered in a session
-- ============================================================
CREATE TABLE session_topics (
    session_id          UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, topic_id)
);

-- ============================================================
-- TABLE 14: quiz_attempts
-- Owner: Developer B
-- ============================================================
CREATE TABLE quiz_attempts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
    question_id         UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_answer     TEXT,
    is_correct          BOOLEAN NOT NULL,
    time_taken_seconds  INTEGER,
    hints_used          INTEGER DEFAULT 0,
    rephrasing_needed   BOOLEAN DEFAULT FALSE,
    attempted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_session ON quiz_attempts(session_id);
CREATE INDEX idx_quiz_attempts_question ON quiz_attempts(question_id);

-- ============================================================
-- TABLE 15: mock_exams
-- Owner: Developer B
-- ============================================================
CREATE TABLE mock_exams (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    total_questions     INTEGER NOT NULL,
    time_allowed_minutes INTEGER DEFAULT 60,
    time_taken_minutes  INTEGER,
    score_percentage    INTEGER CHECK (score_percentage BETWEEN 0 AND 100),
    grade               TEXT,
    status              TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
    topic_breakdown     JSONB,                                -- array of {topic_id, topic_name, correct, total, percentage}
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_mock_exams_user ON mock_exams(user_id);
CREATE INDEX idx_mock_exams_project ON mock_exams(project_id);

-- ============================================================
-- TABLE 16: mock_exam_answers
-- Owner: Developer B
-- ============================================================
CREATE TABLE mock_exam_answers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id             UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_answer     TEXT,
    is_correct          BOOLEAN,
    flagged             BOOLEAN DEFAULT FALSE,
    answer_order        INTEGER                               -- question sequence in exam
);

CREATE INDEX idx_mock_exam_answers_exam ON mock_exam_answers(exam_id);

-- ============================================================
-- TABLE 17: spaced_repetition_cards
-- Owner: Developer B
-- ============================================================
CREATE TABLE spaced_repetition_cards (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id         UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    easiness_factor     NUMERIC(4,2) DEFAULT 2.50,            -- SM-2 algorithm
    interval_days       INTEGER DEFAULT 1,
    repetitions         INTEGER DEFAULT 0,
    next_review_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reviewed       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, question_id)
);

CREATE INDEX idx_sr_cards_user ON spaced_repetition_cards(user_id);
CREATE INDEX idx_sr_cards_next_review ON spaced_repetition_cards(next_review_date);

-- ============================================================
-- TABLE 18: achievements
-- Owner: Developer B
-- ============================================================
CREATE TABLE achievements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key                 TEXT UNIQUE NOT NULL,                  -- e.g. 'first_steps', 'streak_7'
    name                TEXT NOT NULL,
    description         TEXT,
    category            TEXT CHECK (category IN ('milestone', 'streak', 'mastery', 'quiz', 'study')),
    icon_name           TEXT,                                  -- lucide icon name
    xp_award            INTEGER DEFAULT 0,
    requirement_value   INTEGER,                               -- threshold to unlock
    sort_order          INTEGER DEFAULT 0
);

-- ============================================================
-- TABLE 19: user_achievements
-- Owner: Developer B
-- ============================================================
CREATE TABLE user_achievements (
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id      UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at           TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- ============================================================
-- TABLE 20: xp_history
-- Owner: Developer B
-- ============================================================
CREATE TABLE xp_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount              INTEGER NOT NULL,
    source              TEXT CHECK (source IN ('session', 'quiz', 'streak', 'achievement', 'review', 'mock_exam')),
    reference_id        UUID,                                 -- session_id, quiz_attempt_id, etc.
    earned_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_xp_history_user ON xp_history(user_id);
CREATE INDEX idx_xp_history_date ON xp_history(earned_at);

-- ============================================================
-- TABLE 21: notifications
-- Owner: Developer B
-- ============================================================
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT CHECK (type IN ('spaced_review', 'daily_reminder', 'streak_warning', 'milestone')),
    title               TEXT NOT NULL,
    body                TEXT,
    read                BOOLEAN DEFAULT FALSE,
    sent_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- ============================================================
-- TABLE 22: bookmarks
-- Owner: Developer B
-- ============================================================
CREATE TABLE bookmarks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_block_id    UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
    topic_name          TEXT,
    preview             TEXT,
    saved_at            TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, content_block_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- ============================================================
-- TABLE 23: session_notes
-- Owner: Developer B
-- ============================================================
CREATE TABLE session_notes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    text                TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_notes_user ON session_notes(user_id);
CREATE INDEX idx_session_notes_topic ON session_notes(topic_id);

-- ============================================================
-- TABLE 24: wellbeing_checkins
-- Owner: Developer B
-- Standalone check-ins outside of sessions
-- ============================================================
CREATE TABLE wellbeing_checkins (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
    mood                TEXT CHECK (mood IN ('great', 'okay', 'stressed', 'burnt_out')),
    energy              TEXT CHECK (energy IN ('high', 'medium', 'low')),
    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wellbeing_user ON wellbeing_checkins(user_id);

-- ============================================================
-- TABLE 25: post_exam_reflections
-- Owner: Developer A
-- ============================================================
CREATE TABLE post_exam_reflections (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reflection_text     TEXT,
    confidence_before   INTEGER CHECK (confidence_before BETWEEN 1 AND 10),
    confidence_after    INTEGER CHECK (confidence_after BETWEEN 1 AND 10),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELPER: updated_at trigger
-- Auto-update the updated_at column on any row change
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_topics_updated_at
    BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_study_plans_updated_at
    BEFORE UPDATE ON study_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Achievement definitions
-- These are static — insert once, both devs can reference
-- ============================================================
INSERT INTO achievements (key, name, description, category, icon_name, xp_award, requirement_value, sort_order) VALUES
    ('first_steps',       'First Steps',        'Complete your first study session',           'milestone', 'Footprints',   50,   1,  1),
    ('week_warrior',      'Week Warrior',        'Study every day for a week',                 'milestone', 'Calendar',    200,   7,  2),
    ('month_of_mastery',  'Month of Mastery',    'Study every day for 30 days',                'milestone', 'Crown',       500,  30,  3),
    ('streak_3',          'Getting Started',     'Maintain a 3-day streak',                    'streak',    'Flame',        75,   3,  4),
    ('streak_7',          'On Fire',             'Maintain a 7-day streak',                    'streak',    'Flame',       150,   7,  5),
    ('streak_30',         'Unstoppable',         'Maintain a 30-day streak',                   'streak',    'Flame',       500,  30,  6),
    ('topic_master',      'Topic Master',        'Achieve 100% mastery on a topic',            'mastery',   'Star',        100,   1,  7),
    ('half_way',          'Half Way There',      'Master 50% of topics in a project',          'mastery',   'Target',      250,  50,  8),
    ('brain_full',        'Brain Full',          'Master all topics in a project',             'mastery',   'Brain',       750, 100,  9),
    ('perfect_score',     'Perfect Score',       'Get 100% on a quiz session',                 'quiz',      'Trophy',      150, 100, 10),
    ('quick_draw',        'Quick Draw',          'Answer 10 questions under 5 seconds each',   'quiz',      'Zap',        100,  10, 11),
    ('speed_demon',       'Speed Demon',         'Complete a mock exam in under half the time', 'quiz',      'Timer',      200,  50, 12),
    ('bookworm',          'Bookworm',            'Complete 50 study sessions',                 'study',     'BookOpen',    300,  50, 13),
    ('marathon_runner',   'Marathon Runner',     'Study for 4+ hours in a single day',         'study',     'Activity',    200, 240, 14),
    ('early_bird',        'Early Bird',          'Complete 10 sessions before 9am',            'study',     'Sunrise',     150,  10, 15),
    ('night_owl',         'Night Owl',           'Complete 10 sessions after 10pm',            'study',     'Moon',        150,  10, 16),
    ('the_comeback',      'The Comeback',        'Return to studying after 3+ days off',       'study',     'RefreshCw',    75,   3, 17);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- Ensures users can only access their own data
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_checkins ENABLE ROW LEVEL SECURITY;

-- Users can only access their own row
CREATE POLICY users_own ON users FOR ALL USING (id = auth.uid());

-- Users can only access their own projects
CREATE POLICY projects_own ON projects FOR ALL USING (user_id = auth.uid());

-- Materials: access via project ownership
CREATE POLICY materials_own ON source_materials FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Topics: access via project ownership
CREATE POLICY topics_own ON topics FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Content blocks: access via topic → project ownership
CREATE POLICY content_blocks_own ON content_blocks FOR ALL
    USING (topic_id IN (
        SELECT t.id FROM topics t JOIN projects p ON t.project_id = p.id WHERE p.user_id = auth.uid()
    ));

-- Study plans: access via project ownership
CREATE POLICY study_plans_own ON study_plans FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Plan days: access via plan → project ownership
CREATE POLICY plan_days_own ON study_plan_days FOR ALL
    USING (plan_id IN (
        SELECT sp.id FROM study_plans sp JOIN projects p ON sp.project_id = p.id WHERE p.user_id = auth.uid()
    ));

-- Sessions: direct user ownership
CREATE POLICY sessions_own ON study_sessions FOR ALL USING (user_id = auth.uid());

-- Quiz questions: access via topic → project ownership
CREATE POLICY quiz_questions_own ON quiz_questions FOR ALL
    USING (topic_id IN (
        SELECT t.id FROM topics t JOIN projects p ON t.project_id = p.id WHERE p.user_id = auth.uid()
    ));

-- Quiz attempts: direct user ownership
CREATE POLICY quiz_attempts_own ON quiz_attempts FOR ALL USING (user_id = auth.uid());

-- Mock exams: direct user ownership
CREATE POLICY mock_exams_own ON mock_exams FOR ALL USING (user_id = auth.uid());

-- Mock exam answers: access via exam ownership
CREATE POLICY mock_exam_answers_own ON mock_exam_answers FOR ALL
    USING (exam_id IN (SELECT id FROM mock_exams WHERE user_id = auth.uid()));

-- SR cards: direct user ownership
CREATE POLICY sr_cards_own ON spaced_repetition_cards FOR ALL USING (user_id = auth.uid());

-- Achievements: readable by all (static data)
CREATE POLICY achievements_read ON achievements FOR SELECT USING (true);

-- User achievements: direct user ownership
CREATE POLICY user_achievements_own ON user_achievements FOR ALL USING (user_id = auth.uid());

-- XP history: direct user ownership
CREATE POLICY xp_history_own ON xp_history FOR ALL USING (user_id = auth.uid());

-- Notifications: direct user ownership
CREATE POLICY notifications_own ON notifications FOR ALL USING (user_id = auth.uid());

-- Bookmarks: direct user ownership
CREATE POLICY bookmarks_own ON bookmarks FOR ALL USING (user_id = auth.uid());

-- Session notes: direct user ownership
CREATE POLICY session_notes_own ON session_notes FOR ALL USING (user_id = auth.uid());

-- Wellbeing: direct user ownership
CREATE POLICY wellbeing_own ON wellbeing_checkins FOR ALL USING (user_id = auth.uid());

-- Post-exam reflections: direct user ownership
CREATE POLICY reflections_own ON post_exam_reflections FOR ALL USING (user_id = auth.uid());
