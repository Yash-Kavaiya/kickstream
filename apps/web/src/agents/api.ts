import type { AgentCatalog, AgentRun, AgentSpec, ConnectorCheck } from "../contracts";
import { send } from "../studio/api";
import type { MatchData } from "../stream/store";

export type AgentId = AgentSpec["id"];
export type AgentState = "off" | "working" | "idle";

export const fetchAgents = () => send<AgentCatalog>("GET", "/api/agents");
export const setAgentEnabled = (agentId: AgentId, enabled: boolean) =>
  send<AgentCatalog>("PUT", `/api/agents/${encodeURIComponent(agentId)}`, { enabled });

const agentPath = (agentId: AgentId) => `/api/agents/${encodeURIComponent(agentId)}`;
const connectorPath = (agentId: AgentId, connectorId: string) => `${agentPath(agentId)}/connectors/${encodeURIComponent(connectorId)}`;

/** The studio's own instructions for an agent; empty clears them. */
export const setAgentInstructions = (agentId: AgentId, text: string) =>
  send<AgentCatalog>("PUT", `${agentPath(agentId)}/instructions`, { custom_instructions: text });

/** A connector as the studio enters it. `secret` left out keeps the saved one; "" removes it. */
export interface ConnectorDraft {
  name: string;
  url: string;
  description: string;
  header: string | null;
  secret?: string;
  enabled: boolean;
}

export const addConnector = (agentId: AgentId, draft: ConnectorDraft) => send<AgentCatalog>("POST", `${agentPath(agentId)}/connectors`, draft);
export const editConnector = (agentId: AgentId, connectorId: string, draft: ConnectorDraft) =>
  send<AgentCatalog>("PUT", connectorPath(agentId, connectorId), draft);
export const removeConnector = (agentId: AgentId, connectorId: string) => send<AgentCatalog>("DELETE", connectorPath(agentId, connectorId));
export const checkConnector = (agentId: AgentId, connectorId: string) => send<ConnectorCheck>("POST", `${connectorPath(agentId, connectorId)}/check`);

/** The agents that listen to this one. */
export function downstream(catalog: AgentCatalog, agentId: AgentId): AgentSpec[] {
  return catalog.agents.filter((agent) => agent.upstream.includes(agentId));
}

export const runsOf = (runs: readonly AgentRun[], agentId: AgentId) => runs.filter((run) => run.agent === agentId);

/** Working when it has reported within the last match minute of a match still being played. */
export function agentState(agent: AgentSpec, match: MatchData): AgentState {
  if (!agent.enabled) return "off";
  const playing = match.status?.state === "live";
  const latest = match.runs.find((run) => run.agent === agent.id);
  return playing && latest !== undefined && latest.minute >= match.minute - 1 ? "working" : "idle";
}
