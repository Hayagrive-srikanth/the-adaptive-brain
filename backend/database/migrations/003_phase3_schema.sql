-- Migration 003: Phase 3 - Achievements & Gamification
-- "The Adaptive Brain" app

BEGIN;

-- 1. Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    xp_awarded INT DEFAULT 0,
    context JSONB,
    UNIQUE(user_id, achievement_type)
);

COMMENT ON TABLE achievements IS 'Tracks user achievements and gamification milestones';
COMMENT ON COLUMN achievements.achievement_type IS 'Type of achievement: first_session, streak_3, streak_7, streak_30, topic_mastered, five_topics, perfect_quiz, night_owl, early_bird, marathon, speed_demon, comeback';

-- 2. Alter users table: add daily XP goal
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS daily_xp_goal INT DEFAULT 100;

-- 3. Alter study_sessions table: add focus mode columns
ALTER TABLE study_sessions
    ADD COLUMN IF NOT EXISTS focus_mode BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS focus_score INT;

-- 4. Enable Row Level Security on achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY achievements_user_policy ON achievements
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5. Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_achievement_type ON achievements(achievement_type);

COMMIT;
