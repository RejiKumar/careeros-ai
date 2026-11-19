import type { ApiGapAnalysis, ApiGapSkill } from "./contract";
import { toGapAnalysis, toGapAnalysisHistory } from "./gapAnalysis";

function skill(
  name: string,
  status: string,
  resources: ApiGapSkill["learning_resources"],
): ApiGapSkill {
  return {
    skill: name,
    status,
    resume_evidence: null,
    job_requirement: `Needs ${name}`,
    confidence: 0.8,
    learning_resources: resources,
  };
}

// Shape returned by POST /api/v1/skills-gap/analyze.
const apiAnalysis: ApiGapAnalysis = {
  id: "gap-1",
  user_id: "user-1",
  resume_id: "resume-1",
  job_description_id: "jd-1",
  matched_skills: [skill("Python", "matched", null)],
  partial_skills: [
    skill("Docker", "partial", [
      { title: "Docker deep dive", url: "https://example.com/d", type: "course", provider: "X" },
    ]),
  ],
  missing_skills: [
    skill("Kubernetes", "missing", [
      { title: "Docker deep dive", url: "https://example.com/d", type: "course", provider: "X" },
      { title: "K8s basics", url: null, type: "video", provider: null },
    ]),
  ],
  overall_match: 0.62,
  created_at: "2026-11-19T00:00:00Z",
};

describe("toGapAnalysis", () => {
  it("maps skill objects to names and the 0-1 fraction to a percentage", () => {
    const result = toGapAnalysis(apiAnalysis);

    expect(result.overall_match_percentage).toBe(62);
    expect(result.matched_skills).toEqual(["Python"]);
    expect(result.partial_skills).toEqual(["Docker"]);
    expect(result.missing_skills).toEqual(["Kubernetes"]);
  });

  it("flattens per-skill resources, dedupes them and defaults unknown types", () => {
    const result = toGapAnalysis(apiAnalysis);

    expect(result.learning_resources.map((r) => r.title)).toEqual([
      "Docker deep dive",
      "K8s basics",
    ]);
    expect(result.learning_resources[1]?.type).toBe("article");
  });

  it("handles a history response", () => {
    const history = toGapAnalysisHistory({ analyses: [apiAnalysis], total: 1 });

    expect(history.total).toBe(1);
    expect(history.analyses[0]?.overall_match_percentage).toBe(62);
  });
});
