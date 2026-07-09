// SPEC-006 C4 / RFC-030 SD-1 / EVID-078 F1:
// The ONLY payload that reaches the empty state is the zero-key {} envelope
// (the endpoint's ENOENT degradation). Every non-empty payload — including
// one with a wrong or missing schema tag — flows through validateMapDocument
// so the schema-tag rule fires as a structured error, never as "no map yet".
export function isEmptyMapResponse(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Object.keys(data as object).length === 0
  );
}
