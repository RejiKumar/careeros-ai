import type { ApiCareerPath } from "./contract";
import { toCareerPath } from "./careerPath";

function stage(title: string) {
  return {
    title,
    description: `${title} stage`,
    typical_years: 2,
    required_skills: ["Python"],
    recommended_actions: ["Ship something"],
  };
}

// Shape returned by POST /api/v1/career-path/generate.
const apiPath: ApiCareerPath = {
  current_stage: "Software Engineer",
  stages: [stage("Junior Developer"), stage("Software Engineer"), stage("Senior Engineer")],
  gap_analysis: ["System design"],
  timeline_estimate: "3-4 years",
  generated_at: "2026-11-19T00:00:00Z",
};

describe("toCareerPath", () => {
  it("flags the stage named by current_stage", () => {
    const path = toCareerPath(apiPath);

    expect(path.stages.map((s) => s.is_current)).toEqual([false, true, false]);
    expect(path.timeline_estimate).toBe("3-4 years");
  });

  it("matches a current stage by containment when the wording differs", () => {
    const path = toCareerPath({ ...apiPath, current_stage: "software engineer (mid-level)" });

    expect(path.stages[1]?.is_current).toBe(true);
  });

  it("flags nothing when no stage matches and treats an empty estimate as absent", () => {
    const path = toCareerPath({ ...apiPath, current_stage: "Astronaut", timeline_estimate: "" });

    expect(path.stages.some((s) => s.is_current)).toBe(false);
    expect(path.timeline_estimate).toBeNull();
  });
});
