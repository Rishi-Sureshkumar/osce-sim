import "server-only";

/** Placeholder until M2: no AI wording, the raw finding is shown. */
export async function wordFinding(
  _sessionId: string,
  _f: { maneuverLabel: string; regionLabel: string; findingText: string },
): Promise<string | null> {
  return null;
}
