import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ============================================
// AUTH
// ============================================
export const authApi = {
  signup: (data: { email: string; name: string; password: string }) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  signin: (email: string, password: string) =>
    request(`/api/auth/signin?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, { method: 'POST' }),

  signout: () => request('/api/auth/signout', { method: 'POST' }),

  me: () => request('/api/auth/me'),
};

// ============================================
// USERS
// ============================================
export const usersApi = {
  completeOnboarding: (answers: { question_id: number; answer: string }[]) =>
    request('/api/users/onboarding', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  getProfile: () => request('/api/users/profile'),

  editProfile: (prompt: string) =>
    request('/api/users/profile/edit', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  getStats: () => request('/api/users/stats'),
};

// ============================================
// PROJECTS
// ============================================
export const projectsApi = {
  create: (data: { name: string; exam_date: string; hours_per_day: number; comfort_level: string }) =>
    request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),

  list: () => request<{ projects: any[] }>('/api/projects'),

  get: (id: string) => request(`/api/projects/${id}`),

  update: (id: string, data: any) =>
    request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  archive: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
};

// ============================================
// MATERIALS
// ============================================
export const materialsApi = {
  upload: async (projectId: string, files: File[]) => {
    const headers = await getAuthHeaders();
    delete (headers as any)['Content-Type']; // Let browser set multipart boundary

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const res = await fetch(`${API_URL}/api/projects/${projectId}/materials`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail);
    }
    return res.json();
  },

  list: (projectId: string) =>
    request<{ materials: any[] }>(`/api/projects/${projectId}/materials`),

  getStatus: (materialId: string) =>
    request(`/api/materials/${materialId}/status`),

  delete: (materialId: string) =>
    request(`/api/materials/${materialId}`, { method: 'DELETE' }),
};

// ============================================
// TOPICS
// ============================================
export const topicsApi = {
  list: (projectId: string) =>
    request<{ topics: any[]; total_count: number }>(`/api/projects/${projectId}/topics`),

  get: (topicId: string) => request(`/api/topics/${topicId}`),

  generate: (projectId: string) =>
    request(`/api/projects/${projectId}/topics/generate`, { method: 'POST' }),
};

// ============================================
// STUDY PLANS
// ============================================
export const plansApi = {
  generate: (projectId: string) =>
    request(`/api/projects/${projectId}/plan/generate`, { method: 'POST' }),

  get: (projectId: string) => request(`/api/projects/${projectId}/plan`),

  getToday: (projectId: string) => request(`/api/projects/${projectId}/plan/today`),
};

// ============================================
// SESSIONS
// ============================================
export const sessionsApi = {
  start: (projectId: string, planDayId?: string) =>
    request('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, plan_day_id: planDayId }),
    }),

  end: (sessionId: string, topicsCovered: string[]) =>
    request(`/api/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ topics_covered: topicsCovered }),
    }),

  get: (sessionId: string) => request(`/api/sessions/${sessionId}`),

  getContent: (sessionId: string, topicId: string) =>
    request(`/api/sessions/${sessionId}/content/${topicId}`),

  list: (projectId: string) =>
    request<{ sessions: any[] }>(`/api/projects/${projectId}/sessions`),
};

// ============================================
// QUIZ
// ============================================
export const quizApi = {
  generateQuestions: (topicId: string, count = 5, difficulty = 'medium') =>
    request(`/api/topics/${topicId}/questions/generate`, {
      method: 'POST',
      body: JSON.stringify({ count, difficulty }),
    }),

  getQuestions: (topicId: string) =>
    request<{ questions: any[] }>(`/api/topics/${topicId}/questions`),

  submitAttempt: (data: {
    question_id: string;
    session_id: string;
    user_answer: string;
    time_taken_seconds?: number;
    hints_used?: number;
  }) =>
    request('/api/quiz/attempt', { method: 'POST', body: JSON.stringify(data) }),

  getResults: (sessionId: string) =>
    request<{ results: any[] }>(`/api/sessions/${sessionId}/quiz-results`),

  rephrase: (questionId: string) =>
    request(`/api/questions/${questionId}/rephrase`, { method: 'POST' }),

  hint: (questionId: string, hintIndex: number) =>
    request(`/api/questions/${questionId}/hint`, {
      method: 'POST',
      body: JSON.stringify({ hint_index: hintIndex }),
    }),
};

// ============================================
// SPACED REPETITION
// ============================================
export const reviewsApi = {
  getDue: () => request('/api/reviews/due'),
  submitAttempt: (data: { question_id: string; quality_score: number }) =>
    request('/api/reviews/attempt', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => request('/api/reviews/stats'),
};

// ============================================
// CONTENT
// ============================================
export const contentApi = {
  generate: (topicId: string, contentType: string) =>
    request(`/api/topics/${topicId}/content/generate`, {
      method: 'POST',
      body: JSON.stringify({ content_type: contentType }),
    }),
  list: (topicId: string) => request(`/api/topics/${topicId}/content`),
  getRecommended: (topicId: string) =>
    request(`/api/topics/${topicId}/content/recommended`),
};

// ============================================
// AUDIO
// ============================================
export const audioApi = {
  generate: (contentId: string) =>
    request(`/api/content/${contentId}/audio/generate`, { method: 'POST' }),
  get: (audioId: string) => request(`/api/audio/${audioId}`),
};

// ============================================
// WELLBEING
// ============================================
export const wellbeingApi = {
  checkin: (sessionId: string, data: { mood: string; energy_level: string }) =>
    request(`/api/sessions/${sessionId}/checkin`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  history: () => request('/api/users/wellbeing/history'),
};

// ============================================
// NOTIFICATIONS
// ============================================
export const notificationsApi = {
  list: () => request('/api/notifications'),
  markOpened: (id: string) =>
    request(`/api/notifications/${id}/opened`, { method: 'POST' }),
};
