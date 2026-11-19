import type { ApiCareerPath, CareerPathResponse } from "./contract";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The API names the user's current stage in `current_stage` rather than flagging
 * a stage. Mark the stage whose title matches (exactly, then by containment).
 */
export function toCareerPath(raw: ApiCareerPath): CareerPathResponse {
  const current = normalize(raw.current_stage);
  let currentIndex = raw.stages.findIndex((stage) => normalize(stage.title) === current);
  if (currentIndex === -1 && current !== "") {
    currentIndex = raw.stages.findIndex((stage) => {
      const title = normalize(stage.title);
      return title.includes(current) || current.includes(title);
    });
  }
  return {
    current_stage: raw.current_stage,
    stages: raw.stages.map((stage, index) => ({ ...stage, is_current: index === currentIndex })),
    gap_analysis: raw.gap_analysis,
    timeline_estimate: raw.timeline_estimate === "" ? null : raw.timeline_estimate,
    generated_at: raw.generated_at,
  };
}
