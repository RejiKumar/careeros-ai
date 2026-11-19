import type {
  ApiGapAnalysis,
  ApiGapAnalysisHistory,
  GapAnalysisHistoryResponse,
  GapAnalysisResponse,
  LearningResource,
} from "./contract";

const KNOWN_RESOURCE_TYPES: readonly LearningResource["type"][] = [
  "course",
  "certification",
  "article",
  "tutorial",
];

function toResourceType(type: string): LearningResource["type"] {
  const match = KNOWN_RESOURCE_TYPES.find((known) => known === type);
  return match ?? "article";
}

/**
 * The API returns skills as objects (with per-skill learning resources) and the
 * overall match as a 0-1 fraction; the screen shows skill names, a percentage
 * and one flat list of resources.
 */
export function toGapAnalysis(raw: ApiGapAnalysis): GapAnalysisResponse {
  const seen = new Set<string>();
  const learningResources: LearningResource[] = [];
  for (const skill of [...raw.missing_skills, ...raw.partial_skills]) {
    for (const resource of skill.learning_resources ?? []) {
      const key = `${resource.title}|${resource.url ?? ""}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      learningResources.push({
        type: toResourceType(resource.type),
        title: resource.title,
        url: resource.url,
        provider: resource.provider,
      });
    }
  }
  return {
    id: raw.id,
    resume_id: raw.resume_id,
    job_description_id: raw.job_description_id,
    overall_match_percentage: Math.round(raw.overall_match * 100),
    matched_skills: raw.matched_skills.map((s) => s.skill),
    partial_skills: raw.partial_skills.map((s) => s.skill),
    missing_skills: raw.missing_skills.map((s) => s.skill),
    learning_resources: learningResources,
    created_at: raw.created_at,
  };
}

export function toGapAnalysisHistory(raw: ApiGapAnalysisHistory): GapAnalysisHistoryResponse {
  return { analyses: raw.analyses.map(toGapAnalysis), total: raw.total };
}
