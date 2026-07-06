// @vitest-environment happy-dom
/**
 * onboard-agent phase 1 (AI-only) render-proof for MapChat.svelte. Harness:
 * happy-dom + Svelte's built-in mount() — same pattern as
 * OnboardTour.render.test.ts / nav-contract.render.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import MapChat from "./MapChat.svelte";
import { checkDaemon, resetChat } from "../model/chat-store.svelte";
import {
  clearCameraTarget,
  currentCameraRequest,
} from "@/widgets/composed-map/model/camera-bus.svelte";
import type { MapDocument, MapZone } from "@/entities/map";
import {
  probeDaemon,
  connectAgent,
  type AgentHandlers,
} from "../model/agent-client";

// agent-client is mocked so the offline assertions below stay deterministic
// (no real socket, no real daemon on the test host) and so Tier-1
// rendering can be driven explicitly per test.
vi.mock("../model/agent-client", () => ({
  probeDaemon: vi.fn(),
  connectAgent: vi.fn(),
}));

let host: HTMLElement | null = null;
let instance: unknown = null;

function zone(overrides: Partial<MapZone> = {}): MapZone {
  return {
    id: "z.a",
    label: "Zone A",
    kind: "surface",
    accent: "--map-accent-cyan",
    treatment: "neutral-dashed",
    rule_edge: "off",
    layout_rule: "grid",
    cols: 2,
    ...overrides,
  };
}

function fixtureDoc(): MapDocument {
  return {
    schema: "forgeplan.map/v1",
    meta: {
      map_id: "test",
      status: "confirmed",
      project_type: "generic",
      composition_id: "c1",
      source_fingerprint: "fp",
      version: 1,
    },
    canvas: {
      grid: { cols: 1, rows: 1 },
      gap: { x: 88, y: 70 },
      margin: 40,
      cell: {
        card_w: 190,
        card_h: 60,
        card_gap: 36,
        zpad: { top: 50, side: 24, bottom: 24 },
      },
    },
    composition: {
      template: "generic",
      arrangement: "stack-ttb",
      entry_zone: "z.a",
      placements: [{ zone: "z.a", cell: { row: 0, col: 0 } }],
      zone_connectors: [],
    },
    zones: [zone({ id: "z.a", label: "CLI Surfaces" })],
    nodes: [],
    edges: [],
  };
}

function mountChat(props: {
  doc: MapDocument;
  onClose?: () => void;
}): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  instance = mount(MapChat, { target: host, props });
  flushSync();
  return host;
}

function getInput(root: HTMLElement): HTMLTextAreaElement {
  const input = root.querySelector<HTMLTextAreaElement>(
    '[aria-label="Ask the map a question"]',
  );
  expect(input).not.toBeNull();
  return input!;
}

function getSendButton(root: HTMLElement): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Send"),
  );
  expect(btn).toBeDefined();
  return btn as HTMLButtonElement;
}

function getNewChatButton(root: HTMLElement): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("New chat"),
  );
  expect(btn).toBeDefined();
  return btn as HTMLButtonElement;
}

function findStopButton(root: HTMLElement): HTMLButtonElement | null {
  return (
    (Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Stop"),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

function findSendButton(root: HTMLElement): HTMLButtonElement | null {
  return (
    (Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Send"),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

function typeInto(input: HTMLTextAreaElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  flushSync();
}

beforeEach(() => {
  resetChat();
  clearCameraTarget();
  vi.mocked(probeDaemon).mockReset().mockResolvedValue({ up: false });
  vi.mocked(connectAgent).mockReset();
});

afterEach(() => {
  if (instance) {
    unmount(instance as object);
    instance = null;
  }
  host?.remove();
  host = null;
  vi.restoreAllMocks();
});

// onboard-agent phase 1 — with no daemon detected (the default in
// beforeEach: probeDaemon resolves { up: false }), the chat is AI-only and
// has nothing to answer with, so the body shows an offline call-to-action
// instead of a message list + input. No sending, no fake answers.
describe("MapChat — offline (no daemon)", () => {
  it("shows the offline call-to-action instead of a message list and input", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("The live assistant isn't running.");
    expect(root.textContent).toContain("Start it in your project to chat:");
    expect(root.textContent).toContain(
      "The chat connects automatically once the agent is running.",
    );
  });

  it("shows the offline badge", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("offline");
    expect(root.textContent).toContain("Tier 0");
  });

  it("renders the onboard-agent command as a copyable code block", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("npx @forgeplan/web onboard-agent");
    expect(
      root.querySelector('[aria-label="Copy to clipboard"]'),
    ).not.toBeNull();
  });

  it("renders no text input or Send button while offline", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(
      root.querySelector('[aria-label="Ask the map a question"]'),
    ).toBeNull();
    expect(
      Array.from(root.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Send"),
      ),
    ).toBe(false);
  });

  it("does nothing when send() is called directly while offline", async () => {
    const { send, getMessages } = await import("../model/chat-store.svelte");
    mountChat({ doc: fixtureDoc() });
    send("Tell me about CLI Surfaces");
    expect(getMessages()).toEqual([]);
  });

  it("renders a close button and fires onClose when clicked", () => {
    const onClose = vi.fn();
    const root = mountChat({ doc: fixtureDoc(), onClose });
    const closeBtn = root.querySelector<HTMLButtonElement>(
      '[aria-label="Close chat"]',
    );
    expect(closeBtn).not.toBeNull();
    closeBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the close button when onClose is not provided", () => {
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.querySelector('[aria-label="Close chat"]')).toBeNull();
  });
});

// onboard-agent phase 1 — Tier 1: the daemon probe (mocked) reports up
// before mount, so the store is already in "tier1" by the time MapChat
// reads it; a mocked agent-client connection drives the streaming/relay
// behaviour explicitly. This is the ONLY state in which the chat can send
// or answer anything (AI-only) — the offline call-to-action from the
// describe block above disappears once the probe flips to tier1.
describe("MapChat — tier1 (live)", () => {
  function mockConnection() {
    const conn = { send: vi.fn(), cancel: vi.fn(), close: vi.fn() };
    let handlers: AgentHandlers | undefined;
    vi.mocked(connectAgent).mockImplementation((_port, h) => {
      handlers = h;
      return conn;
    });
    return {
      conn,
      handlers: () => {
        expect(handlers).toBeDefined();
        return handlers!;
      },
    };
  }

  async function mountOnline(doc: MapDocument = fixtureDoc()) {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers, conn } = mockConnection();
    const root = mountChat({ doc });
    return { root, handlers, conn };
  }

  it("shows the live badge with the daemon's model once the probe succeeds", async () => {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("live");
    expect(root.textContent).toContain("claude-mock");
  });

  it("renders the empty-transcript hint, an input, and a disabled Send button", async () => {
    const { root } = await mountOnline();
    expect(root.textContent).toContain("Ask anything about this project");
    getInput(root);
    expect(getSendButton(root).disabled).toBe(true);
  });

  it("enables Send once the input has non-whitespace text", async () => {
    const { root } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "   ");
    expect(getSendButton(root).disabled).toBe(true);
    typeInto(input, "hello");
    expect(getSendButton(root).disabled).toBe(false);
  });

  it("pressing Enter in the input sends the message and clears it", async () => {
    const { root } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "Tell me about CLI Surfaces");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");
    expect(input.value).toBe("");
  });

  it("Shift+Enter does not send (only a plain Enter does)", async () => {
    const { root } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "Tell me about CLI Surfaces");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    flushSync();
    // No message sent — the empty-transcript hint is still showing.
    expect(root.textContent).toContain("Ask anything about this project");
  });

  it("clicking Send sends the message and clears the input", async () => {
    const { root } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "Tell me about CLI Surfaces");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");
    expect(input.value).toBe("");
  });

  it("streams a live answer into the chat progressively", async () => {
    const { root, handlers } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(input.value).toBe("");

    handlers().onToken("Arti");
    flushSync();
    expect(root.textContent).toContain("Arti");

    handlers().onToken("facts live in .forgeplan/");
    flushSync();
    expect(root.textContent).toContain("Artifacts live in .forgeplan/");

    handlers().onDone();
    flushSync();
    expect(root.textContent).toContain("Artifacts live in .forgeplan/");
  });

  it("renders a streamed assistant answer's markdown as real elements, not literal ** / ##", async () => {
    const { root, handlers } = await mountOnline();
    typeInto(getInput(root), "## Bold Heading");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    handlers().onToken("## Bold Heading — **bold** text");
    handlers().onDone();
    flushSync();

    const assistantMarkdown = root.querySelector(".chat-md");
    expect(assistantMarkdown).not.toBeNull();
    expect(assistantMarkdown!.querySelector("h2")).not.toBeNull();
    expect(assistantMarkdown!.querySelector("strong")).not.toBeNull();
    expect(assistantMarkdown!.textContent).not.toContain("##");
    expect(assistantMarkdown!.textContent).not.toContain("**");
  });

  it("shows Stop instead of Send while pending, then Send (disabled when empty) once the answer completes", async () => {
    const { root, handlers } = await mountOnline();
    const input = getInput(root);
    typeInto(input, "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    // Sending cleared the input and swapped Send for Stop while the
    // answer streams -- Send is not the active control during a pending
    // turn (Phase 4a: cancel/stop).
    expect(input.value).toBe("");
    expect(findStopButton(root)).not.toBeNull();
    expect(findSendButton(root)).toBeNull();

    handlers().onDone();
    flushSync();

    // Once the answer completes, Stop swaps back to Send -- disabled
    // again because the input is still empty, enabled once text is typed.
    expect(findStopButton(root)).toBeNull();
    expect(findSendButton(root)).not.toBeNull();
    expect(findSendButton(root)!.disabled).toBe(true);

    typeInto(input, "another question");
    expect(findSendButton(root)!.disabled).toBe(false);
  });

  it("relays a show_on_map call to camera-bus during a tier1 answer", async () => {
    const { root, handlers } = await mountOnline();
    typeInto(getInput(root), "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    const before = currentCameraRequest().seq;
    handlers().onShowOnMap({ kind: "zone", id: "z.a" });
    expect(currentCameraRequest().seq).toBe(before + 1);
    expect(currentCameraRequest().target).toEqual({ kind: "zone", id: "z.a" });
  });

  it("falls back to the offline call-to-action when the connection drops", async () => {
    const { root, handlers } = await mountOnline();
    expect(root.textContent).toContain("claude-mock");

    typeInto(getInput(root), "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    handlers().onClose();
    flushSync();
    expect(root.textContent).toContain("offline");
    expect(root.textContent).toContain("The live assistant isn't running.");
  });

  it('the "New chat" control clears the transcript via newChat', async () => {
    const { root, handlers } = await mountOnline();
    typeInto(getInput(root), "Tell me about CLI Surfaces");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    handlers().onDone();
    flushSync();
    expect(root.textContent).toContain("CLI Surfaces");

    getNewChatButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain("Ask anything about this project");
  });

  // Phase 4a — cancel/stop: the Send button becomes a Stop button while a
  // Tier-1 answer is streaming, and swaps back once it settles (onDone) or
  // is cancelled by the user.
  describe("Stop button", () => {
    it("shows Stop (not Send) while an answer is streaming, and Send once it completes", async () => {
      const { root, handlers } = await mountOnline();
      typeInto(getInput(root), "Where does artifact recording live?");
      getSendButton(root).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      flushSync();

      expect(findStopButton(root)).not.toBeNull();
      expect(findSendButton(root)).toBeNull();

      handlers().onDone();
      flushSync();

      expect(findStopButton(root)).toBeNull();
      expect(findSendButton(root)).not.toBeNull();
    });

    it("clicking Stop cancels the connection, keeps the partial answer with a stopped marker, and swaps back to Send", async () => {
      const { root, conn, handlers } = await mountOnline();
      typeInto(getInput(root), "Where does artifact recording live?");
      getSendButton(root).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      flushSync();

      handlers().onToken("Partial answer");
      flushSync();
      expect(root.textContent).toContain("Partial answer");

      findStopButton(root)!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      flushSync();

      expect(conn.cancel).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain("Partial answer");
      expect(root.textContent).toContain("stopped");
      expect(findStopButton(root)).toBeNull();
      expect(findSendButton(root)).not.toBeNull();
    });

    it("does not fall back to offline after Stop — the live badge stays up for the next question", async () => {
      const { root, handlers } = await mountOnline();
      typeInto(getInput(root), "Where does artifact recording live?");
      getSendButton(root).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      flushSync();

      findStopButton(root)!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      flushSync();

      expect(root.textContent).toContain("live");
      expect(root.textContent).toContain("claude-mock");
      void handlers; // no further daemon frames needed for this assertion
    });
  });
});
