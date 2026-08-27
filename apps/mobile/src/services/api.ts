import type {
  AchievementResponse,
  AssessmentResponse,
  BenefitsComparisonResponse,
  CoachMessagePairResponse,
  CoachThreadDetailResponse,
  CoachThreadResponse,
  CompanyJobsResponse,
  CompanyProfileResponse,
  CareerPathResponse,
  DashboardResponse,
  EntitlementResponse,
  FCMTokenResponse,
  FeedbackResponse,
  GapAnalysisResponse,
  GuestMigrationResponse,
  InterviewAnswerResponse,
  InterviewSessionDetailResponse,
  InterviewSessionResponse,
  JobDescriptionMatchResponse,
  MarketPulseResponse,
  SkillTrendResponse,
  JobDescriptionResponse,
  JobSearchResponse,
  MatchResponse,
  MissionCompleteResponse,
  MissionProgressResponse,
  MissionResponse,
  NegotiationResponse,
  NotificationLogResponse,
  NotificationPreferenceResponse,
  ResumeContent,
  ResumeDetailResponse,
  ResumeImportResponse,
  ResumeResponse,
  ResumeVersionResponse,
  RewriteAcceptedResponse,
  RewriteBatchResponse,
  RoastResponse,
  SavedCareerPathResponse,
  SavedCompanyResponse,
  SavedJobResponse,
  TailorAcceptResponse,
  TailorHistoryItem,
  TailorResponse,
  UserResponse,
  WrappedResponse,
  ApplicationResponse,
  ApplicationStatsResponse,
} from "./contract";
import { ApiError } from "./contract";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string } | null;
  detail?: string;
}

function parseErrorEnvelope(status: number, text: string): ApiError {
  let envelope: ApiErrorEnvelope | null = null;
  try {
    envelope = JSON.parse(text) as ApiErrorEnvelope;
  } catch {
    // Not JSON — fall back to the status-based message.
  }
  const message = envelope?.error?.message ?? envelope?.detail ?? `Request failed (${status}).`;
  return new ApiError(status, message, envelope?.error?.code ?? null);
}

function buildAuthHeaders(
  accessToken: string | undefined,
  guestId: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken !== undefined && accessToken !== null && accessToken !== "") {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (guestId !== undefined && guestId !== null && guestId !== "") {
    headers["X-Guest-Id"] = guestId;
  }
  return headers;
}

/**
 * Registered by the AuthProvider so the ApiClient can transparently refresh
 * an expired access token and retry the failed request once.
 * Returns the new access token, or null when the refresh failed.
 */
type TokenRefresher = () => Promise<string | null>;

let tokenRefresher: TokenRefresher | null = null;

export function setTokenRefresher(refresher: TokenRefresher | null): void {
  tokenRefresher = refresher;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL ?? "") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    accessToken: string | undefined,
    guestId: string | undefined,
    init: RequestInit,
    allowRefresh = true,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...buildAuthHeaders(accessToken, guestId),
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 401 && allowRefresh && tokenRefresher !== null) {
      const refreshedToken = await tokenRefresher();
      if (refreshedToken !== null) {
        return this.request<T>(path, refreshedToken, guestId, init, false);
      }
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const envelope = body as ApiErrorEnvelope;
      const message =
        envelope?.error?.message ?? envelope?.detail ?? `Request failed (${response.status}).`;
      throw new ApiError(response.status, message, envelope?.error?.code ?? null);
    }

    return body as T;
  }

  private async jsonRequest<T>(
    path: string,
    accessToken: string | undefined,
    guestId: string | undefined,
    method: string,
    payload?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (payload === undefined) {
      return this.request<T>(path, accessToken, guestId, { method, headers });
    }
    headers.Accept = "application/json";
    return this.request<T>(path, accessToken, guestId, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
  }

  /* ─── Auth ─── */

  getMe(accessToken: string): Promise<UserResponse> {
    return this.request<UserResponse>("/api/v1/auth/me", accessToken, undefined, { method: "GET" });
  }

  deleteAccount(accessToken: string): Promise<void> {
    return this.request<void>("/api/v1/auth/me", accessToken, undefined, { method: "DELETE" });
  }

  migrateGuest(accessToken: string, guestId: string): Promise<GuestMigrationResponse> {
    return this.jsonRequest<GuestMigrationResponse>(
      "/api/v1/auth/migrate-guest",
      accessToken,
      guestId,
      "POST",
      { guest_id: guestId },
    );
  }

  /* ─── Dashboard ─── */

  getDashboard(accessToken: string | undefined, guestId?: string): Promise<DashboardResponse> {
    return this.request<DashboardResponse>("/api/v1/dashboard", accessToken, guestId, {
      method: "GET",
    });
  }

  /* ─── Entitlements ─── */

  getEntitlements(accessToken: string): Promise<EntitlementResponse> {
    return this.request<EntitlementResponse>(
      "/api/v1/billing/entitlements",
      accessToken,
      undefined,
      {
        method: "GET",
      },
    );
  }

  /* ─── Resumes ─── */

  listResumes(accessToken: string | undefined, guestId?: string): Promise<ResumeResponse[]> {
    return this.request<ResumeResponse[]>("/api/v1/resumes", accessToken, guestId, {
      method: "GET",
    });
  }

  getResume(
    accessToken: string | undefined,
    resumeId: string,
    guestId?: string,
  ): Promise<ResumeDetailResponse> {
    return this.request<ResumeDetailResponse>(`/api/v1/resumes/${resumeId}`, accessToken, guestId, {
      method: "GET",
    });
  }

  listResumeVersions(accessToken: string, resumeId: string): Promise<ResumeVersionResponse[]> {
    return this.request<ResumeVersionResponse[]>(
      `/api/v1/resumes/${resumeId}/versions`,
      accessToken,
      undefined,
      { method: "GET" },
    );
  }

  updateResume(
    accessToken: string,
    resumeId: string,
    payload: { title?: string; structured_data?: ResumeContent },
  ): Promise<ResumeDetailResponse> {
    return this.jsonRequest<ResumeDetailResponse>(
      `/api/v1/resumes/${resumeId}`,
      accessToken,
      undefined,
      "PATCH",
      payload,
    );
  }

  importResume(
    accessToken: string | undefined,
    file: { uri: string; name: string; type: string },
    guestId?: string,
  ): Promise<ResumeImportResponse> {
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);

    return new Promise<ResumeImportResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/api/v1/resumes/import`);
      const authHeaders = buildAuthHeaders(accessToken, guestId);
      for (const [key, value] of Object.entries(authHeaders)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.setRequestHeader("Accept", "application/json");
      xhr.responseType = "text";
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as ResumeImportResponse);
          } catch {
            reject(new ApiError(xhr.status, "Invalid response from server.", null));
          }
          return;
        }
        reject(parseErrorEnvelope(xhr.status, xhr.responseText));
      };
      xhr.onerror = () => reject(new ApiError(0, "Network request failed.", null));
      xhr.onabort = () => reject(new ApiError(0, "Request aborted.", null));
      xhr.ontimeout = () => reject(new ApiError(0, "Request timed out.", null));
      xhr.send(form);
    });
  }

  createAssessment(
    accessToken: string | undefined,
    resumeId: string,
    guestId?: string,
  ): Promise<AssessmentResponse> {
    return this.request<AssessmentResponse>(
      `/api/v1/resumes/${resumeId}/assessments`,
      accessToken,
      guestId,
      { method: "POST" },
    );
  }

  /* ─── Job Match ─── */

  createJobDescription(
    accessToken: string | undefined,
    payload: {
      title?: string;
      company?: string;
      raw_text: string;
      resume_id: string;
      resume_version_id?: string;
    },
    guestId?: string,
  ): Promise<JobDescriptionMatchResponse> {
    return this.jsonRequest<JobDescriptionMatchResponse>(
      "/api/v1/job-descriptions",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  listJobDescriptions(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<JobDescriptionResponse[]> {
    return this.request<JobDescriptionResponse[]>(
      "/api/v1/job-descriptions",
      accessToken,
      guestId,
      {
        method: "GET",
      },
    );
  }

  listMatches(
    accessToken: string | undefined,
    jobDescriptionId: string,
    guestId?: string,
  ): Promise<MatchResponse[]> {
    return this.request<MatchResponse[]>(
      `/api/v1/job-descriptions/${jobDescriptionId}/matches`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  runMatch(
    accessToken: string | undefined,
    jobDescriptionId: string,
    payload: { resume_id: string; resume_version_id?: string },
    guestId?: string,
  ): Promise<MatchResponse> {
    return this.jsonRequest<MatchResponse>(
      `/api/v1/job-descriptions/${jobDescriptionId}/matches`,
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  deleteJobDescription(accessToken: string, jobDescriptionId: string): Promise<void> {
    return this.request<void>(
      `/api/v1/job-descriptions/${jobDescriptionId}`,
      accessToken,
      undefined,
      {
        method: "DELETE",
      },
    );
  }

  /* ─── Coach ─── */

  createCoachThread(
    accessToken: string | undefined,
    payload: { title?: string; resume_id?: string; job_description_id?: string },
    guestId?: string,
  ): Promise<CoachThreadResponse> {
    return this.jsonRequest<CoachThreadResponse>(
      "/api/v1/coach/threads",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  listCoachThreads(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<CoachThreadResponse[]> {
    return this.request<CoachThreadResponse[]>("/api/v1/coach/threads", accessToken, guestId, {
      method: "GET",
    });
  }

  getCoachThread(
    accessToken: string | undefined,
    threadId: string,
    guestId?: string,
  ): Promise<CoachThreadDetailResponse> {
    return this.request<CoachThreadDetailResponse>(
      `/api/v1/coach/threads/${threadId}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  sendCoachMessage(
    accessToken: string | undefined,
    threadId: string,
    content: string,
    guestId?: string,
  ): Promise<CoachMessagePairResponse> {
    return this.jsonRequest<CoachMessagePairResponse>(
      `/api/v1/coach/threads/${threadId}/messages`,
      accessToken,
      guestId,
      "POST",
      { content },
    );
  }

  deleteCoachThread(accessToken: string, threadId: string): Promise<void> {
    return this.request<void>(`/api/v1/coach/threads/${threadId}`, accessToken, undefined, {
      method: "DELETE",
    });
  }

  /* ─── Rewrites ─── */

  createRewriteBatch(
    accessToken: string | undefined,
    resumeId: string,
    guestId?: string,
  ): Promise<RewriteBatchResponse> {
    return this.request<RewriteBatchResponse>(
      `/api/v1/resumes/${resumeId}/rewrites`,
      accessToken,
      guestId,
      { method: "POST" },
    );
  }

  listRewriteBatches(
    accessToken: string | undefined,
    resumeId: string,
    guestId?: string,
  ): Promise<RewriteBatchResponse[]> {
    return this.request<RewriteBatchResponse[]>(
      `/api/v1/resumes/${resumeId}/rewrites`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  acceptRewriteBatch(
    accessToken: string | undefined,
    resumeId: string,
    rewriteId: string,
    acceptedData: ResumeContent,
    guestId?: string,
  ): Promise<RewriteAcceptedResponse> {
    return this.jsonRequest<RewriteAcceptedResponse>(
      `/api/v1/resumes/${resumeId}/rewrites/${rewriteId}/accept`,
      accessToken,
      guestId,
      "POST",
      { accepted_data: acceptedData },
    );
  }

  /* ─── Missions ─── */

  listMissions(accessToken: string | undefined, guestId?: string): Promise<MissionResponse[]> {
    return this.request<MissionResponse[]>("/api/v1/missions", accessToken, guestId, {
      method: "GET",
    });
  }

  getMissionProgress(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<MissionProgressResponse> {
    return this.request<MissionProgressResponse>(
      "/api/v1/missions/progress",
      accessToken,
      guestId,
      {
        method: "GET",
      },
    );
  }

  completeMission(
    accessToken: string | undefined,
    missionKey: string,
    guestId?: string,
  ): Promise<MissionCompleteResponse> {
    return this.request<MissionCompleteResponse>(
      `/api/v1/missions/${missionKey}/complete`,
      accessToken,
      guestId,
      { method: "POST" },
    );
  }

  /* ─── Roast ─── */

  createRoast(
    accessToken: string | undefined,
    payload: { resume_id: string; mode: string },
    guestId?: string,
  ): Promise<RoastResponse> {
    return this.jsonRequest<RoastResponse>("/api/v1/roasts", accessToken, guestId, "POST", payload);
  }

  /* ─── Wrapped ─── */

  getWrapped(accessToken: string | undefined, guestId?: string): Promise<WrappedResponse> {
    return this.request<WrappedResponse>("/api/v1/wrapped", accessToken, guestId, {
      method: "GET",
    });
  }

  /* ─── Interviews ─── */

  createInterviewSession(
    accessToken: string | undefined,
    payload: { mode: string; resume_id?: string; target_job?: string; target_skills?: string[] },
    guestId?: string,
  ): Promise<InterviewSessionDetailResponse> {
    return this.jsonRequest<InterviewSessionDetailResponse>(
      "/api/v1/interviews/sessions",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  getInterviewSession(
    accessToken: string | undefined,
    sessionId: string,
    guestId?: string,
  ): Promise<InterviewSessionDetailResponse> {
    return this.request<InterviewSessionDetailResponse>(
      `/api/v1/interviews/sessions/${sessionId}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  listInterviewSessions(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<InterviewSessionResponse[]> {
    return this.request<InterviewSessionResponse[]>(
      "/api/v1/interviews/sessions",
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  submitInterviewAnswer(
    accessToken: string | undefined,
    sessionId: string,
    questionId: string,
    content: string,
    guestId?: string,
  ): Promise<InterviewAnswerResponse> {
    return this.jsonRequest<InterviewAnswerResponse>(
      `/api/v1/interviews/sessions/${sessionId}/answers`,
      accessToken,
      guestId,
      "POST",
      { question_id: questionId, content },
    );
  }

  /* ─── Skills Gap ─── */

  analyzeSkillsGap(
    accessToken: string | undefined,
    payload: {
      resume_id: string;
      job_description_id: string;
      resume_version_id?: string;
    },
    guestId?: string,
  ): Promise<GapAnalysisResponse> {
    return this.jsonRequest<GapAnalysisResponse>(
      "/api/v1/skills-gap/analyze",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  getGapAnalysis(
    accessToken: string | undefined,
    analysisId: string,
    guestId?: string,
  ): Promise<GapAnalysisResponse> {
    return this.request<GapAnalysisResponse>(
      `/api/v1/skills-gap/${analysisId}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  listGapAnalyses(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<GapAnalysisResponse[]> {
    return this.request<GapAnalysisResponse[]>("/api/v1/skills-gap", accessToken, guestId, {
      method: "GET",
    });
  }

  deleteGapAnalysis(
    accessToken: string | undefined,
    analysisId: string,
    guestId?: string,
  ): Promise<void> {
    return this.request<void>(`/api/v1/skills-gap/${analysisId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }

  /* ─── Achievements ─── */

  getAchievements(accessToken: string): Promise<AchievementResponse[]> {
    return this.request<AchievementResponse[]>("/api/v1/achievements", accessToken, undefined, {
      method: "GET",
    });
  }

  /* ─── Job Search ─── */

  searchJobs(
    accessToken: string | undefined,
    query: string,
    location?: string,
    source?: string,
    page?: number,
    limit?: number,
    guestId?: string,
  ): Promise<JobSearchResponse> {
    const params = new URLSearchParams();
    params.set("query", query);
    if (location !== undefined && location !== "") {
      params.set("location", location);
    }
    if (source !== undefined && source !== "") {
      params.set("source", source);
    }
    if (page !== undefined) {
      params.set("page", String(page));
    }
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    return this.request<JobSearchResponse>(
      `/api/v1/job-search/search?${params.toString()}`,
      accessToken,
      guestId,
      { method: "POST" },
    );
  }

  saveJob(
    accessToken: string | undefined,
    payload: {
      job_id: string;
      title: string;
      company?: string | null;
      location?: string | null;
      source: string;
      url?: string | null;
    },
    guestId?: string,
  ): Promise<SavedJobResponse> {
    return this.jsonRequest<SavedJobResponse>(
      "/api/v1/job-search/saved",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  listSavedJobs(accessToken: string | undefined, guestId?: string): Promise<SavedJobResponse[]> {
    return this.request<SavedJobResponse[]>("/api/v1/job-search/saved", accessToken, guestId, {
      method: "GET",
    });
  }

  deleteSavedJob(accessToken: string | undefined, jobId: string, guestId?: string): Promise<void> {
    return this.request<void>(`/api/v1/job-search/saved/${jobId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }

  /* ─── Market Pulse ─── */

  getMarketPulse(
    accessToken: string | undefined,
    location?: string,
    role?: string,
    guestId?: string,
  ): Promise<MarketPulseResponse> {
    const params = new URLSearchParams();
    if (location !== undefined && location !== "") {
      params.set("location", location);
    }
    if (role !== undefined && role !== "") {
      params.set("role", role);
    }
    const query = params.toString();
    return this.request<MarketPulseResponse>(
      `/api/v1/market-pulse${query !== "" ? `?${query}` : ""}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  getSkillTrends(
    accessToken: string | undefined,
    period?: string,
    location?: string,
    guestId?: string,
  ): Promise<SkillTrendResponse> {
    const params = new URLSearchParams();
    if (period !== undefined && period !== "") {
      params.set("period", period);
    }
    if (location !== undefined && location !== "") {
      params.set("location", location);
    }
    const query = params.toString();
    return this.request<SkillTrendResponse>(
      `/api/v1/market-pulse/trends${query !== "" ? `?${query}` : ""}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  /* ─── Feedback ─── */

  submitFeedback(
    accessToken: string | undefined,
    payload: {
      output_type: string;
      output_id: string;
      rating: string;
      reason?: string | null;
      reason_detail?: string | null;
    },
    guestId?: string,
  ): Promise<FeedbackResponse> {
    return this.jsonRequest<FeedbackResponse>(
      "/api/v1/feedback",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  /* ─── Notifications ─── */

  registerFCMToken(
    accessToken: string | undefined,
    token: string,
    platform: string,
    guestId?: string,
  ): Promise<FCMTokenResponse> {
    return this.jsonRequest<FCMTokenResponse>(
      "/api/v1/notifications/fcm-token",
      accessToken,
      guestId,
      "POST",
      { token, platform },
    );
  }

  removeFCMToken(accessToken: string | undefined, token: string, guestId?: string): Promise<void> {
    return this.request<void>(
      `/api/v1/notifications/fcm-token?token=${encodeURIComponent(token)}`,
      accessToken,
      guestId,
      { method: "DELETE" },
    );
  }

  updateNotificationPreferences(
    accessToken: string | undefined,
    prefs: {
      job_alerts?: boolean;
      mission_reminders?: boolean;
      career_tips?: boolean;
      frequency?: string;
    },
    guestId?: string,
  ): Promise<NotificationPreferenceResponse> {
    return this.jsonRequest<NotificationPreferenceResponse>(
      "/api/v1/notifications/preferences",
      accessToken,
      guestId,
      "PUT",
      prefs,
    );
  }

  getNotificationPreferences(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<NotificationPreferenceResponse> {
    return this.request<NotificationPreferenceResponse>(
      "/api/v1/notifications/preferences",
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  listNotifications(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<NotificationLogResponse[]> {
    return this.request<NotificationLogResponse[]>("/api/v1/notifications", accessToken, guestId, {
      method: "GET",
    });
  }

  markNotificationRead(
    accessToken: string | undefined,
    notificationId: string,
    guestId?: string,
  ): Promise<void> {
    return this.request<void>(
      `/api/v1/notifications/${notificationId}/read`,
      accessToken,
      guestId,
      { method: "PATCH" },
    );
  }

  /* ─── Resume Tailor ─── */

  tailorResume(
    accessToken: string | undefined,
    payload: { resume_id: string; job_description_id: string; resume_version_id?: string },
    guestId?: string,
  ): Promise<TailorResponse> {
    return this.jsonRequest<TailorResponse>(
      "/api/v1/resume-tailor/tailor",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  acceptTailor(
    accessToken: string | undefined,
    payload: { tailor_id: string },
    guestId?: string,
  ): Promise<TailorAcceptResponse> {
    return this.jsonRequest<TailorAcceptResponse>(
      "/api/v1/resume-tailor/accept",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  getTailorHistory(
    accessToken: string | undefined,
    resumeId: string,
    guestId?: string,
  ): Promise<TailorHistoryItem[]> {
    return this.request<TailorHistoryItem[]>(
      `/api/v1/resume-tailor/history/${resumeId}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  deleteTailor(accessToken: string | undefined, tailorId: string, guestId?: string): Promise<void> {
    return this.request<void>(`/api/v1/resume-tailor/${tailorId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }

  /* ─── Company ─── */

  searchCompanies(
    accessToken: string | undefined,
    query: string,
    location?: string,
    guestId?: string,
  ): Promise<CompanyProfileResponse[]> {
    const params = new URLSearchParams();
    params.set("query", query);
    if (location !== undefined && location !== "") {
      params.set("location", location);
    }
    return this.request<CompanyProfileResponse[]>(
      `/api/v1/companies/search?${params.toString()}`,
      accessToken,
      guestId,
      { method: "POST" },
    );
  }

  getCompany(
    accessToken: string | undefined,
    companyId: string,
    guestId?: string,
  ): Promise<CompanyProfileResponse> {
    return this.request<CompanyProfileResponse>(
      `/api/v1/companies/${companyId}`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  getCompanyJobs(
    accessToken: string | undefined,
    companyId: string,
    guestId?: string,
  ): Promise<CompanyJobsResponse> {
    return this.request<CompanyJobsResponse>(
      `/api/v1/companies/${companyId}/jobs`,
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  saveCompany(
    accessToken: string | undefined,
    payload: { company_id: string; company_name: string },
    guestId?: string,
  ): Promise<SavedCompanyResponse> {
    return this.jsonRequest<SavedCompanyResponse>(
      "/api/v1/companies/saved",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  listSavedCompanies(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<SavedCompanyResponse[]> {
    return this.request<SavedCompanyResponse[]>("/api/v1/companies/saved", accessToken, guestId, {
      method: "GET",
    });
  }

  deleteSavedCompany(
    accessToken: string | undefined,
    savedId: string,
    guestId?: string,
  ): Promise<void> {
    return this.request<void>(`/api/v1/companies/saved/${savedId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }

  /* ─── Salary Negotiator ─── */

  getSalaryRange(
    accessToken: string | undefined,
    payload: {
      role: string;
      location: string;
      experience_years: number;
      skills: string[];
      company?: string;
    },
    guestId?: string,
  ): Promise<NegotiationResponse> {
    return this.jsonRequest<NegotiationResponse>(
      "/api/v1/salary-negotiator/range",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  getBenefitsComparison(
    accessToken: string | undefined,
    payload: {
      role: string;
      location: string;
      experience_years: number;
      skills: string[];
      company?: string;
    },
    guestId?: string,
  ): Promise<BenefitsComparisonResponse> {
    return this.jsonRequest<BenefitsComparisonResponse>(
      "/api/v1/salary-negotiator/benefits",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  /* ─── Career Path ─── */

  generateCareerPath(
    accessToken: string | undefined,
    payload: { resume_id: string; target_role?: string },
    guestId?: string,
  ): Promise<CareerPathResponse> {
    return this.jsonRequest<CareerPathResponse>(
      "/api/v1/career-path/generate",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  getCareerPath(
    accessToken: string | undefined,
    pathId: string,
    guestId?: string,
  ): Promise<CareerPathResponse> {
    return this.request<CareerPathResponse>(`/api/v1/career-path/${pathId}`, accessToken, guestId, {
      method: "GET",
    });
  }

  listCareerPaths(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<SavedCareerPathResponse[]> {
    return this.request<SavedCareerPathResponse[]>("/api/v1/career-path", accessToken, guestId, {
      method: "GET",
    });
  }

  deleteCareerPath(
    accessToken: string | undefined,
    pathId: string,
    guestId?: string,
  ): Promise<void> {
    return this.request<void>(`/api/v1/career-path/${pathId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }

  /* ─── Applications ─── */

  createApplication(
    accessToken: string | undefined,
    payload: {
      job_title: string;
      company?: string | null;
      status?: string;
      notes?: string | null;
      follow_up_date?: string | null;
      interview_date?: string | null;
    },
    guestId?: string,
  ): Promise<ApplicationResponse> {
    return this.jsonRequest<ApplicationResponse>(
      "/api/v1/applications",
      accessToken,
      guestId,
      "POST",
      payload,
    );
  }

  listApplications(
    accessToken: string | undefined,
    statusFilter?: string,
    guestId?: string,
  ): Promise<ApplicationResponse[]> {
    const params = new URLSearchParams();
    if (statusFilter !== undefined && statusFilter !== "") {
      params.set("status", statusFilter);
    }
    const query = params.toString();
    const path = `/api/v1/applications${query !== "" ? `?${query}` : ""}`;
    return this.request<ApplicationResponse[]>(path, accessToken, guestId, {
      method: "GET",
    });
  }

  getApplicationStats(
    accessToken: string | undefined,
    guestId?: string,
  ): Promise<ApplicationStatsResponse> {
    return this.request<ApplicationStatsResponse>(
      "/api/v1/applications/stats",
      accessToken,
      guestId,
      { method: "GET" },
    );
  }

  updateApplication(
    accessToken: string | undefined,
    applicationId: string,
    payload: {
      job_title?: string;
      company?: string | null;
      status?: string;
      notes?: string | null;
      follow_up_date?: string | null;
      interview_date?: string | null;
    },
    guestId?: string,
  ): Promise<ApplicationResponse> {
    return this.jsonRequest<ApplicationResponse>(
      `/api/v1/applications/${applicationId}`,
      accessToken,
      guestId,
      "PATCH",
      payload,
    );
  }

  deleteApplication(
    accessToken: string | undefined,
    applicationId: string,
    guestId?: string,
  ): Promise<void> {
    return this.request<void>(`/api/v1/applications/${applicationId}`, accessToken, guestId, {
      method: "DELETE",
    });
  }
}
