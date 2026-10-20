import { Badge, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import {
  BotSparkleRegular, DataTrendingRegular, FlashRegular, PeopleAudienceRegular, PeopleTeamRegular, SportSoccerRegular, TrophyRegular, VideoRegular,
} from "@fluentui/react-icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type AgentId, agentState, fetchAgents } from "../agents/api";
import { AGENT_ICONS, Card, colorsOf, namesOf } from "../agents/cards";
import { ANALYST_TEAMS } from "../agents/teams";
import { AUTOLIVE_STREAM } from "../autolive/api";
import { BROADCASTS_STREAM, broadcastPath } from "../broadcasts/api";
import { bytes, duration, MOMENT_LABELS, onAir, plural, STATE } from "../broadcasts/format";
import { CompareBars, type CompareRow, LineGraph, NEUTRAL, ShareBar } from "../charts/charts";
import type { AgentCatalog, AutoLive, Broadcasts, FanZone, Output, ViewerProfile } from "../contracts";
import { FANS_STREAM } from "../fans/api";
import { OUTPUT_STREAM } from "../output/api";
import { loadProfile } from "../prefs";
import { AppNav } from "../shell/AppNav";
import { useMatch } from "../stream/store";
import { useCurrentMatch } from "../stream/useCurrentMatch";
import { useLiveDocument } from "../stream/useLiveDocument";
import { useNow } from "../studio/useStudio";
import { agentWork, audienceSummary, broadcastSummary, highlightMix, teamWork, topPlayers } from "./analytics";

const HIGHLIGHT_LABELS: Record<string, string> = {
  goal: "Goal", red_card: "Red card", big_chance: "Big chance", momentum_swing: "Momentum shift", sustained_pressure: "Sustained pressure",
  long_sequence: "Long move", big_save: "Save", dangerous_turnover: "Ball won high", tactical_foul: "Tactical foul", unsung_player: "Unsung player",
};
const PLATFORM_LABELS: Record<string, string> = { x: "X", youtube: "YouTube", twitch: "Twitch", facebook: "Facebook", other: "Other" };
const MATCH_STATE: Record<string, string> = { pre_match: "Before kick-off", live: "Live", half_time: "Half-time", finished: "Full-time", abandoned: "Stopped" };

const useStyles = makeStyles({
  app: { display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: tokens.colorNeutralBackground2 },
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL, padding: tokens.spacingHorizontalXL, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: tokens.spacingHorizontalM },
  tile: {
    display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, padding: tokens.spacingHorizontalL, minWidth: 0,
    borderRadius: tokens.borderRadiusXLarge, backgroundColor: tokens.colorNeutralBackground1, boxShadow: tokens.shadow4,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  tileHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3, "& svg": { fontSize: "16px" } },
  value: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightBold, fontVariantNumeric: "tabular-nums" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  wide: { gridColumn: "1 / -1" },
  graph: { height: "220px" },
  scroll: { overflowX: "auto" },
  table: {
    width: "100%", borderCollapse: "collapse", fontSize: tokens.fontSizeBase200, fontVariantNumeric: "tabular-nums",
    "& th, & td": { textAlign: "left", padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, whiteSpace: "nowrap" },
    "& th": { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
    "& td.num, & th.num": { textAlign: "right" },
    "& tbody tr:nth-child(even)": { backgroundColor: tokens.colorNeutralBackground2 },
  },
  teamRow: { "& td": { fontWeight: tokens.fontWeightSemibold, backgroundColor: tokens.colorNeutralBackground3 } },
  agentName: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, "& svg": { fontSize: "16px" } },
  bars: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  bar: { display: "grid", gridTemplateColumns: "minmax(110px, 1fr) 3fr 3em", alignItems: "center", gap: tokens.spacingHorizontalS },
  track: { height: "10px", borderRadius: tokens.borderRadiusCircular, backgroundColor: tokens.colorNeutralBackground4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: tokens.borderRadiusCircular, backgroundColor: tokens.colorBrandBackground, transitionProperty: "width", transitionDuration: "400ms" },
  facts: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: tokens.spacingHorizontalM },
  fact: { display: "flex", flexDirection: "column" },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  link: { color: tokens.colorBrandForegroundLink },
});

interface DashboardProps {
  /** Injected by tests; the browser's EventSource is used otherwise. */
  eventSource?: new (url: string) => EventSource;
  retryMs?: number;
  pollMs?: number;
}

function Tile({ icon, label, value, detail, testId }: { icon: ReactNode; label: string; value: ReactNode; detail?: ReactNode; testId: string }) {
  const styles = useStyles();
  return (
    <section className={styles.tile} aria-label={label} data-testid={testId}>
      <span className={styles.tileHead}>{icon}<Text size={200}>{label}</Text></span>
      <span className={styles.value}>{value}</span>
      {detail !== undefined && <Text size={200} className={styles.muted}>{detail}</Text>}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.fact}>
      <Text size={200} className={styles.muted}>{label}</Text>
      <Text weight="semibold" size={400}>{value}</Text>
    </div>
  );
}

/** Horizontal bars, one per row, scaled to the largest. */
function Bars({ rows, label, empty }: { rows: { key: string; label: ReactNode; value: number; shown?: string }[]; label: string; empty: string }) {
  const styles = useStyles();
  if (rows.length === 0) return <Text size={200} className={styles.muted}>{empty}</Text>;
  const peak = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className={styles.bar} data-testid={`bar-${row.key}`}>
          <Text size={200}>{row.label}</Text>
          <span className={styles.track} aria-hidden><span className={styles.fill} style={{ display: "block", width: `${(row.value / peak) * 100}%` }} /></span>
          <Text size={200} weight="semibold" style={{ textAlign: "right" }}>{row.shown ?? row.value}</Text>
        </li>
      ))}
    </ul>
  );
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Unified analytics: the match, the teams of analyst agents, the players, the audience, the broadcasts and
 * auto live, on one page, each kept live from the stream the server already sends: /dashboard.
 */
export function DashboardPage({ eventSource, retryMs = 2000, pollMs = 3000 }: DashboardProps) {
  const styles = useStyles();
  const [profile] = useState<ViewerProfile>(loadProfile);
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  useCurrentMatch(profile, { eventSource, retryMs, pollMs });
  const match = useMatch((state) => state.data);
  const connection = useMatch((state) => state.connection);
  const { doc: output, offset } = useLiveDocument<Output>(OUTPUT_STREAM, eventSource, retryMs);
  const { doc: broadcasts } = useLiveDocument<Broadcasts>(BROADCASTS_STREAM, eventSource, retryMs);
  const { doc: fans } = useLiveDocument<FanZone>(FANS_STREAM, eventSource, retryMs);
  const { doc: autolive } = useLiveDocument<AutoLive>(AUTOLIVE_STREAM, eventSource, retryMs);
  const now = useNow(1000) + offset;

  useEffect(() => {
    fetchAgents().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  const work = useMemo(() => agentWork(match.runs), [match.runs]);
  const teams = useMemo(() => teamWork(work), [work]);
  const mix = useMemo(() => highlightMix(match.highlights), [match.highlights]);
  const players = useMemo(() => topPlayers(match.players), [match.players]);
  const shows = useMemo(() => (broadcasts ? broadcastSummary(broadcasts.broadcasts, now) : null), [broadcasts, now]);
  const audience = useMemo(() => (fans ? audienceSummary(fans) : null), [fans]);

  const status = match.status;
  const stats = match.stats;
  const prediction = match.prediction;
  const colors = colorsOf(status);
  const names = namesOf(status);
  const enabled = (agentId: AgentId) => catalog?.agents.find((agent) => agent.id === agentId)?.enabled ?? true;
  const working = catalog ? catalog.agents.filter((agent) => agentState(agent, match) === "working").length : 0;
  const totalRuns = work.reduce((sum, agent) => sum + agent.runs, 0);
  const xMax = Math.max(90, match.minute);
  const minutes = match.series.map((point) => point.minute);

  const statRows: CompareRow[] = stats ? [
    { id: "possession", label: "Possession", home: stats.home.possession, away: stats.away.possession, suffix: "%" },
    { id: "shots", label: "Shots", home: stats.home.shots, away: stats.away.shots },
    { id: "on_target", label: "On target", home: stats.home.shots_on_target, away: stats.away.shots_on_target },
    { id: "xg", label: "Expected goals", home: stats.home.xg, away: stats.away.xg, digits: 2 },
    { id: "passes", label: "Passes", home: stats.home.passes, away: stats.away.passes },
    { id: "pass_accuracy", label: "Pass accuracy", home: stats.home.pass_accuracy, away: stats.away.pass_accuracy, suffix: "%" },
    { id: "fouls", label: "Fouls", home: stats.home.fouls, away: stats.away.fouls },
    { id: "cards", label: "Cards", home: stats.home.yellow_cards + stats.home.red_cards, away: stats.away.yellow_cards + stats.away.red_cards },
  ] : [];

  return (
    <div className={styles.app}>
      <AppNav current="dashboard" output={output} now={now} />
      <main className={styles.page}>
        <div className={styles.head}>
          <Text as="h1" size={700} weight="semibold">Unified analytics</Text>
          <Text className={styles.muted}>The match, the analyst teams, the audience and the broadcasts, live in one place.</Text>
          <Badge appearance="tint" color={connection === "live" ? "success" : "subtle"} data-testid="dashboard-connection">
            {connection === "live" ? "Match feed live" : connection === "idle" ? "No match playing" : "Connecting to the match"}
          </Badge>
        </div>

        <div className={styles.tiles}>
          <Tile testId="kpi-score" icon={<SportSoccerRegular />} label="Score"
            value={status ? `${status.score_home} - ${status.score_away}` : "–"}
            detail={status ? `${status.home.short_name} v ${status.away.short_name} · ${MATCH_STATE[status.state]} · ${Math.max(status.minute, match.minute)}'` : "No match yet"} />
          <Tile testId="kpi-win" icon={<DataTrendingRegular />} label={`${names.home} win chance`}
            value={prediction ? percent(prediction.win_home) : "–"}
            detail={prediction ? `Draw ${percent(prediction.draw)} · ${names.away} ${percent(prediction.win_away)}` : "Waiting for the Forecast Team"} />
          <Tile testId="kpi-xg" icon={<TrophyRegular />} label="Expected goals"
            value={stats ? `${stats.home.xg.toFixed(2)} - ${stats.away.xg.toFixed(2)}` : "–"}
            detail={stats ? `${stats.home.shots + stats.away.shots} shots, ${stats.home.shots_on_target + stats.away.shots_on_target} on target` : "No stats yet"} />
          <Tile testId="kpi-agents" icon={<PeopleTeamRegular />} label="Analyst agents at work"
            value={catalog ? `${working} / ${catalog.agents.length}` : "–"}
            detail={`${plural(totalRuns, "recent run")} across ${ANALYST_TEAMS.length} teams`} />
          <Tile testId="kpi-highlights" icon={<FlashRegular />} label="Highlights found"
            value={match.highlights.length}
            detail={`${match.highlights.filter((highlight) => highlight.kind === "hidden").length} hidden · ${match.moments.length} key moments`} />
          <Tile testId="kpi-audience" icon={<PeopleAudienceRegular />} label="Fan comments"
            value={audience ? audience.comments : "–"}
            detail={audience ? `${audience.perMinute.toFixed(1)} a minute · ${percent(audience.mood.positive)} positive${audience.demo ? " · Demo" : ""}` : "Fan zone not reached"} />
          <Tile testId="kpi-broadcasts" icon={<VideoRegular />} label="Time on air"
            value={shows ? duration(shows.onAirS) : "–"}
            detail={shows ? `${plural(shows.total, "broadcast")} · ${shows.live} live now` : "Broadcasts not reached"} />
          <Tile testId="kpi-autolive" icon={<BotSparkleRegular />} label="Auto live"
            value={autolive ? (autolive.settings.enabled ? "On" : "Off") : "–"}
            detail={autolive ? `${plural(autolive.matches_started ?? 0, "match", "matches")} started · ${plural(autolive.stream_restarts ?? 0, "restart")}` : "Auto live not reached"} />
        </div>

        <section className={styles.section} aria-label="Match analytics">
          <Text as="h2" size={500} weight="semibold">Match</Text>
          <div className={styles.grid}>
            <Card title="Win probability" testId="chart-win">
              {match.series.some((point) => point.winHome !== null) ? (
                <div className={styles.graph}>
                  <LineGraph label="Win probability" xs={minutes} xMax={xMax} yMin={0} yMax={100} format={(value) => `${value.toFixed(0)}%`} surface={tokens.colorNeutralBackground1}
                    lines={[
                      { id: "home", label: names.home, color: colors.home, values: match.series.map((point) => (point.winHome === null ? null : point.winHome * 100)) },
                      { id: "draw", label: "Draw", color: NEUTRAL, values: match.series.map((point) => (point.draw === null ? null : point.draw * 100)) },
                      { id: "away", label: names.away, color: colors.away, values: match.series.map((point) => (point.winAway === null ? null : point.winAway * 100)) },
                    ]} />
                </div>
              ) : <Text size={200} className={styles.muted}>The Forecast Team's odds are drawn here minute by minute.</Text>}
            </Card>
            <Card title="Expected goals and momentum" testId="chart-xg">
              {match.series.some((point) => point.xgHome !== null) ? (
                <>
                  <div className={styles.graph}>
                    <LineGraph label="Expected goals" xs={minutes} xMax={xMax} yMin={0} yMax={Math.max(1, ...match.series.flatMap((point) => [point.xgHome ?? 0, point.xgAway ?? 0]))}
                      format={(value) => value.toFixed(2)} surface={tokens.colorNeutralBackground1}
                      lines={[
                        { id: "xg-home", label: names.home, color: colors.home, values: match.series.map((point) => point.xgHome) },
                        { id: "xg-away", label: names.away, color: colors.away, values: match.series.map((point) => point.xgAway) },
                      ]} />
                  </div>
                  <div className={styles.graph}>
                    <LineGraph label={`Momentum (above the line: ${names.home})`} xs={minutes} xMax={xMax} yMin={-1} yMax={1} baseline={0}
                      format={(value) => value.toFixed(2)} surface={tokens.colorNeutralBackground1}
                      lines={[{ id: "momentum", label: "Momentum", color: tokens.colorBrandBackground, values: match.series.map((point) => point.momentum) }]} />
                  </div>
                </>
              ) : <Text size={200} className={styles.muted}>Expected goals and momentum are drawn here once the match has stats.</Text>}
            </Card>
            <Card title="Team stats" testId="card-team-stats">
              {stats ? <CompareBars rows={statRows} colors={colors} names={names} /> : <Text size={200} className={styles.muted}>No stats yet.</Text>}
            </Card>
            <Card title="Tactics" testId="card-tactics-summary">
              {match.tactics ? (
                <>
                  <Text>{match.tactics.summary}</Text>
                  <Badge appearance="outline">Rhythm: {match.tactics.rhythm}</Badge>
                  <CompareBars colors={colors} names={names} rows={[
                    { id: "pressure", label: "Pressure", home: match.tactics.home.pressure, away: match.tactics.away.pressure },
                    { id: "tempo", label: "Tempo", home: match.tactics.home.tempo, away: match.tactics.away.tempo, digits: 1 },
                    { id: "tilt", label: "Field tilt", home: match.tactics.home.field_tilt, away: match.tactics.away.field_tilt },
                  ]} />
                  {prediction && (
                    <ShareBar label="Next goal" parts={[
                      { id: "home", label: `${names.home} next goal`, value: prediction.next_goal_home, color: colors.home },
                      { id: "none", label: "No goal", value: Math.max(0, 1 - prediction.next_goal_home - prediction.next_goal_away), color: NEUTRAL },
                      { id: "away", label: `${names.away} next goal`, value: prediction.next_goal_away, color: colors.away },
                    ]} />
                  )}
                </>
              ) : <Text size={200} className={styles.muted}>The Match Reading Team's tactics appear here.</Text>}
            </Card>
          </div>
        </section>

        <section className={styles.section} aria-label="Analyst team analytics">
          <Text as="h2" size={500} weight="semibold">Teams of analyst agents</Text>
          <div className={styles.grid}>
            <Card title="Work by team" testId="card-team-work">
              <Bars label="Runs by team" empty="No work yet."
                rows={teams.filter((team) => team.runs > 0).map((team) => ({ key: team.team, label: team.name, value: team.runs }))} />
            </Card>
            <Card title="Highlights by kind" testId="card-highlight-mix">
              <Bars label="Highlights by kind" empty="The Story Team's highlights are counted here."
                rows={mix.map((count) => ({ key: count.key, label: HIGHLIGHT_LABELS[count.key] ?? count.key, value: count.count }))} />
            </Card>
            <div className={styles.wide}>
              <Card title="Every agent" testId="card-agent-table" extra={<Text size={200} className={styles.muted}>Over the last {plural(match.runs.length, "run")}</Text>}>
                <div className={styles.scroll}>
                  <table className={styles.table} aria-label="Agent analytics">
                    <thead>
                      <tr><th>Agent</th><th>State</th><th className="num">Runs</th><th className="num">Items made</th><th className="num">Average</th><th className="num">Slowest</th><th className="num">By a model</th><th className="num">Last run</th></tr>
                    </thead>
                    <tbody>
                      {ANALYST_TEAMS.map((team) => {
                        const total = teams.find((one) => one.team === team.id)!;
                        return [
                          <tr key={team.id} className={styles.teamRow} data-testid={`row-team-${team.id}`}>
                            <td colSpan={2}>{team.name}</td><td className="num">{total.runs}</td><td className="num">{total.produced}</td>
                            <td className="num">{total.runs ? `${total.avgMs.toFixed(1)} ms` : "–"}</td><td colSpan={3} />
                          </tr>,
                          ...work.filter((agent) => agent.team === team.id).map((agent) => (
                            <tr key={agent.agent} data-testid={`row-agent-${agent.agent}`}>
                              <td><a className={mergeClasses(styles.agentName, styles.link)} href="/match">{AGENT_ICONS[agent.agent]}{agent.name}</a></td>
                              <td>{enabled(agent.agent) ? "On" : "Off"}</td>
                              <td className="num">{agent.runs}</td>
                              <td className="num">{agent.produced}</td>
                              <td className="num">{agent.runs ? `${agent.avgMs.toFixed(1)} ms` : "–"}</td>
                              <td className="num">{agent.runs ? `${agent.maxMs.toFixed(1)} ms` : "–"}</td>
                              <td className="num">{agent.runs ? percent(agent.modelShare) : "–"}</td>
                              <td className="num">{agent.lastMinute === null ? "–" : `${agent.lastMinute}'`}</td>
                            </tr>
                          )),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Player analytics">
          <Text as="h2" size={500} weight="semibold">Players</Text>
          <Card title="Best rated so far" testId="card-players">
            {players.length === 0 ? <Text size={200} className={styles.muted}>The Player Tracking Agent's numbers appear here.</Text> : (
              <div className={styles.scroll}>
                <table className={styles.table} aria-label="Player analytics">
                  <thead>
                    <tr><th>Player</th><th>Team</th><th>Pos</th><th className="num">Rating</th><th className="num">Goals</th><th className="num">xG</th><th className="num">Shots</th><th className="num">Passes</th><th className="num">Pass %</th><th className="num">Touches</th></tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.player_id} data-testid={`row-player-${player.player_id}`}>
                        <td>{player.number}. {player.name}</td><td>{names[player.team]}</td><td>{player.position}</td>
                        <td className="num">{player.rating.toFixed(1)}</td><td className="num">{player.goals}</td><td className="num">{player.xg.toFixed(2)}</td>
                        <td className="num">{player.shots}</td><td className="num">{player.passes}</td><td className="num">{player.pass_accuracy.toFixed(0)}%</td><td className="num">{player.touches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        <section className={styles.section} aria-label="Audience analytics">
          <Text as="h2" size={500} weight="semibold">Audience</Text>
          {!audience ? <Text size={200} className={styles.muted}>The fan zone has not been reached yet.</Text> : (
            <div className={styles.grid}>
              <Card title="Mood" testId="card-mood" extra={audience.demo ? <Badge appearance="outline">Demo</Badge> : undefined}>
                {audience.comments === 0 ? <Text size={200} className={styles.muted}>No comments yet.</Text> : (
                  <ShareBar label="Fan mood" parts={[
                    { id: "positive", label: "Positive", value: audience.mood.positive, color: tokens.colorPaletteGreenBackground3 },
                    { id: "neutral", label: "Neutral", value: audience.mood.neutral, color: NEUTRAL },
                    { id: "negative", label: "Negative", value: audience.mood.negative, color: tokens.colorPaletteRedBackground3 },
                  ]} />
                )}
                <div className={styles.facts}>
                  <Fact label="Comments" value={audience.comments} />
                  <Fact label="A minute" value={audience.perMinute.toFixed(1)} />
                  <Fact label="Likes" value={audience.likes} />
                  <Fact label="Superchats" value={audience.superchats} />
                </div>
                {audience.raised.length > 0 && (
                  <Text size={200}>Raised: {audience.raised.map((one) => `${one.amount.toFixed(2)} ${one.currency}`).join(" · ")}</Text>
                )}
              </Card>
              <Card title="Where fans are" testId="card-platforms">
                <Bars label="Comments by platform" empty="No comments yet."
                  rows={audience.platforms.map((one) => ({ key: `platform-${one.key}`, label: PLATFORM_LABELS[one.key] ?? one.key, value: one.count }))} />
              </Card>
              <Card title="What fans talk about" testId="card-topics">
                <Bars label="Topics" empty="Topics appear once fans start talking."
                  rows={audience.topics.map((topic) => ({ key: `topic-${topic.label}`, label: topic.label, value: topic.count }))} />
                {audience.poll && (
                  <Text size={200} data-testid="poll-summary">
                    Poll{audience.poll.open ? " (open)" : ""}: {audience.poll.question} · {plural(audience.poll.votes, "vote")}{audience.poll.leader ? ` · leading: ${audience.poll.leader}` : ""}
                  </Text>
                )}
              </Card>
            </div>
          )}
        </section>

        <section className={styles.section} aria-label="Broadcast analytics">
          <Text as="h2" size={500} weight="semibold">Broadcasts</Text>
          {!shows || !broadcasts ? <Text size={200} className={styles.muted}>The broadcasts have not been reached yet.</Text> : (
            <div className={styles.grid}>
              <Card title="Output" testId="card-broadcast-summary">
                <div className={styles.facts}>
                  <Fact label="Broadcasts" value={shows.total} />
                  <Fact label="Live now" value={shows.live} />
                  <Fact label="Sessions" value={shows.sessions} />
                  <Fact label="On air" value={duration(shows.onAirS)} />
                  <Fact label="Destinations reached" value={shows.destinations ? `${shows.reached} / ${shows.destinations}` : "–"} />
                  <Fact label="Recordings" value={shows.recordings ? `${shows.recordings} · ${bytes(shows.recordingBytes)}` : "0"} />
                  <Fact label="Reels ready" value={`${shows.readyReels} / ${shows.reels}`} />
                  <Fact label="Reels edited" value={shows.editedReels} />
                </div>
              </Card>
              <Card title="Moments caught on air" testId="card-broadcast-moments">
                <Bars label="Moments by kind" empty="Goals, cards and big chances are counted here once a broadcast catches them."
                  rows={shows.moments.map((count) => ({ key: `moment-${count.key}`, label: MOMENT_LABELS[count.key], value: count.count }))} />
              </Card>
              <div className={styles.wide}>
                <Card title="Recent broadcasts" testId="card-broadcast-list">
                  {broadcasts.broadcasts.length === 0 ? <Text size={200} className={styles.muted}>No broadcasts yet.</Text> : (
                    <div className={styles.scroll}>
                      <table className={styles.table} aria-label="Broadcast analytics">
                        <thead>
                          <tr><th>Broadcast</th><th>State</th><th>Score</th><th className="num">On air</th><th className="num">Moments</th><th className="num">Reels</th></tr>
                        </thead>
                        <tbody>
                          {[...broadcasts.broadcasts].sort((a, b) => b.created_at - a.created_at).slice(0, 10).map((broadcast) => (
                            <tr key={broadcast.id} data-testid={`row-broadcast-${broadcast.id}`}>
                              <td><a className={styles.link} href={broadcastPath(broadcast.id)}>{broadcast.title}</a></td>
                              <td><Badge appearance="tint" color={STATE[broadcast.state].color}>{STATE[broadcast.state].label}</Badge></td>
                              <td>{broadcast.stats.score ? `${broadcast.stats.score.home} ${broadcast.stats.score.score_home} - ${broadcast.stats.score.score_away} ${broadcast.stats.score.away}` : "–"}</td>
                              <td className="num">{duration(onAir(broadcast, now))}</td>
                              <td className="num">{broadcast.moments.length}</td>
                              <td className="num">{broadcast.reels.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
