import { describe, expect, it } from "vitest";
import {
  eventsToDomain,
  eventsToTicks,
  snapToNearestEvent,
  stepEvent,
  timestampToX,
  xToTimestamp,
  type TimelineEvent,
} from "./event-axis";

const sampleEvents: TimelineEvent[] = [
  { at: "2026-01-15T10:00:00.000Z", kind: "created", artifactId: "PRD-001" },
  { at: "2026-02-01T12:00:00.000Z", kind: "activated", artifactId: "PRD-001" },
  { at: "2026-03-10T08:30:00.000Z", kind: "scored", artifactId: "PRD-002" },
  { at: "2026-04-05T14:00:00.000Z", kind: "superseded", artifactId: "PRD-001" },
];

describe("eventsToDomain", () => {
  it("returns null for empty events", () => {
    expect(eventsToDomain([])).toBeNull();
  });

  it("computes min/max ms across events", () => {
    const d = eventsToDomain(sampleEvents);
    expect(d).not.toBeNull();
    expect(d!.startMs).toBe(Date.parse("2026-01-15T10:00:00.000Z"));
    expect(d!.endMs).toBe(Date.parse("2026-04-05T14:00:00.000Z"));
  });

  it("pads single-event domain by ±1h", () => {
    const d = eventsToDomain([sampleEvents[0]!]);
    expect(d).not.toBeNull();
    expect(d!.endMs - d!.startMs).toBe(7_200_000);
  });

  it("ignores invalid timestamps without crashing", () => {
    const d = eventsToDomain([
      { at: "not-a-date", kind: "created", artifactId: "X" },
      sampleEvents[0]!,
    ]);
    expect(d).not.toBeNull();
    expect(d!.startMs).toBe(Date.parse(sampleEvents[0]!.at) - 3_600_000);
  });
});

describe("timestampToX / xToTimestamp", () => {
  const domain = eventsToDomain(sampleEvents)!;

  it("maps domain start to x=0", () => {
    expect(timestampToX(domain.startMs, domain, 1000)).toBe(0);
  });

  it("maps domain end to x=widthPx", () => {
    expect(timestampToX(domain.endMs, domain, 1000)).toBe(1000);
  });

  it("clamps out-of-range timestamps", () => {
    expect(timestampToX(domain.startMs - 1_000_000, domain, 1000)).toBe(0);
    expect(timestampToX(domain.endMs + 1_000_000, domain, 1000)).toBe(1000);
  });

  it("returns 0 for non-positive widthPx", () => {
    expect(timestampToX(domain.startMs, domain, 0)).toBe(0);
    expect(timestampToX(domain.startMs, domain, -10)).toBe(0);
  });

  it("xToTimestamp inverts timestampToX", () => {
    const targetMs = Date.parse("2026-02-15T00:00:00.000Z");
    const x = timestampToX(targetMs, domain, 800);
    const back = xToTimestamp(x, domain, 800);
    expect(Math.abs(back - targetMs)).toBeLessThan(1000);
  });

  it("xToTimestamp clamps x to [0, widthPx]", () => {
    expect(xToTimestamp(-50, domain, 1000)).toBe(domain.startMs);
    expect(xToTimestamp(2000, domain, 1000)).toBe(domain.endMs);
  });
});

describe("eventsToTicks", () => {
  it("produces one tick per valid event", () => {
    const domain = eventsToDomain(sampleEvents)!;
    const ticks = eventsToTicks(sampleEvents, domain, 1000);
    expect(ticks).toHaveLength(4);
    expect(ticks[0]!.x).toBe(0);
    expect(ticks[3]!.x).toBe(1000);
  });

  it("filters invalid timestamps", () => {
    const domain = eventsToDomain(sampleEvents)!;
    const withInvalid: TimelineEvent[] = [
      ...sampleEvents,
      { at: "garbage", kind: "created", artifactId: "BAD" },
    ];
    const ticks = eventsToTicks(withInvalid, domain, 500);
    expect(ticks).toHaveLength(4);
  });
});

describe("snapToNearestEvent", () => {
  const domain = eventsToDomain(sampleEvents)!;

  it("returns null for empty events", () => {
    expect(snapToNearestEvent(100, [], domain, 1000)).toBeNull();
  });

  it("snaps to nearest event by pixel distance", () => {
    const snapped = snapToNearestEvent(0, sampleEvents, domain, 1000);
    expect(snapped?.artifactId).toBe("PRD-001");
    expect(snapped?.kind).toBe("created");
  });

  it("snaps to last event at far right", () => {
    const snapped = snapToNearestEvent(1000, sampleEvents, domain, 1000);
    expect(snapped?.kind).toBe("superseded");
  });
});

describe("stepEvent", () => {
  it("starts at first event when current is null and direction is next", () => {
    const e = stepEvent(null, sampleEvents, "next");
    expect(e?.artifactId).toBe("PRD-001");
    expect(e?.kind).toBe("created");
  });

  it("starts at last event when current is null and direction is prev", () => {
    const e = stepEvent(null, sampleEvents, "prev");
    expect(e?.kind).toBe("superseded");
  });

  it("advances to the next strictly later event", () => {
    const e = stepEvent("2026-01-15T10:00:00.000Z", sampleEvents, "next");
    expect(e?.at).toBe("2026-02-01T12:00:00.000Z");
  });

  it("steps back to the previous strictly earlier event", () => {
    const e = stepEvent("2026-04-05T14:00:00.000Z", sampleEvents, "prev");
    expect(e?.at).toBe("2026-03-10T08:30:00.000Z");
  });

  it("returns the last event when stepping past the end", () => {
    const e = stepEvent("2026-04-05T14:00:00.000Z", sampleEvents, "next");
    expect(e?.kind).toBe("superseded");
  });

  it("returns the first event when stepping before the start", () => {
    const e = stepEvent("2026-01-15T10:00:00.000Z", sampleEvents, "prev");
    expect(e?.kind).toBe("created");
  });
});
