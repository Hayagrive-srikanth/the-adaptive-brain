from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID


# ============================================
# USER SCHEMAS
# ============================================
class UserProfile(BaseModel):
    learning_modality: str = "mixed"
    attention_span_minutes: int = 20
    engagement_style: str = "moderate"
    language: Dict[str, str] = Field(default_factory=lambda: {
        "first_language": "en",
        "english_comfort": "native"
    })
    neurodivergent: Dict[str, Any] = Field(default_factory=lambda: {
        "adhd": False,
        "dyslexia": False,
        "autism": False,
        "other": None
    })
    study_time_preference: str = "varies"
    motivation_type: str = "progress_stats"
    custom_notes: str = ""


class UserCreate(BaseModel):
    email: str
    name: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    profile: Dict[str, Any] = {}
    total_xp: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    last_active_date: Optional[str] = None
    onboarding_completed: bool = False
    created_at: Optional[str] = None


class OnboardingAnswer(BaseModel):
    question_id: int
    answer: str


class OnboardingRequest(BaseModel):
    answers: List[OnboardingAnswer]


# ============================================
# PROJECT SCHEMAS
# ============================================
class ProjectCreate(BaseModel):
    name: str
    exam_date: str
    hours_per_day: float
    comfort_level: str


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    exam_date: str
    hours_per_day: Optional[float] = None
    comfort_level: Optional[str] = None
    readiness_score: float = 0
    status: str = "active"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    exam_date: Optional[str] = None
    hours_per_day: Optional[float] = None
    comfort_level: Optional[str] = None


# ============================================
# MATERIAL SCHEMAS
# ============================================
class MaterialUploadResponse(BaseModel):
    id: str
    original_filename: str
    file_type: str
    processing_status: str
    created_at: Optional[str] = None


class MaterialStatus(BaseModel):
    id: str
    processing_status: str
    ocr_text: Optional[str] = None
    page_count: Optional[int] = None


# ============================================
# TOPIC SCHEMAS
# ============================================
class TopicResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    prerequisite_ids: List[str] = []
    mastery_percentage: float = 0
    status: str = "not_started"
    estimated_minutes: Optional[int] = None
    path_order: Optional[int] = None
    source_material_ids: List[str] = []
    created_at: Optional[str] = None


class TopicListResponse(BaseModel):
    topics: List[TopicResponse]
    total_count: int


# ============================================
# STUDY PLAN SCHEMAS
# ============================================
class StudyPlanDayResponse(BaseModel):
    id: str
    plan_id: str
    day_number: int
    date: Optional[str] = None
    topic_ids: List[str] = []
    session_type: Optional[str] = None
    estimated_minutes: Optional[int] = None
    completed: bool = False
    actual_minutes: Optional[int] = None


class StudyPlanResponse(BaseModel):
    id: str
    project_id: str
    total_days: int
    daily_target_minutes: int
    status: str = "active"
    generated_at: Optional[str] = None
    regenerated_count: int = 0
    days: List[StudyPlanDayResponse] = []


# ============================================
# SESSION SCHEMAS
# ============================================
class SessionCreate(BaseModel):
    project_id: str
    plan_day_id: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    project_id: str
    plan_day_id: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    topics_covered: List[str] = []
    session_type: Optional[str] = None
    pauses_taken: int = 0
    completed: bool = False
    xp_earned: int = 0


class SessionWrapUp(BaseModel):
    session_id: str
    topics_covered: List[Dict[str, Any]] = []
    questions_answered: int = 0
    correct_answers: int = 0
    accuracy_percentage: float = 0
    duration_minutes: int = 0
    xp_earned: int = 0
    readiness_score_before: float = 0
    readiness_score_after: float = 0
    next_day_preview: Optional[Dict[str, Any]] = None


# ============================================
# CONTENT BLOCK SCHEMAS
# ============================================
class ContentBlockResponse(BaseModel):
    id: str
    topic_id: str
    content_type: str
    content_body: Dict[str, Any] = {}
    format_metadata: Optional[Dict[str, Any]] = None
    generated_by: Optional[str] = None
    duration_estimate_minutes: Optional[int] = None
    created_at: Optional[str] = None


# ============================================
# QUIZ SCHEMAS
# ============================================
class QuizQuestionResponse(BaseModel):
    id: str
    topic_id: str
    question_type: str
    question_text: str
    options: Optional[Dict[str, Any]] = None
    difficulty: Optional[str] = None
    hint_layers: Optional[List[str]] = None
    times_shown: int = 0
    times_correct: int = 0


class QuizAttemptCreate(BaseModel):
    question_id: str
    session_id: str
    user_answer: str
    time_taken_seconds: Optional[int] = None
    hints_used: int = 0


class QuizAttemptResponse(BaseModel):
    id: str
    question_id: str
    session_id: str
    user_answer: str
    correct: bool
    time_taken_seconds: Optional[int] = None
    hints_used: int = 0
    attempted_at: Optional[str] = None


class QuizFeedback(BaseModel):
    correct: bool
    explanation: str
    correct_answer: Optional[str] = None
    attempt_id: Optional[str] = None
    mastery_update: Optional[float] = None


# ============================================
# PROFILE EDIT SCHEMAS
# ============================================
class ProfileEditRequest(BaseModel):
    prompt: str


class ProfileEditResponse(BaseModel):
    updated_profile: Dict[str, Any]
    fields_changed: Dict[str, Any]
    interpretation: str


class QuizGenerateRequest(BaseModel):
    count: int = 5
    difficulty: str = "medium"


# ============================================
# PHASE 2: REPHRASE SCHEMAS
# ============================================
class RephraseRequest(BaseModel):
    question_id: str
    attempt_count: int


class RephraseResponse(BaseModel):
    rephrased_explanation: str
    new_question: Optional[Dict[str, Any]] = None
    level: int = 1
    analogy_used: Optional[str] = None
    building_blocks: Optional[List[Dict[str, Any]]] = None
    mnemonic: Optional[str] = None


class HintRequest(BaseModel):
    question_id: str
    hint_index: int


class HintResponse(BaseModel):
    hint_text: str
    hint_index: int
    question_id: str


# ============================================
# PHASE 2: CONTENT SCHEMAS
# ============================================
class ContentGenerateRequest(BaseModel):
    content_type: str


# ============================================
# PHASE 2: AUDIO SCHEMAS
# ============================================
class AudioContentResponse(BaseModel):
    id: str
    content_block_id: str
    script: Optional[str] = None
    audio_storage_path: Optional[str] = None
    audio_url: Optional[str] = None
    duration_estimate_minutes: Optional[float] = None
    status: str = "pending"


class TranscriptionResponse(BaseModel):
    transcript: str
    filename: Optional[str] = None
