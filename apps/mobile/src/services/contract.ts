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

export interface JobSearchResult {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string | null;
  description: string | null;
  skills: string[];
  match_score: number | null;
  salary_range: string | null;
  posted_date: string | null;
  created_at?: string;
}

export interface JobSearchResponse {
  results: JobSearchResult[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SavedJobResponse {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  source: string;
  url: string;
  saved_at: string;
  match_score?: number | null;
}

export interface JobAlertPreference {
  id: string;
  user_id: string;
  keywords: string[];
  location: string | null;
  sources: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** One tailored field with the model's reasoning (API: `diffs[]`). */
export interface TailorFieldDiff {
  /** "summary", "skills" or "experience". */
  field: string;
  original: string;
  tailored: string;
  reasoning: string;
}

/** Response of POST /resume-tailor/tailor, /accept and items of GET /history/{id}. */
export interface TailorResponse {
  id: string;
  user_id: string;
  resume_id: string;
  job_description_id: string;
  tailored_content: ResumeContent;
  diffs: TailorFieldDiff[];
  original_version_id: string;
  tailored_version_id: string | null;
  created_at: string;
  accepted: boolean;
}

export interface FCMTokenResponse {
  id: string;
  token: string;
  platform: string;
  created_at: string;
}

export interface NotificationPreferenceResponse {
  id?: string;
  user_id?: string;
  job_alerts: boolean;
  mission_reminders: boolean;
  career_tips: boolean;
  frequency: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationLogResponse {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  sent_at: string;
  read_at: string | null;
}

export interface LearningResource {
  type: "course" | "certification" | "article" | "tutorial";
  title: string;
  url: string | null;
  provider: string | null;
}

export interface SkillGap {
  skill: string;
  match_level: "matched" | "partial" | "missing";
}

export interface GapAnalysisResponse {
  id: string;
  resume_id: string;
  job_description_id: string;
  overall_match_percentage: number;
  matched_skills: string[];
  partial_skills: string[];
  missing_skills: string[];
  learning_resources: LearningResource[];
  created_at: string;
}

/** Raw skills-gap shapes returned by the API (mapped to GapAnalysisResponse in ApiClient). */
export interface ApiLearningResource {
  title: string;
  url: string | null;
  type: string;
  provider: string | null;
}

export interface ApiGapSkill {
  skill: string;
  status: string;
  resume_evidence: string | null;
  job_requirement: string;
  confidence: number;
  learning_resources: ApiLearningResource[] | null;
}

export interface ApiGapAnalysis {
  id: string;
  user_id: string;
  resume_id: string;
  job_description_id: string;
  matched_skills: ApiGapSkill[];
  partial_skills: ApiGapSkill[];
  missing_skills: ApiGapSkill[];
  /** Fraction between 0 and 1. */
  overall_match: number;
  created_at: string;
}

export interface ApiGapAnalysisHistory {
  analyses: ApiGapAnalysis[];
  total: number;
}

export interface GapAnalysisHistoryResponse {
  analyses: GapAnalysisResponse[];
  total: number;
}

export interface ApplicationResponse {
  id: string;
  user_id: string | null;
  job_id: string | null;
  job_title: string;
  company: string;
  status: "applied" | "interviewing" | "offered" | "rejected";
  notes: string | null;
  url: string | null;
  applied_at: string | null;
  interview_date: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApplicationStatsResponse {
  total: number;
  applied: number;
  interviewing: number;
  offered: number;
  rejected: number;
  response_rate: number;
  avg_response_days: number | null;
}

export interface SkillDemandItem {
  skill: string;
  demand_score: number;
  /** Posting-count change vs the previous period; null when there is no baseline. */
  change_percent: number | null;
  period: string;
  job_count: number;
}

export interface SalaryRange {
  role: string;
  location: string;
  min_salary: number;
  median_salary: number;
  max_salary: number;
  currency: string;
  experience_level: string | null;
}

export interface TopCompany {
  name: string;
  job_count: number;
  tech_stack: string[];
  location: string | null;
  logo_url: string | null;
}

export interface MarketPulseResponse {
  skill_demands: SkillDemandItem[];
  salary_ranges: SalaryRange[];
  top_companies: TopCompany[];
  generated_at: string;
}

export type SkillTrendDirection = "rising" | "stable" | "declining";

export interface SkillTrendItem {
  skill: string;
  direction: SkillTrendDirection;
  change_percent: number;
  period: string;
}

export interface SkillTrendResponse {
  trends: SkillTrendItem[];
  recommended_skills: string[];
  generated_at: string;
}

/* ─── Company ─── */

export interface CompanyProfileResponse {
  id: string;
  name: string;
  location: string | null;
  tech_stack: string[];
  team_size: string | null;
  industry: string | null;
  description?: string | null;
  culture_signals: string[] | null;
  funding_stage?: string | null;
  growth_indicator?: string | null;
  recent_job_count: number | null;
  logo_url: string | null;
}

export interface CompanyJob {
  id: string;
  title: string;
  location: string | null;
  posted_date: string | null;
  url: string | null;
}

export interface CompanyJobsResponse {
  company_id: string;
  company_name: string;
  jobs: CompanyJob[];
}

/** Saved companies are keyed by name; the API has no company id on them. */
export interface SavedCompanyResponse {
  id: string;
  company_name: string;
  notes?: string | null;
  saved_at: string;
}

/* ─── Salary Negotiator ─── */

export interface NegotiationScript {
  opening: string;
  justification_points: string[];
  handling_objections: string[];
  closing: string;
}

export interface SalaryRangeResponse {
  role: string;
  location: string;
  min_salary: number;
  max_salary: number;
  median_salary: number;
  confidence: number;
  currency: string;
  experience_level: string;
}

export interface NegotiationResponse {
  salary_range: SalaryRangeResponse;
  script: NegotiationScript;
  generated_at: string;
}

export interface BenefitsItem {
  item: string;
  typical: string;
  negotiable: boolean;
}

export interface BenefitsComparisonResponse {
  benefits: BenefitsItem[];
  generated_at: string;
}

/* ─── Career Path ─── */

/** A stage as returned by the API (no current flag). */
export interface ApiCareerStage {
  title: string;
  description: string;
  typical_years: number;
  required_skills: string[];
  recommended_actions: string[];
}

/** Response of POST /career-path/generate and GET /career-path/{id}. */
export interface ApiCareerPath {
  current_stage: string;
  stages: ApiCareerStage[];
  gap_analysis: string[];
  timeline_estimate: string;
  generated_at: string;
}

/** A stage as shown by the screen: the API stage plus whether it is the user's current one. */
export interface CareerStage extends ApiCareerStage {
  is_current: boolean;
}

export interface CareerPathResponse {
  current_stage: string;
  stages: CareerStage[];
  gap_analysis: string[];
  timeline_estimate: string | null;
  generated_at: string;
}

/** Item of GET /career-path (path_data is the JSON-encoded path). */
export interface SavedCareerPathResponse {
  id: string;
  target_role: string | null;
  path_data: string;
  created_at: string;
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
