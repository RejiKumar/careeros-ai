import type {
  AchievementResponse,
  AssessmentResponse,
  CoachMessagePairResponse,
  CoachThreadDetailResponse,
  CoachThreadResponse,
  DashboardResponse,
  EntitlementResponse,
  FeedbackResponse,
  GuestMigrationResponse,
  InterviewAnswerResponse,
  InterviewSessionDetailResponse,
  InterviewSessionResponse,
  JobDescriptionMatchResponse,
  JobDescriptionResponse,
  MatchResponse,
  MissionCompleteResponse,
  MissionProgressResponse,
  MissionResponse,
  ResumeContent,
  ResumeDetailResponse,
  ResumeImportResponse,
  ResumeResponse,
  ResumeVersionResponse,
  RewriteAcceptedResponse,
  RewriteBatchResponse,
  RoastResponse,
  UserResponse,
  WrappedResponse,
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

  createRewriteBatch(accessToken: string, resumeId: string): Promise<RewriteBatchResponse> {
    return this.request<RewriteBatchResponse>(
      `/api/v1/resumes/${resumeId}/rewrites`,
      accessToken,
      undefined,
      { method: "POST" },
    );
  }

  listRewriteBatches(accessToken: string, resumeId: string): Promise<RewriteBatchResponse[]> {
    return this.request<RewriteBatchResponse[]>(
      `/api/v1/resumes/${resumeId}/rewrites`,
      accessToken,
      undefined,
      { method: "GET" },
    );
  }

  acceptRewriteBatch(
    accessToken: string,
    resumeId: string,
    rewriteId: string,
    acceptedData: ResumeContent,
  ): Promise<RewriteAcceptedResponse> {
    return this.jsonRequest<RewriteAcceptedResponse>(
      `/api/v1/resumes/${resumeId}/rewrites/${rewriteId}/accept`,
      accessToken,
      undefined,
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

  /* ─── Achievements ─── */

  getAchievements(accessToken: string): Promise<AchievementResponse[]> {
    return this.request<AchievementResponse[]>("/api/v1/achievements", accessToken, undefined, {
      method: "GET",
    });
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
}
