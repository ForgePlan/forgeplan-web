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

  it("shows the offline status", () => {
    // RFC-035 FR-2 — the header's old verbose "offline · Tier 0" Badge was
    // replaced by a compact red-dot + "offline" word; the model/tier string
    // moved to the Info tab (FR-4) instead of disappearing.
    const root = mountChat({ doc: fixtureDoc() });
    expect(root.textContent).toContain("offline");
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

    handlers().onToken("Arti", null);
    flushSync();
    expect(root.textContent).toContain("Arti");

    handlers().onToken("facts live in .forgeplan/", null);
    flushSync();
    expect(root.textContent).toContain("Artifacts live in .forgeplan/");

    handlers().onDone(null);
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

    handlers().onToken("## Bold Heading — **bold** text", null);
    handlers().onDone(null);
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

    handlers().onDone(null);
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
    handlers().onShowOnMap({ kind: "zone", id: "z.a" }, null);
    expect(currentCameraRequest().seq).toBe(before + 1);
    expect(currentCameraRequest().target).toEqual({ kind: "zone", id: "z.a" });
  });

  // Bugfix #5 — a connection drop used to yank a non-empty transcript
  // off-screen in favour of the offline CTA (isOffline used to ignore
  // `messages.length`); the corrected behaviour keeps any existing
  // transcript (partial answer included) visible, and reserves the CTA
  // for the genuinely-empty case.
  it("keeps the transcript visible (not the offline CTA) when the connection drops with a message already in flight", async () => {
    const { root, handlers } = await mountOnline();
    expect(root.textContent).toContain("claude-mock");

    typeInto(getInput(root), "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    handlers().onToken("Partial answer", null);
    flushSync();

    handlers().onClose();
    flushSync();

    // The header status flips to offline, but the transcript (including
    // the partial answer already streamed in) stays on screen instead of
    // being replaced by the offline call-to-action.
    expect(root.textContent).toContain("offline");
    expect(root.textContent).toContain("Partial answer");
    expect(root.textContent).not.toContain(
      "The live assistant isn't running.",
    );
  });

  it('the "New chat" control clears the transcript via newChat', async () => {
    const { root, handlers } = await mountOnline();
    typeInto(getInput(root), "Tell me about CLI Surfaces");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    handlers().onDone(null);
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

      handlers().onDone(null);
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

      handlers().onToken("Partial answer", null);
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

// RFC-035 FR-3 — the Chat|Info Tabs split. Both panels stay MOUNTED (bits-ui
// toggles the inactive one via the native `hidden` attribute) so a streaming
// answer survives a tab switch — but that means a regression can make BOTH
// panels visible at once. A live-browser check caught exactly this: the
// `.mc-tab-chat`/`.mc-tab-info` layout overrides in MapChat.svelte's
// `<style>` were unconditional CSS, which wins over the browser's own
// `[hidden] -> display:none` UA rule regardless of selector specificity, so
// the inactive panel kept its `display: flex`/`block` and rendered stacked
// under the active one (fixed by scoping both to `:not([hidden])`).
//
// NOTE: this vitest `dom` project's `mount()` harness does NOT inject
// component `<style>` blocks into `document.head` at all (verified —
// `document.head.querySelectorAll("style")` is empty after mount), so
// `getComputedStyle` here can never reflect the CSS fix either way — it
// would report browser defaults regardless of whether the bug is present or
// fixed. The CSS-cascade behaviour itself can only be proven by a real
// browser (which is how it was found). What IS reliably testable here is
// the DOM-structural half of the contract bits-ui drives independently of
// CSS: exactly one panel's `hidden` attribute is absent at a time, and any
// element that must be inaccessible on the inactive tab has a `[hidden]`
// ancestor. These tests assert that half; they would have caught a
// regression in the *attribute* wiring, not the CSS override — see rule-24
// grep / manual browser check for the latter.
describe("MapChat — Chat/Info tab switch shows exactly one panel (RFC-035 FR-3)", () => {
  function getTabButton(
    root: HTMLElement,
    value: "chat" | "info",
  ): HTMLButtonElement {
    const btn = root.querySelector<HTMLButtonElement>(
      `[role="tab"][data-value="${value}"]`,
    );
    expect(btn).not.toBeNull();
    return btn!;
  }

  function getPanel(
    root: HTMLElement,
    cls: "mc-tab-chat" | "mc-tab-info",
  ): HTMLElement {
    const el = root.querySelector<HTMLElement>(`.${cls}`);
    expect(el).not.toBeNull();
    return el!;
  }

  async function mountOnlineForTabs() {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    vi.mocked(connectAgent).mockImplementation(() => ({
      send: vi.fn(),
      cancel: vi.fn(),
      close: vi.fn(),
    }));
    const root = mountChat({ doc: fixtureDoc() });
    return root;
  }

  it("Chat is the active tab by default: chat panel visible, Info panel hidden", async () => {
    const root = await mountOnlineForTabs();
    const chatPanel = getPanel(root, "mc-tab-chat");
    const infoPanel = getPanel(root, "mc-tab-info");

    expect(chatPanel.hasAttribute("hidden")).toBe(false);
    expect(infoPanel.hasAttribute("hidden")).toBe(true);
  });

  it("clicking the Info tab hides the Chat panel (transcript + input) and shows only the Info diagnostics", async () => {
    const root = await mountOnlineForTabs();
    getTabButton(root, "info").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    const chatPanel = getPanel(root, "mc-tab-chat");
    const infoPanel = getPanel(root, "mc-tab-info");

    expect(infoPanel.hasAttribute("hidden")).toBe(false);
    expect(chatPanel.hasAttribute("hidden")).toBe(true);

    // The input row (textarea + Send) belongs to the Chat panel only — it
    // must live inside the now-hidden panel, not float outside the Tabs
    // content boundary where it would always render regardless of tab.
    const textarea = root.querySelector(
      '[aria-label="Ask the map a question"]',
    );
    expect(textarea).not.toBeNull();
    expect(chatPanel.contains(textarea)).toBe(true);
    expect(textarea!.closest("[hidden]")).not.toBeNull();
    expect(
      Array.from(root.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Send"),
      ),
    ).toBe(true);

    // The Info diagnostics are visible, not nested under any hidden ancestor.
    expect(infoPanel.textContent).toContain("Model");
    expect(infoPanel.closest("[hidden]")).toBeNull();
  });

  it("clicking back to the Chat tab restores the transcript/input view and hides Info again", async () => {
    const root = await mountOnlineForTabs();
    getTabButton(root, "info").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    getTabButton(root, "chat").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    const chatPanel = getPanel(root, "mc-tab-chat");
    const infoPanel = getPanel(root, "mc-tab-info");
    expect(chatPanel.hasAttribute("hidden")).toBe(false);
    expect(infoPanel.hasAttribute("hidden")).toBe(true);
  });

  it("switching to Info and back preserves an in-flight streaming answer (the Chat subtree stays mounted, never destroyed)", async () => {
    const root = await mountOnlineForTabs();
    const input = getInput(root);
    typeInto(input, "Where does artifact recording persist?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();

    getTabButton(root, "info").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    // The Info tab is visible now, but the Chat panel (with its in-flight
    // assistant bubble) must still be present in the DOM, merely hidden —
    // never unmounted — so switching back shows it exactly as left.
    const chatPanel = getPanel(root, "mc-tab-chat");
    expect(chatPanel.textContent).toContain(
      "Where does artifact recording persist?",
    );

    getTabButton(root, "chat").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    expect(root.textContent).toContain(
      "Where does artifact recording persist?",
    );
    expect(getInput(root).value).toBe("");
  });
});

// RFC-035 Wave 2 (FR-5/FR-6) — Info tab fills in from live daemon frames:
// token usage stays "—" until the first `usage` frame, then renders
// thousands-separated counts (+ cost); "other projects" reports the
// ready-frame instance-discovery snapshot.
describe("MapChat — Info tab token usage + other projects (RFC-035 Wave 2)", () => {
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

  function getInfoPanel(root: HTMLElement): HTMLElement {
    const el = root.querySelector<HTMLElement>(".mc-tab-info");
    expect(el).not.toBeNull();
    return el!;
  }

  function openInfoTab(root: HTMLElement): void {
    const btn = root.querySelector<HTMLButtonElement>(
      '[role="tab"][data-value="info"]',
    );
    expect(btn).not.toBeNull();
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
  }

  // A live connection only opens once a question is actually sent
  // (chat-store's `ensureConnection` is lazy) — send one turn so
  // `connectAgent` fires and captures its handlers, mirroring the "tier1
  // (live)" describe block above.
  async function mountOnlineForInfo() {
    vi.mocked(probeDaemon).mockResolvedValue({
      up: true,
      model: "claude-mock",
    });
    await checkDaemon(7431);
    const { handlers, conn } = mockConnection();
    const root = mountChat({ doc: fixtureDoc() });
    typeInto(getInput(root), "Where does artifact recording live?");
    getSendButton(root).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    flushSync();
    // Bugfix #1 — the turnId chat-store generated for this send is the
    // second argument threaded onto the mocked connection's `send()`;
    // reading it back here (rather than passing `null`) proves the usage
    // frame's real turnId-correlation path, not just the "no correlation
    // available" bypass.
    const turnId = conn.send.mock.calls[0]?.[1] as string;
    expect(typeof turnId).toBe("string");
    return { root, handlers, turnId };
  }

  it("shows — for token usage until the first usage frame arrives", async () => {
    const { root } = await mountOnlineForInfo();
    openInfoTab(root);
    expect(getInfoPanel(root).textContent).toContain("—");
  });

  it("renders session token counts with thousands separators and cost after a usage frame fires", async () => {
    const { root, handlers, turnId } = await mountOnlineForInfo();
    handlers().onUsage?.(
      { inputTokens: 1234, outputTokens: 567, costUsd: 0.0123 },
      turnId,
    );
    flushSync();
    openInfoTab(root);
    const text = getInfoPanel(root).textContent ?? "";
    expect(text).toContain("1,234");
    expect(text).toContain("567");
    expect(text).toContain("$0.0123");
  });

  it("accumulates a second usage frame into both session and cumulative totals shown in the Info tab", async () => {
    const { root, handlers, turnId } = await mountOnlineForInfo();
    handlers().onUsage?.(
      { inputTokens: 100, outputTokens: 40, costUsd: 0.01 },
      turnId,
    );
    handlers().onUsage?.(
      { inputTokens: 50, outputTokens: 10, costUsd: 0.005 },
      turnId,
    );
    flushSync();
    openInfoTab(root);
    const text = getInfoPanel(root).textContent ?? "";
    expect(text).toContain("150");
    expect(text).toContain("50");
    expect(text).toContain("cumulative");
  });

  it("shows 'just this one' when there are no other live instances", async () => {
    const { root } = await mountOnlineForInfo();
    openInfoTab(root);
    expect(getInfoPanel(root).textContent).toContain("just this one");
  });

  it("renders the other-instance count and project list once the ready frame reports one", async () => {
    const { root, handlers } = await mountOnlineForInfo();
    handlers().onReadyMeta?.({
      capabilities: ["usage", "instances"],
      otherInstances: [
        { projectName: "sibling-project", port: 7432, kind: "web" },
      ],
    });
    flushSync();
    openInfoTab(root);
    const text = getInfoPanel(root).textContent ?? "";
    expect(text).toContain("sees 1 other");
    expect(text).toContain("sibling-project:7432");
  });
});
