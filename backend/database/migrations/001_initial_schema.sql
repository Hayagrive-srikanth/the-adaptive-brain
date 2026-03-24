-- Phase 1: Initial Schema for The Adaptive Brain
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    profile JSONB DEFAULT '{}',
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_active_date DATE,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    exam_date DATE NOT NULL,
    hours_per_day DECIMAL,
    comfort_level VARCHAR,
    readiness_score DECIMAL DEFAULT 0,
    status VARCHAR DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SOURCE MATERIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS source_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_filename VARCHAR,
    file_type VARCHAR,
    storage_path VARCHAR,
    processing_status VARCHAR DEFAULT 'pending',
    ocr_text TEXT,
    embedding vector(1536),
    page_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TOPICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    difficulty VARCHAR,
    prerequisite_ids UUID[],
    mastery_percentage DECIMAL DEFAULT 0,
    status VARCHAR DEFAULT 'not_started',
    estimated_minutes INTEGER,
    path_order INTEGER,
    source_material_ids UUID[],
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- STUDY PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS study_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    total_days INTEGER,
    daily_target_minutes INTEGER,
    status VARCHAR DEFAULT 'active',
    generated_at TIMESTAMPTZ DEFAULT now(),
    regenerated_count INTEGER DEFAULT 0
);

-- ============================================
-- STUDY PLAN DAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS study_plan_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    day_number INTEGER,
    date DATE,
    topic_ids UUID[],
    session_type VARCHAR,
    estimated_minutes INTEGER,
    completed BOOLEAN DEFAULT false,
    actual_minutes INTEGER
);

-- ============================================
-- STUDY SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_day_id UUID REFERENCES study_plan_days(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    topics_covered UUID[],
    session_type VARCHAR,
    pauses_taken INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    xp_earned INTEGER DEFAULT 0
);

-- ============================================
-- CONTENT BLOCKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS content_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    content_type VARCHAR,
    content_body JSONB,
    format_metadata JSONB,
    generated_by VARCHAR,
    duration_estimate_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- QUIZ QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question_type VARCHAR,
    question_text TEXT,
    options JSONB,
    correct_answer TEXT,
    explanation TEXT,
    difficulty VARCHAR,
    hint_layers JSONB,
    times_shown INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    last_shown_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- QUIZ ATTEMPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    user_answer TEXT,
    correct BOOLEAN,
    time_taken_seconds INTEGER,
    hints_used INTEGER DEFAULT 0,
    rephrasing_needed BOOLEAN DEFAULT false,
    rephrase_format VARCHAR,
    attempted_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROFILE EDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profile_edit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_prompt TEXT,
    fields_changed JSONB,
    ai_interpretation TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_correct ON quiz_attempts(question_id, correct);
CREATE INDEX IF NOT EXISTS idx_topics_project_mastery ON topics(project_id, mastery_percentage);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started ON study_sessions(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_source_materials_project_status ON source_materials(project_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_topic ON content_blocks(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_topic ON quiz_questions(topic_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_edit_log ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_own_data ON users FOR ALL USING (auth.uid() = id);

CREATE POLICY projects_own_data ON projects FOR ALL USING (
    user_id = auth.uid()
);

CREATE POLICY materials_own_data ON source_materials FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

CREATE POLICY topics_own_data ON topics FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

CREATE POLICY plans_own_data ON study_plans FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

CREATE POLICY plan_days_own_data ON study_plan_days FOR ALL USING (
    plan_id IN (
        SELECT sp.id FROM study_plans sp
        JOIN projects p ON sp.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY sessions_own_data ON study_sessions FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

CREATE POLICY content_own_data ON content_blocks FOR ALL USING (
    topic_id IN (
        SELECT t.id FROM topics t
        JOIN projects p ON t.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY questions_own_data ON quiz_questions FOR ALL USING (
    topic_id IN (
        SELECT t.id FROM topics t
        JOIN projects p ON t.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY attempts_own_data ON quiz_attempts FOR ALL USING (
    session_id IN (
        SELECT ss.id FROM study_sessions ss
        JOIN projects p ON ss.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY edit_log_own_data ON profile_edit_log FOR ALL USING (
    user_id = auth.uid()
);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
