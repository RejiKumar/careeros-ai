export interface ContactInfo {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
}

export interface WorkEntry {
  organization: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface ProjectEntry {
  name: string;
  description: string | null;
  url: string | null;
  bullets: string[];
}

export interface ResumeContent {
  contact: ContactInfo;
  summary: string | null;
  skills: string[];
  experience: WorkEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: string[];
  languages: string[];
}

export interface ResumeResponse {
  id: string;
  title: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeVersionResponse {
  id: string;
  resume_id: string;
  version: number;
  source: string;
  created_at: string;
}

export interface ResumeImportResponse {
  resume: ResumeResponse;
  version: ResumeVersionResponse;
  parsed: ResumeContent;
  file_url: string | null;
}

export interface ResumeDetailResponse {
  resume: ResumeResponse;
  version: ResumeVersionResponse | null;
  parsed: ResumeContent | null;
  file_url: string | null;
}

export interface HealthDimensionScore {
  dimension: string;
  score: number;
  explanation: string | null;
}

export interface GapFinding {
  description: string;
  suggestion: string | null;
}

export interface AssessmentResponse {
  id: string;
  resume_id: string;
  scores: HealthDimensionScore[];
  strengths: string[];
  gaps: GapFinding[];
  evidence: string[];
  created_at: string;
}

export interface UserResponse {
  id: string;
  email: string | null;
  role: string | null;
}

export interface JobDescriptionResponse {
  id: string;
  title: string | null;
  company: string | null;
  raw_text: string;
  resume_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface MatchAction {
  title: string;
  detail: string;
}

export interface MatchResponse {
  id: string;
  job_description_id: string;
  resume_version_id: string;
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  actions: MatchAction[];
  model_version: string | null;
  created_at: string;
}

export interface JobDescriptionMatchResponse {
  job_description: JobDescriptionResponse;
  match: MatchResponse;
}

export interface CoachThreadResponse {
  id: string;
  title: string | null;
  resume_id: string | null;
  job_description_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachMessageResponse {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface CoachThreadDetailResponse {
  thread: CoachThreadResponse;
  messages: CoachMessageResponse[];
}

export interface CoachMessagePairResponse {
  user_message: CoachMessageResponse;
  assistant_message: CoachMessageResponse;
}

export interface RewriteSuggestion {
  id: string;
  section: string;
  original: string;
  rewritten: string;
  rationale: string;
}

export interface RewriteBatchResponse {
  id: string;
  resume_id: string;
  status: string;
  suggestions: RewriteSuggestion[];
  resume_version_id: string;
  source_version_number: number;
  accepted_version_id: string | null;
  model_version: string | null;
  created_at: string;
}

export interface RewriteAcceptedResponse {
  resume_id: string;
  version: number;
  version_id: string;
  status: string;
}

export interface MissionResponse {
  id: string;
  key: string;
  title: string;
  description: string | null;
  xp_reward: number;
  cadence: string;
  is_active: boolean;
}

export interface MissionCompletionResponse {
  mission_id: string;
  mission_key: string;
  completed_on: string;
  xp_awarded: number;
}

export interface MissionProgressResponse {
  total_xp: number;
  level: number;
  current_streak: number;
  missions_completed: number;
  completions: MissionCompletionResponse[];
}

export interface MissionCompleteResponse {
  mission_key: string;
  xp_awarded: number;
  new_total_xp: number;
  already_completed: boolean;
}

export interface DashboardResponse {
  health_score: number | null;
  health_level: string | null;
  latest_match_score: number | null;
  latest_match_jd_title: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
  active_missions: MissionResponse[];
  recent_completions: MissionCompletionResponse[];
}

export interface EntitlementResponse {
  plan: string;
  status: string;
  usage: Record<string, number>;
  limits: Record<string, number | null>;
}

export interface AchievementResponse {
  id: string;
  key: string;
  title: string;
  description: string;
  condition: string;
  earned_at: string | null;
}

export interface FeedbackRequest {
  output_type: "assessment" | "job_match" | "coach_message" | "roast" | "rewrite";
  output_id: string;
  rating: "helpful" | "not_helpful";
  reason?: "incorrect" | "too_generic" | "not_relevant" | "too_long" | "other" | null;
  reason_detail?: string | null;
}

export interface FeedbackResponse {
  id: string;
  output_type: string;
  output_id: string;
  rating: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoastResponse {
  id: string;
  resume_id: string;
  mode: string;
  tone: string;
  sections: { title: string; content: string }[];
  improvements: string[];
  model_version: string | null;
  created_at: string;
}

export interface WrappedDataPoint {
  key: string;
  label: string;
  value: string;
  available: boolean;
}

export interface WrappedAchievement {
  key: string;
  title: string;
  earned_at: string | null;
}

export interface WrappedResponse {
  generated_at: string;
  data_points: WrappedDataPoint[];
  achievements: WrappedAchievement[];
}

export interface InterviewSessionResponse {
  id: string;
  mode: string;
  target_job: string | null;
  target_skills: string[];
  status: string;
  created_at: string;
}

export interface InterviewQuestionResponse {
  id: string;
  question: string;
  focus: string;
}

export interface InterviewSessionDetailResponse {
  session: InterviewSessionResponse;
  questions: InterviewQuestionResponse[];
}

export interface InterviewEvaluationResponse {
  relevance: number;
  clarity: number;
  structure: number;
  technical_correctness: number;
  completeness: number;
  feedback: string;
  suggested_answer: string;
}

export interface InterviewAnswerResponse {
  id: string;
  question_id: string;
  content: string;
  evaluation: InterviewEvaluationResponse;
  created_at: string;
}

export interface GuestMigrationResponse {
  migrated_records: number;
  guest_id: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
