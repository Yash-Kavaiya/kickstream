import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { AutoLive, Output } from "../../contracts";
import type { SpeakerDeps } from "../../autolive/speaker";
import { EMPTY } from "../../stream/store";
import { autoLive, autoLiveSettings, destination, output, studio } from "../../test/fixtures";
import { renderUi } from "../../test/render";
import type { ProgramData } from "../elements";
import { AutoLiveTool } from "./AutoLiveTool";

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function serve(reply: AutoLive = autoLive({ revision: 2 })) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? "GET", url, body: init.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(reply), { status: 200 });
  }));
  return calls;
}

const quiet: Partial<SpeakerDeps> = {
  fetchSpeech: async () => {
    throw new Error("Azure Speech is not set up.");
  },
  audio: () => null,
  synth: () => undefined,
};

const data: ProgramData = { match: EMPTY, studio: studio(), now: 1000, language: "en" };

function show(doc: AutoLive | null, out: Output | null = output({ destinations: [destination({ enabled: true })] })) {
  const onRun = vi.fn(async (request: () => Promise<AutoLive>) => {
    await request();
    return true;
  });
  renderUi(<AutoLiveTool doc={doc} data={data} now={1000} output={out} onRun={onRun} narrative={null} speech={quiet} />);
  return onRun;
}

test("the tool waits for auto live to load", () => {
  show(null);
  expect(screen.getByText("Loading auto live…")).toBeTruthy();
});

test("the tool shows auto live's state, the screen on air and a preview", () => {
  show(autoLive({ next_at: 1065 }));
  expect(screen.getByText("Auto live on")).toBeTruthy();
  expect(screen.getByText("On screen: Welcome")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Auto live preview" })).toBeTruthy();
  expect(screen.getByText("Next screen in 1:05.")).toBeTruthy();
});

test("turning auto live on from the studio saves the setting and keeps the others", async () => {
  const calls = serve();
  const onRun = show(autoLive({ settings: autoLiveSettings({ enabled: false }) }));
  expect(screen.getByText("Auto live is off.")).toBeTruthy();
  fireEvent.click(screen.getByRole("switch", { name: "Auto live" }));
  await waitFor(() => expect(calls.at(-1)).toMatchObject({
    method: "PUT", url: "/api/autolive/settings", body: { enabled: true, min_minutes: 5, scenes: ["welcome", "agent-tactics"] },
  }));
  expect(onRun).toHaveBeenCalledTimes(1);
});

test("stream 24/7 needs a destination, and is saved when there is one", async () => {
  const calls = serve();
  show(autoLive());
  fireEvent.click(screen.getByRole("switch", { name: "Stream 24/7" }));
  await waitFor(() => expect(calls.at(-1)?.body).toMatchObject({ stream: true }));
});

test("with no destination on, stream 24/7 cannot be turned on and says why", () => {
  show(autoLive(), output());
  expect((screen.getByRole("switch", { name: "Stream 24/7" }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText("Turn on a destination in the Stream tool first.")).toBeTruthy();
});

test("next screen and say something now steer auto live from the studio", async () => {
  const calls = serve();
  show(autoLive());
  fireEvent.click(screen.getByRole("button", { name: "Next screen" }));
  await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/autolive/next" }));
  fireEvent.click(screen.getByRole("button", { name: "Say something now" }));
  await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/autolive/say" }));
});

test("auto live's problem shows, such as waiting for the studio's stream", () => {
  show(autoLive({ problem: "The studio's stream is on air; auto live goes on air when it ends." }));
  expect(screen.getByText("The studio's stream is on air; auto live goes on air when it ends.")).toBeTruthy();
});

test("the tool links to the auto live page and to its full-screen picture", () => {
  show(autoLive());
  expect(screen.getByRole("link", { name: "Open auto live" }).getAttribute("href")).toBe("/live");
  const full = screen.getByRole("link", { name: "Watch full screen" });
  expect(full.getAttribute("href")).toBe("/live?output");
  expect(full.getAttribute("target")).toBe("_blank");
});
