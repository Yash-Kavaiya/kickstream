import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import type { AgentCatalog, AgentConnector, AgentSpec, CopilotAnswer } from "../contracts";
import { forgetViewer } from "../shell/viewer";
import { agentCatalog } from "../test/fixtures";
import { renderUi } from "../test/render";
import { AgentChat } from "./AgentChat";
import { ConnectorsCard, InstructionsCard } from "./AgentSettings";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const ODDS: AgentConnector = {
  id: "c1", name: "Bookmaker odds", url: "https://odds.example/api", description: "Live odds", header: null, has_secret: true, enabled: true,
};

const prediction = (over: Partial<AgentSpec> = {}): AgentSpec => ({
  ...agentCatalog().agents.find((agent) => agent.id === "prediction")!, custom_instructions: "", connectors: [], ...over,
});
const themed = (ui: ReactElement) => <FluentProvider theme={webLightTheme}>{ui}</FluentProvider>;
const catalogWith = (agent: AgentSpec): AgentCatalog => ({ model: true, agents: [agent] });

function serve(replies: Record<string, (body: unknown) => [number, unknown]>, studio = true) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url === "/api/me") return new Response(JSON.stringify({ studio }), { status: 200 });
    const reply = replies[`${method} ${url}`];
    const [status, payload] = reply ? reply(body) : [404, {}];
    return new Response(JSON.stringify(payload), { status });
  }));
  return calls;
}

beforeEach(() => forgetViewer());

test("the studio saves and clears an agent's own instructions, and is told where they are used", async () => {
  const changed: AgentCatalog[] = [];
  const calls = serve({
    "PUT /api/agents/prediction/instructions": (body) => [200, catalogWith(prediction({ custom_instructions: (body as { custom_instructions: string }).custom_instructions }))],
  });
  const { rerender } = renderUi(<InstructionsCard agent={prediction()} model onCatalog={(catalog) => changed.push(catalog)} />);
  const card = within(screen.getByTestId("card-instructions"));
  expect(card.getByText(/What the agent computes from the match stays the same/)).toBeTruthy();
  const save = card.getByRole("button", { name: "Save instructions" }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);

  fireEvent.change(card.getByRole("textbox"), { target: { value: "Give odds as fractions." } });
  fireEvent.click(save);
  await waitFor(() => expect(card.getByRole("status").textContent).toBe("Saved"));
  expect(calls.at(-1)).toEqual({ url: "/api/agents/prediction/instructions", method: "PUT", body: { custom_instructions: "Give odds as fractions." } });
  expect(changed[0].agents[0].custom_instructions).toBe("Give odds as fractions.");

  rerender(themed(<InstructionsCard agent={prediction({ custom_instructions: "Give odds as fractions." })} model onCatalog={(catalog) => changed.push(catalog)} />));
  fireEvent.click(card.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(calls.at(-1)?.body).toEqual({ custom_instructions: "" }));
});

test("without a model the card says the instructions wait for one, and a refused save is shown", async () => {
  serve({ "PUT /api/agents/prediction/instructions": () => [503, { detail: [{ loc: ["body", "agent"], msg: "The change could not be saved. Nothing was changed." }] }] });
  renderUi(<InstructionsCard agent={prediction()} model={false} onCatalog={() => undefined} />);
  const card = within(screen.getByTestId("card-instructions"));
  expect(card.getByText(/No model is set up/)).toBeTruthy();
  fireEvent.change(card.getByRole("textbox"), { target: { value: "Be brief." } });
  fireEvent.click(card.getByRole("button", { name: "Save instructions" }));
  expect(await card.findByText("The change could not be saved. Nothing was changed.")).toBeTruthy();
});

test("a viewer who is not signed in sees the instructions and connectors but cannot change them", async () => {
  serve({}, false);
  renderUi(
    <>
      <InstructionsCard agent={prediction({ custom_instructions: "Be brief." })} model onCatalog={() => undefined} />
      <ConnectorsCard agent={prediction({ connectors: [ODDS] })} onCatalog={() => undefined} />
    </>,
  );
  await waitFor(() => expect(screen.queryByRole("button", { name: "Add connector" })).toBeNull());
  expect(screen.getByText("Be brief.")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("Bookmaker odds")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
});

test("the studio adds a connector with a key, tests it, switches it off and removes it", async () => {
  const changed: AgentCatalog[] = [];
  const calls = serve({
    "POST /api/agents/prediction/connectors": () => [200, catalogWith(prediction({ connectors: [ODDS] }))],
    "POST /api/agents/prediction/connectors/c1/check": () => [200, { ok: true, status: 200, snippet: "Home are 1.8 to win.", problem: null, ms: 42 }],
    "PUT /api/agents/prediction/connectors/c1": () => [200, catalogWith(prediction({ connectors: [{ ...ODDS, enabled: false }] }))],
    "DELETE /api/agents/prediction/connectors/c1": () => [200, catalogWith(prediction())],
  });
  const { rerender } = renderUi(<ConnectorsCard agent={prediction()} onCatalog={(catalog) => changed.push(catalog)} />);
  expect(screen.getByText("No connectors yet.")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Add connector" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: /Name/ }), { target: { value: "Bookmaker odds" } });
  fireEvent.change(dialog.getByRole("textbox", { name: /Address/ }), { target: { value: "https://odds.example/api" } });
  fireEvent.change(dialog.getByLabelText(/^Key$/), { target: { value: "k-1" } });
  fireEvent.click(dialog.getByRole("button", { name: "Add connector" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(calls.find((call) => call.method === "POST")?.body).toEqual({
    name: "Bookmaker odds", url: "https://odds.example/api", description: "", header: null, enabled: true, secret: "k-1",
  });

  rerender(themed(<ConnectorsCard agent={changed[0].agents[0]} onCatalog={(catalog) => changed.push(catalog)} />));
  const item = within(screen.getByTestId("connector-c1"));
  expect(item.getByText("Key saved")).toBeTruthy();
  fireEvent.click(item.getByRole("button", { name: "Test" }));
  expect((await item.findByTestId("connector-check")).textContent).toContain("Answered in 42 ms: Home are 1.8 to win.");

  fireEvent.click(item.getByRole("switch", { name: "Bookmaker odds on" }));
  await waitFor(() => expect(calls.at(-1)?.method).toBe("PUT"));
  // The key is not sent again, so the saved one is kept.
  expect(calls.at(-1)?.body).toEqual({ name: "Bookmaker odds", url: "https://odds.example/api", description: "Live odds", header: null, enabled: false });

  fireEvent.click(item.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(calls.at(-1)?.method).toBe("DELETE"));
  expect(changed.at(-1)?.agents[0].connectors).toEqual([]);
});

test("a refused address is shown on its field", async () => {
  serve({
    "POST /api/agents/prediction/connectors": () => [422, { detail: [{ loc: ["body", "url"], msg: "A connector's address must start with http:// or https://." }] }],
  });
  renderUi(<ConnectorsCard agent={prediction()} onCatalog={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Add connector" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: /Name/ }), { target: { value: "Files" } });
  fireEvent.change(dialog.getByRole("textbox", { name: /Address/ }), { target: { value: "ftp://files.example" } });
  fireEvent.click(dialog.getByRole("button", { name: "Add connector" }));
  expect(await dialog.findByText("A connector's address must start with http:// or https://.")).toBeTruthy();
});

const reply = (over: Partial<CopilotAnswer> = {}): CopilotAnswer => ({
  id: "a1", question: "Who will win?", intent: "prediction", answer: "Home are **favourites**.", cards: [], charts: [], followups: ["Who scores next?"],
  source: "agent", searched: false, problem: null, agent: "prediction", sample: false,
  sources: [{ title: "Bookmaker odds", url: "https://odds.example/api", snippet: "Home are 1.8 to win.", kind: "connector" }],
  ...over,
});

test("the chat puts each question to its agent and shows the answer with the connectors it used", async () => {
  const calls = serve({ "POST /api/copilot/ask": () => [200, reply()] });
  renderUi(<AgentChat agent={prediction({ connectors: [ODDS], custom_instructions: "Be brief." })} />);
  const card = within(screen.getByTestId("card-chat"));
  expect(card.getByText(/It also asks Bookmaker odds\. It follows your custom instructions\./)).toBeTruthy();

  fireEvent.change(card.getByRole("textbox", { name: "Ask the Prediction Agent" }), { target: { value: "Who will win?" } });
  fireEvent.keyDown(card.getByRole("textbox", { name: "Ask the Prediction Agent" }), { key: "Enter" });
  const answer = await card.findByText("favourites");
  expect(answer.tagName).toBe("STRONG");
  expect(calls.at(-1)).toEqual({ url: "/api/copilot/ask", method: "POST", body: { question: "Who will win?", mode: "analyst", web: false, agent: "prediction" } });
  expect(card.getByText("Connector")).toBeTruthy();
  expect(card.getByText("Home are 1.8 to win.")).toBeTruthy();
  expect(card.getByText("Written by a model")).toBeTruthy();

  await act(async () => fireEvent.click(card.getByRole("button", { name: "Who scores next?" })));
  await waitFor(() => expect(card.getAllByTestId("chat-question")).toHaveLength(2));
  expect((calls.at(-1)?.body as { question: string }).question).toBe("Who scores next?");
});

test("a chat question that fails says so in the conversation", async () => {
  serve({ "POST /api/copilot/ask": () => [422, { detail: [{ loc: ["body", "question"], msg: "A question must be 1 to 300 characters." }] }] });
  renderUi(<AgentChat agent={prediction()} />);
  fireEvent.click(screen.getByRole("button", { name: "Who will win from here?" }));
  expect(await screen.findByText("A question must be 1 to 300 characters.")).toBeTruthy();
});
