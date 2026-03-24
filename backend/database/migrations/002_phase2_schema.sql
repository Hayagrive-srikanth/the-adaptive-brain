-- Phase 2: Intelligence Layer Schema
-- Run this in Supabase SQL Editor after Phase 1 migration

-- ============================================
-- SPACED REPETITION CARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS spaced_repetition_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    easiness_factor DECIMAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetition_count INTEGER DEFAULT 0,
    next_review_date DATE,
    last_review_date DATE,
    last_quality_score INTEGER
);

-- ============================================
-- AUDIO CONTENT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audio_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_block_id UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
    storage_path VARCHAR,
    duration_seconds INTEGER,
    voice_settings JSONB,
    transcript TEXT,
    interactive_pauses JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- WELLBEING CHECK-INS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wellbeing_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    mood VARCHAR,
    energy_level VARCHAR,
    adaptation_made VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR,
    title VARCHAR,
    body TEXT,
    scheduled_at TIMESTAMPTZ,
    sent BOOLEAN DEFAULT false,
    opened BOOLEAN DEFAULT false,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    question_ids UUID[]
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sr_cards_user_review ON spaced_repetition_cards(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_scheduled ON notifications(user_id, scheduled_at, sent);
CREATE INDEX IF NOT EXISTS idx_wellbeing_user ON wellbeing_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_content_block ON audio_content(content_block_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE spaced_repetition_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY sr_cards_own_data ON spaced_repetition_cards FOR ALL USING (
    user_id = auth.uid()
);

CREATE POLICY audio_own_data ON audio_content FOR ALL USING (
    content_block_id IN (
        SELECT cb.id FROM content_blocks cb
        JOIN topics t ON cb.topic_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY wellbeing_own_data ON wellbeing_checkins FOR ALL USING (
    user_id = auth.uid()
);

CREATE POLICY notifications_own_data ON notifications FOR ALL USING (
    user_id = auth.uid()
);
