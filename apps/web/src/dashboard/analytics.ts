import { type AgentId } from "../agents/api";
import { AGENT_NAMES } from "../agents/cards";
import { ANALYST_TEAMS, type TeamId } from "../agents/teams";
import { onAir, reach } from "../broadcasts/format";
import type { AgentRun, Broadcast, BroadcastMoment, FanZone, Highlight, PlayerMetrics, PlayerReport } from "../contracts";

/**
 * The sums the dashboard shows, worked out from the documents the server already keeps live:
 * the match stream, the broadcasts, the fan zone and auto live. Pure, so each is tested alone.
 */

export interface AgentWork {
  agent: AgentId;
  name: string;
  team: TeamId | null;
  runs: number;
  /** Items produced over those runs. */
  produced: number;
  avgMs: number;
  maxMs: number;
  /** Share of runs a model wrote, 0 to 1. */
  modelShare: number;
  lastMinute: number | null;
}

export interface TeamWork {
  team: TeamId;
  name: string;
  runs: number;
  produced: number;
  avgMs: number;
}

const average = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

/** Each agent's work over the runs given (newest first), every agent listed even with none. */
export function agentWork(runs: readonly AgentRun[]): AgentWork[] {
  return (Object.keys(AGENT_NAMES) as AgentId[]).map((agent) => {
    const own = runs.filter((run) => run.agent === agent);
    const durations = own.map((run) => run.duration_ms);
    return {
      agent,
      name: AGENT_NAMES[agent],
      team: ANALYST_TEAMS.find((team) => team.members.includes(agent))?.id ?? null,
      runs: own.length,
      produced: own.reduce((sum, run) => sum + run.count, 0),
      avgMs: average(durations),
      maxMs: durations.length === 0 ? 0 : Math.max(...durations),
      modelShare: own.length === 0 ? 0 : own.filter((run) => run.source === "agent").length / own.length,
      lastMinute: own.length === 0 ? null : Math.max(...own.map((run) => run.minute)),
    };
  });
}

/** The agents' work summed by team. */
export function teamWork(work: readonly AgentWork[]): TeamWork[] {
  return ANALYST_TEAMS.map((team) => {
    const members = work.filter((agent) => agent.team === team.id);
    const runs = members.reduce((sum, agent) => sum + agent.runs, 0);
    return {
      team: team.id,
      name: team.name,
      runs,
      produced: members.reduce((sum, agent) => sum + agent.produced, 0),
      // Weighted by runs, so a busy agent counts for more than a quiet one.
      avgMs: runs === 0 ? 0 : members.reduce((sum, agent) => sum + agent.avgMs * agent.runs, 0) / runs,
    };
  });
}

export interface Count<K extends string = string> {
  key: K;
  count: number;
}

/** How many highlights of each category, most first, then by name. */
export function highlightMix(highlights: readonly Highlight[]): Count<Highlight["category"]>[] {
  const counts = new Map<Highlight["category"], number>();
  for (const highlight of highlights) counts.set(highlight.category, (counts.get(highlight.category) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** The best-rated players so far, goals then expected goals breaking a tie. */
export function topPlayers(report: PlayerReport | null, limit = 8): PlayerMetrics[] {
  if (!report) return [];
  return [...report.players].sort((a, b) => b.rating - a.rating || b.goals - a.goals || b.xg - a.xg).slice(0, limit);
}

export interface BroadcastSummary {
  total: number;
  live: number;
  ready: number;
  ended: number;
  sessions: number;
  /** Seconds on air across every broadcast, the open session counted up to now. */
  onAirS: number;
  recordings: number;
  recordingBytes: number;
  reels: number;
  readyReels: number;
  editedReels: number;
  moments: Count<BroadcastMoment["kind"]>[];
  /** Destinations that took the stream, of all that were tried, across every broadcast. */
  reached: number;
  destinations: number;
}

export function broadcastSummary(broadcasts: readonly Broadcast[], now: number): BroadcastSummary {
  const moments = new Map<BroadcastMoment["kind"], number>();
  for (const moment of broadcasts.flatMap((broadcast) => broadcast.moments)) moments.set(moment.kind, (moments.get(moment.kind) ?? 0) + 1);
  const reels = broadcasts.flatMap((broadcast) => broadcast.reels);
  const reaches = broadcasts.map(reach);
  return {
    total: broadcasts.length,
    live: broadcasts.filter((broadcast) => broadcast.state === "live").length,
    ready: broadcasts.filter((broadcast) => broadcast.state === "ready").length,
    ended: broadcasts.filter((broadcast) => broadcast.state === "ended").length,
    sessions: broadcasts.reduce((sum, broadcast) => sum + broadcast.sessions.length, 0),
    onAirS: broadcasts.reduce((sum, broadcast) => sum + onAir(broadcast, now), 0),
    recordings: broadcasts.reduce((sum, broadcast) => sum + broadcast.recordings.length, 0),
    recordingBytes: broadcasts.reduce((sum, broadcast) => sum + broadcast.recordings.reduce((size, file) => size + file.size_bytes, 0), 0),
    reels: reels.length,
    readyReels: reels.filter((reel) => reel.state === "ready").length,
    editedReels: reels.filter((reel) => reel.edited).length,
    moments: [...moments].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    reached: reaches.reduce((sum, one) => sum + one.reached, 0),
    destinations: reaches.reduce((sum, one) => sum + one.total, 0),
  };
}

export interface AudienceSummary {
  comments: number;
  perMinute: number;
  /** Shares of the mood, 0 to 1 each; all zero with no comments. */
  mood: { positive: number; neutral: number; negative: number };
  topics: { label: string; count: number }[];
  platforms: Count[];
  likes: number;
  superchats: number;
  raised: { currency: string; amount: number }[];
  poll: { question: string; votes: number; leader: string | null; open: boolean } | null;
  demo: boolean;
}

export function audienceSummary(fans: FanZone): AudienceSummary {
  const { summary } = fans;
  const moods = summary.mood.positive + summary.mood.neutral + summary.mood.negative;
  const share = (value: number) => (moods === 0 ? 0 : value / moods);
  const poll = fans.poll ?? null;
  const votes = poll ? poll.options.reduce((sum, option) => sum + option.votes, 0) : 0;
  const leader = poll && votes > 0 ? [...poll.options].sort((a, b) => b.votes - a.votes)[0].text : null;
  return {
    comments: summary.total,
    perMinute: summary.per_minute,
    mood: { positive: share(summary.mood.positive), neutral: share(summary.mood.neutral), negative: share(summary.mood.negative) },
    topics: summary.topics.slice(0, 6),
    platforms: summary.platforms.map((one) => ({ key: one.platform, count: one.count })).sort((a, b) => b.count - a.count),
    likes: fans.comments.reduce((sum, comment) => sum + comment.likes, 0),
    superchats: fans.superchats.length,
    raised: summary.raised,
    poll: poll ? { question: poll.question, votes, leader, open: poll.state === "open" } : null,
    demo: fans.source_state === "demo",
  };
}
