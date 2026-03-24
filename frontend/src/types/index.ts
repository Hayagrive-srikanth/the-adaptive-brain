export interface UserProfile {
  learning_modality: 'audio' | 'visual' | 'reading' | 'mixed';
  attention_span_minutes: number;
  engagement_style: 'gamified' | 'moderate' | 'self_paced';
  language: {
    first_language: string;
    english_comfort: 'native' | 'comfortable' | 'struggling';
  };
  neurodivergent: {
    adhd: boolean;
    dyslexia: boolean;
    autism: boolean;
    other: string | null;
  };
  study_time_preference: 'morning' | 'afternoon' | 'evening' | 'night' | 'varies';
  motivation_type: 'progress_stats' | 'streaks' | 'social' | 'outcome_focused';
  custom_notes: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  profile: UserProfile;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  exam_date: string;
  hours_per_day: number;
  comfort_level: string;
  readiness_score: number;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  topics?: Topic[];
  materials_count?: number;
  materials_processed?: number;
}

export interface SourceMaterial {
  id: string;
  project_id: string;
  original_filename: string;
  file_type: string;
  storage_path: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  page_count: number | null;
  created_at: string;
}

export interface Topic {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  difficulty: 'foundational' | 'intermediate' | 'advanced';
  prerequisite_ids: string[];
  mastery_percentage: number;
  status: 'not_started' | 'in_progress' | 'mastered';
  estimated_minutes: number | null;
  path_order: number | null;
  source_material_ids: string[];
  created_at: string;
  updated_at: string;
  content_blocks?: ContentBlock[];
}

export interface StudyPlan {
  id: string;
  project_id: string;
  total_days: number;
  daily_target_minutes: number;
  status: 'active' | 'outdated' | 'completed';
  generated_at: string;
  regenerated_count: number;
  days: StudyPlanDay[];
}

export interface StudyPlanDay {
  id: string;
  plan_id: string;
  day_number: number;
  date: string;
  topic_ids: string[];
  session_type: 'new_material' | 'review' | 'mixed' | 'mock_exam';
  estimated_minutes: number;
  completed: boolean;
  actual_minutes: number | null;
}

export interface StudySession {
  id: string;
  project_id: string;
  plan_day_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  topics_covered: string[];
  session_type: string;
  pauses_taken: number;
  completed: boolean;
  xp_earned: number;
}

export interface ContentBlock {
  id: string;
  topic_id: string;
  content_type: 'audio_lesson' | 'flashcard_deck' | 'summary' | 'concept_map' | 'quiz' | 'micro_lesson' | 'interactive_challenge';
  content_body: Record<string, any>;
  format_metadata: Record<string, any> | null;
  generated_by: string | null;
  duration_estimate_minutes: number | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  topic_id: string;
  question_type: 'multiple_choice' | 'fill_blank' | 'short_answer' | 'true_false';
  question_text: string;
  options: Record<string, string> | null;
  difficulty: string;
  hint_layers: string[] | null;
  times_shown: number;
  times_correct: number;
}

export interface QuizAttempt {
  id: string;
  question_id: string;
  session_id: string;
  user_answer: string;
  correct: boolean;
  time_taken_seconds: number | null;
  hints_used: number;
  attempted_at: string;
}

export interface QuizFeedback {
  correct: boolean;
  explanation: string;
  correct_answer: string | null;
  attempt_id: string | null;
  mastery_update: number | null;
}

export interface SessionWrapUp {
  session_id: string;
  topics_covered: { id: string; name: string; mastery_percentage: number }[];
  questions_answered: number;
  correct_answers: number;
  accuracy_percentage: number;
  duration_minutes: number;
  xp_earned: number;
  readiness_score_before: number;
  readiness_score_after: number;
  next_day_preview: Record<string, any> | null;
}

export interface OnboardingQuestion {
  id: number;
  question: string;
  options: string[];
  multiSelect?: boolean;
}
