import type { AgentCatalog, AgentRun, AgentSpec } from "../contracts";
import type { AgentId } from "./api";

export type TeamId = "reading" | "forecast" | "story";

export interface AnalystTeam {
  id: TeamId;
  name: string;
  /** What the team does for the broadcast, in one line. */
  purpose: string;
  members: AgentId[];
}

/**
 * The seven agents work as three teams of analysts: one reads the match as it happens, one looks ahead
 * and says why it matters, and one turns both into what viewers see.
 */
export const ANALYST_TEAMS: readonly AnalystTeam[] = [
  {
    id: "reading", name: "Match Reading Team", purpose: "Reads every play, the tactics and each player as the match happens.",
    members: ["event_interpreter", "tactical_analyst", "player_tracking"],
  },
  {
    id: "forecast", name: "Forecast Team", purpose: "Looks ahead to who wins and what comes next, and explains why it matters.",
    members: ["prediction", "explainability"],
  },
  {
    id: "story", name: "Story Team", purpose: "Turns the analysis into the 3D pitch and the moments worth showing again.",
    members: ["visualization", "highlights"],
  },
];

export const teamOf = (agentId: AgentId): AnalystTeam | undefined => ANALYST_TEAMS.find((team) => team.members.includes(agentId));

/** Each team with the catalogue's agents in it, in the team's order; a team with none of them is left out. */
export function teamsIn(catalog: AgentCatalog): { team: AnalystTeam; agents: AgentSpec[] }[] {
  return ANALYST_TEAMS.map((team) => ({
    team,
    agents: team.members.flatMap((agentId) => catalog.agents.filter((agent) => agent.id === agentId)),
  })).filter(({ agents }) => agents.length > 0);
}

/** Agents in the catalogue that no team lists, so a new agent is still shown. */
export const unteamed = (catalog: AgentCatalog): AgentSpec[] => catalog.agents.filter((agent) => teamOf(agent.id) === undefined);

export const teamRuns = (runs: readonly AgentRun[], team: AnalystTeam) => runs.filter((run) => team.members.includes(run.agent));
