export const GUEST_LOCKED_ROUTES: ReadonlySet<string> = new Set([
  "/job-match",
  "/tailor",
  "/skills-gap",
  "/market-pulse",
  "/company",
  "/salary",
  "/career-path",
  "/notifications",
  "/coach",
  "/roast",
  "/wrapped",
  "/interview",
]);

export function isGuestLockedRoute(route: string): boolean {
  return GUEST_LOCKED_ROUTES.has(route);
}