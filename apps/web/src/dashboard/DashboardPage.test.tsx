import { act, screen, within } from "@testing-library/react";
import { useMatch } from "../stream/store";
import {
  agentCatalog, agentRun, autoLive, broadcasts, endedBroadcast, envelope, FakeEventSource, FakeEventSourceCtor, fanZone, highlight, output,
  playerReport, prediction, stats, status,
} from "../test/fixtures";
import { renderUi } from "../test/render";
import { DashboardPage } from "./DashboardPage";

const stream = (path: string) => FakeEventSource.instances.filter((source) => source.url === path && !source.closed).at(-1)!;

function push(path: string, doc: unknown) {
  act(() => {
    const source = stream(path);
    source.open();
    source.emitRaw(JSON.stringify(doc));
  });
}

function serve(current: string | null) {
  const reply = (statusCode: number, body: unknown) => new Response(JSON.stringify(body), { status: statusCode });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/agents") return reply(200, agentCatalog(["visualization"]));
    if (url === "/api/matches/current") return current ? reply(200, { match_id: current }) : reply(404, {});
    if (url === "/api/me") return reply(200, { studio: true });
    return reply(404, {});
  }));
}

beforeEach(() => {
  FakeEventSource.instances = [];
  useMatch.setState({ data: useMatch.getInitialState().data, connection: "idle", selectedId: null });
});

test("with nothing playing, the dashboard says so in every part instead of showing numbers", async () => {
  serve(null);
  renderUi(<DashboardPage eventSource={FakeEventSourceCtor} retryMs={10} pollMs={1000} />);
  expect(screen.getByRole("heading", { level: 1, name: "Unified analytics" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  expect(within(screen.getByTestId("kpi-score")).getByText("No match yet")).toBeTruthy();
  expect(screen.getByText("The fan zone has not been reached yet.")).toBeTruthy();
  expect(screen.getByText("The broadcasts have not been reached yet.")).toBeTruthy();
  expect(await screen.findByText("Off")).toBeTruthy(); // the Visualization Agent, switched off in the catalogue
});

test("the dashboard joins the match, the broadcasts, the fan zone and auto live into one page", async () => {
  serve("m-1");
  renderUi(<DashboardPage eventSource={FakeEventSourceCtor} retryMs={10} pollMs={1000} />);
  const opened = () => FakeEventSource.instances.find((source) => source.url.startsWith("/api/matches/m-1/stream") && !source.closed);
  await vi.waitFor(() => expect(opened()).toBeTruthy());
  const match = opened()!;
  act(() => {
    match.open();
    match.emit(envelope(1, "match_status", status({ minute: 30, score_home: 2, score_away: 1 })));
    match.emit(envelope(2, "stats", stats({ xg: 1.25, shots: 6, shots_on_target: 3 }, { xg: 0.5, shots: 2, shots_on_target: 1 })));
    match.emit(envelope(3, "prediction", prediction({ win_home: 0.6, draw: 0.25, win_away: 0.15 })));
    match.emit(envelope(4, "players", playerReport()));
    match.emit(envelope(5, "highlight", highlight()));
    match.emit(envelope(6, "agent_run", agentRun({ id: "r1", agent: "prediction", minute: 30, count: 2 })));
  });
  push("/api/studio/output/stream", output());
  push("/api/broadcasts/stream", broadcasts({ broadcasts: [endedBroadcast()] }));
  push("/api/fans/stream", fanZone({
    summary: { text: "", per_minute: 3, total: 12, mood: { positive: 9, neutral: 2, negative: 1 }, topics: [], platforms: [{ platform: "youtube", count: 12 }], raised: [] },
  }));
  push("/api/autolive/stream", autoLive({ matches_started: 3 }));

  expect(within(screen.getByTestId("kpi-score")).getByText("2 - 1")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-win")).getByText("60%")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-xg")).getByText("1.25 - 0.50")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-highlights")).getByText("1")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-audience")).getByText("12")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-audience")).getByText(/75% positive · Demo/)).toBeTruthy();
  expect(within(screen.getByTestId("kpi-broadcasts")).getByText("2 min")).toBeTruthy();
  expect(within(screen.getByTestId("kpi-autolive")).getByText(/3 matches started/)).toBeTruthy();

  const forecast = within(screen.getByTestId("row-team-forecast"));
  expect(forecast.getByText("Forecast Team")).toBeTruthy();
  expect(within(screen.getByTestId("row-agent-prediction")).getByText("30'")).toBeTruthy();
  expect(within(screen.getByTestId("row-player-nbr-9")).getByText("Luca Marrowby", { exact: false })).toBeTruthy();
  expect(within(screen.getByTestId("card-highlight-mix")).getByText("Goal")).toBeTruthy();
  expect(within(screen.getByTestId("card-platforms")).getByText("YouTube")).toBeTruthy();
  expect(within(screen.getByTestId("row-broadcast-b1")).getByRole("link", { name: "Derby day" }).getAttribute("href")).toBe("/broadcasts/b1");
});
