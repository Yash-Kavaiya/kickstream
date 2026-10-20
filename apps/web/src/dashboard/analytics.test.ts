import {
  agentRun, broadcast, endedBroadcast, fanComment, fanPoll, fanZone, highlight, playerLine, playerReport, reel, superchat,
} from "../test/fixtures";
import { agentWork, audienceSummary, broadcastSummary, highlightMix, teamWork, topPlayers } from "./analytics";

test("each agent's work is summed from its runs, and every agent is listed even with none", () => {
  const work = agentWork([
    agentRun({ id: "a", agent: "prediction", minute: 14, count: 2, duration_ms: 3, source: "agent" }),
    agentRun({ id: "b", agent: "prediction", minute: 12, count: 1, duration_ms: 1 }),
    agentRun({ id: "c", agent: "highlights", minute: 9, count: 4, duration_ms: 2 }),
  ]);
  expect(work).toHaveLength(7);
  const prediction = work.find((agent) => agent.agent === "prediction")!;
  expect(prediction).toMatchObject({ team: "forecast", runs: 2, produced: 3, avgMs: 2, maxMs: 3, modelShare: 0.5, lastMinute: 14 });
  expect(work.find((agent) => agent.agent === "visualization")).toMatchObject({ runs: 0, avgMs: 0, lastMinute: null });
});

test("the teams' work adds up their agents', the average weighted by runs", () => {
  const teams = teamWork(agentWork([
    agentRun({ id: "a", agent: "prediction", duration_ms: 1 }),
    agentRun({ id: "b", agent: "prediction", duration_ms: 1 }),
    agentRun({ id: "c", agent: "explainability", duration_ms: 4 }),
  ]));
  expect(teams.map((team) => team.team)).toEqual(["reading", "forecast", "story"]);
  expect(teams[1]).toMatchObject({ name: "Forecast Team", runs: 3, produced: 3, avgMs: 2 });
  expect(teams[0].runs).toBe(0);
});

test("highlights are counted by kind, most first", () => {
  expect(highlightMix([
    highlight({ id: "1", category: "big_save" }), highlight({ id: "2", category: "goal" }), highlight({ id: "3", category: "goal" }),
  ])).toEqual([{ key: "goal", count: 2 }, { key: "big_save", count: 1 }]);
});

test("the best-rated players come first", () => {
  const report = playerReport({ players: [playerLine({ player_id: "a", rating: 6 }), playerLine({ player_id: "b", rating: 8 }), playerLine({ player_id: "c", rating: 7 })] });
  expect(topPlayers(report, 2).map((player) => player.player_id)).toEqual(["b", "c"]);
  expect(topPlayers(null)).toEqual([]);
});

test("the broadcasts are summed: states, time on air with the open session counted to now, files, reels and reach", () => {
  const live = broadcast({
    id: "b2", state: "live",
    sessions: [{ started_at: 2000, ended_at: null, problem: null, destinations: [{ id: "d1", name: "YouTube", platform: "youtube", outcome: "live", reason: null }] }],
    reels: [reel({ id: "r2", state: "rendering" })],
  });
  const summary = broadcastSummary([endedBroadcast(), live, broadcast({ id: "b3" })], 2030);
  expect(summary).toMatchObject({
    total: 3, live: 1, ready: 1, ended: 1, sessions: 2, onAirS: 150, recordings: 1, recordingBytes: 5 * 1024 * 1024,
    reels: 2, readyReels: 1, editedReels: 0, reached: 3, destinations: 4,
  });
  expect(summary.moments).toEqual([{ key: "goal", count: 1 }]);
});

test("the audience is summed from the fan zone: mood shares, platforms, likes, money and the poll's leader", () => {
  const fans = fanZone({
    comments: [fanComment(), fanComment({ id: "c2", likes: 5 })],
    superchats: [superchat()],
    poll: fanPoll(),
    summary: {
      text: "", per_minute: 2.5, total: 4, mood: { positive: 2, neutral: 1, negative: 1 }, topics: [{ label: "Goal", count: 3 }],
      platforms: [{ platform: "x", count: 1 }, { platform: "youtube", count: 3 }], raised: [{ currency: "USD", amount: 20 }],
    },
  });
  expect(audienceSummary(fans)).toMatchObject({
    comments: 4, perMinute: 2.5, mood: { positive: 0.5, neutral: 0.25, negative: 0.25 }, likes: 8, superchats: 1,
    platforms: [{ key: "youtube", count: 3 }, { key: "x", count: 1 }],
    poll: { question: "Who wins?", votes: 4, leader: "Home", open: true }, demo: true,
  });
  expect(audienceSummary(fanZone()).mood).toEqual({ positive: 0, neutral: 0, negative: 0 });
});
