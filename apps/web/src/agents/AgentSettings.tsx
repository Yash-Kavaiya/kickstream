import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, makeStyles, MessageBar,
  MessageBarBody, Switch, Text, Textarea, tokens,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular, EditRegular, PlugConnectedRegular, PlugDisconnectedRegular, TextBulletListSquareEditRegular } from "@fluentui/react-icons";
import { type FormEvent, useEffect, useState } from "react";
import type { AgentCatalog, AgentConnector, AgentSpec, ConnectorCheck } from "../contracts";
import { useCanUseStudio } from "../shell/viewer";
import { addConnector, checkConnector, type ConnectorDraft, editConnector, removeConnector, setAgentInstructions } from "./api";
import { Card } from "./cards";

const MAX_INSTRUCTIONS = 2000;
const MAX_CONNECTORS = 3;

const useStyles = makeStyles({
  muted: { color: tokens.colorNeutralForeground3 },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  grow: { flexGrow: 1 },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  item: {
    display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground3,
  },
  url: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200, overflowWrap: "anywhere", color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  saved: { whiteSpace: "pre-wrap", lineHeight: tokens.lineHeightBase400 },
});

const reasonOf = (caught: unknown) => (caught instanceof Error ? caught.message : "The change was not saved.");

interface Props {
  agent: AgentSpec;
  /** Whether a model writes for the agents; without one, instructions wait until one is set up. */
  model: boolean;
  onCatalog(catalog: AgentCatalog): void;
}

/** Where the agent's own instructions are followed, said plainly, since most agents compute their output. */
function usedFor(agent: AgentSpec): string {
  return agent.id === "explainability"
    ? "A model follows them when it writes this agent's explanations and its chat answers."
    : "A model follows them when it writes this agent's chat answers. What the agent computes from the match stays the same.";
}

/** The studio's own instructions for one agent, on top of what it is built to do. */
export function InstructionsCard({ agent, model, onCatalog }: Props) {
  const styles = useStyles();
  const studio = useCanUseStudio();
  const saved = agent.custom_instructions ?? "";
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => setDraft(saved), [saved, agent.id]);

  const save = async (text: string) => {
    setBusy(true);
    setProblem(null);
    setDone(false);
    try {
      onCatalog(await setAgentInstructions(agent.id, text));
      setDone(true);
    } catch (caught) {
      setProblem(reasonOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Custom instructions" testId="card-instructions" extra={<TextBulletListSquareEditRegular aria-hidden />}>
      <Text size={200} className={styles.muted}>{usedFor(agent)}</Text>
      {!model && (
        <MessageBar intent="info">
          <MessageBarBody>No model is set up, so the agent answers from the match data alone until one is.</MessageBarBody>
        </MessageBar>
      )}
      {studio ? (
        <>
          <Field label={`Your instructions for the ${agent.name}`} hint={`${draft.length} / ${MAX_INSTRUCTIONS}`}
            validationState={draft.length > MAX_INSTRUCTIONS ? "error" : "none"}>
            <Textarea value={draft} resize="vertical" rows={5} placeholder="For example: Answer in two sentences. Always give the minute of each moment."
              onChange={(_, data) => {
                setDraft(data.value);
                setDone(false);
              }} />
          </Field>
          <div className={styles.row}>
            <Button appearance="primary" disabled={busy || draft === saved || draft.length > MAX_INSTRUCTIONS} onClick={() => void save(draft)}>Save instructions</Button>
            <Button disabled={busy || saved === ""} onClick={() => void save("")}>Clear</Button>
            {done && <Text size={200} role="status">Saved</Text>}
          </div>
        </>
      ) : (
        <Text className={styles.saved}>{saved || "None."}</Text>
      )}
      {problem && (
        <MessageBar intent="error">
          <MessageBarBody>{problem}</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}

interface Editing {
  /** The connector being changed, or null for a new one. */
  connector: AgentConnector | null;
}

function ConnectorDialog({ agent, editing, onClose, onCatalog }: { agent: AgentSpec; editing: Editing; onClose(): void; onCatalog(catalog: AgentCatalog): void }) {
  const styles = useStyles();
  const before = editing.connector;
  const [name, setName] = useState(before?.name ?? "");
  const [url, setUrl] = useState(before?.url ?? "https://");
  const [description, setDescription] = useState(before?.description ?? "");
  const [header, setHeader] = useState(before?.header ?? "");
  const [secret, setSecret] = useState("");
  const [clearSecret, setClearSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ field: string | null; message: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const draft: ConnectorDraft = { name, url, description, header: header.trim() || null, enabled: before?.enabled ?? true };
    if (secret) draft.secret = secret;
    else if (clearSecret) draft.secret = "";
    try {
      onCatalog(before ? await editConnector(agent.id, before.id, draft) : await addConnector(agent.id, draft));
      onClose();
    } catch (caught) {
      const field = caught && typeof caught === "object" && "field" in caught ? (caught as { field: string | null }).field : null;
      setProblem({ field, message: reasonOf(caught) });
    } finally {
      setBusy(false);
    }
  };
  const error = (field: string) => (problem?.field === field ? problem.message : undefined);

  return (
    <Dialog open onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <form onSubmit={(event) => void submit(event)}>
          <DialogBody>
            <DialogTitle>{before ? `Edit ${before.name}` : `Connect a service to the ${agent.name}`}</DialogTitle>
            <DialogContent className={styles.form}>
              <Text size={200} className={styles.muted}>
                When the {agent.name} is asked a question, Kickstream POSTs <code>{"{question, agent, agent_name, match_id}"}</code> as JSON to this address
                and uses the answer: a JSON <code>answer</code> or <code>text</code> field, or plain text.
              </Text>
              <Field label="Name" required validationMessage={error("name")}>
                <Input value={name} maxLength={60} onChange={(_, data) => setName(data.value)} />
              </Field>
              <Field label="Address" required hint="https:// address of the service." validationMessage={error("url")}>
                <Input type="url" value={url} onChange={(_, data) => setUrl(data.value)} />
              </Field>
              <Field label="What it provides" hint="Optional. Shown on the agent's page.">
                <Input value={description} maxLength={300} onChange={(_, data) => setDescription(data.value)} />
              </Field>
              <Field label="Key header" hint="Optional, such as X-Api-Key. Left empty, the key is sent as a bearer token." validationMessage={error("header")}>
                <Input value={header} maxLength={60} onChange={(_, data) => setHeader(data.value)} />
              </Field>
              <Field label="Key" hint={before?.has_secret ? "A key is saved. Type a new one to replace it." : "Optional. Kept on the server and never shown again."}>
                <Input type="password" value={secret} autoComplete="off" onChange={(_, data) => setSecret(data.value)} />
              </Field>
              {before?.has_secret && !secret && (
                <Switch checked={clearSecret} label="Remove the saved key" onChange={(_, data) => setClearSecret(data.checked)} />
              )}
              {problem && !["name", "url", "header"].includes(problem.field ?? "") && (
                <MessageBar intent="error">
                  <MessageBarBody>{problem.message}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>Cancel</Button>
              <Button appearance="primary" type="submit" disabled={busy || !name.trim() || !url.trim()}>{before ? "Save" : "Add connector"}</Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

/** The services the studio has connected to one agent, asked whenever the agent is. */
export function ConnectorsCard({ agent, onCatalog }: Omit<Props, "model">) {
  const styles = useStyles();
  const studio = useCanUseStudio();
  const connectors = agent.connectors ?? [];
  const [editing, setEditing] = useState<Editing | null>(null);
  const [checks, setChecks] = useState<Record<string, ConnectorCheck | "checking">>({});
  const [problem, setProblem] = useState<string | null>(null);

  const change = async (work: () => Promise<AgentCatalog>) => {
    setProblem(null);
    try {
      onCatalog(await work());
    } catch (caught) {
      setProblem(reasonOf(caught));
    }
  };
  const check = async (connector: AgentConnector) => {
    setChecks((current) => ({ ...current, [connector.id]: "checking" }));
    try {
      const result = await checkConnector(agent.id, connector.id);
      setChecks((current) => ({ ...current, [connector.id]: result }));
    } catch (caught) {
      setChecks((current) => ({ ...current, [connector.id]: { ok: false, snippet: "", problem: reasonOf(caught), ms: 0, status: null } }));
    }
  };
  const draftOf = (connector: AgentConnector, enabled: boolean): ConnectorDraft => ({
    name: connector.name, url: connector.url, description: connector.description, header: connector.header ?? null, enabled,
  });

  return (
    <Card title="Connectors" testId="card-connectors" extra={<Text size={200} className={styles.muted}>{connectors.length} / {MAX_CONNECTORS}</Text>}>
      <Text size={200} className={styles.muted}>
        Services the {agent.name} asks whenever it is asked a question, such as your own data, odds or a knowledge base. Their answers are cited in its replies.
      </Text>
      {connectors.length === 0 ? <Text size={200}>No connectors yet.</Text> : (
        <ul className={styles.list} aria-label="Connectors">
          {connectors.map((connector) => {
            const result = checks[connector.id];
            return (
              <li key={connector.id} className={styles.item} data-testid={`connector-${connector.id}`}>
                <div className={styles.row}>
                  {connector.enabled ? <PlugConnectedRegular aria-hidden /> : <PlugDisconnectedRegular aria-hidden />}
                  <Text weight="semibold">{connector.name}</Text>
                  {connector.has_secret && <Badge appearance="outline" size="small">Key saved</Badge>}
                  {!connector.enabled && <Badge appearance="tint" color="subtle" size="small">Off</Badge>}
                  <span className={styles.grow} />
                  {studio && (
                    <Switch checked={connector.enabled} aria-label={`${connector.name} on`}
                      onChange={(_, data) => void change(() => editConnector(agent.id, connector.id, draftOf(connector, data.checked)))} />
                  )}
                </div>
                <Text className={styles.url}>{connector.url}</Text>
                {connector.description && <Text size={200}>{connector.description}</Text>}
                {studio && (
                  <div className={styles.row}>
                    <Button size="small" disabled={result === "checking"} onClick={() => void check(connector)}>{result === "checking" ? "Testing…" : "Test"}</Button>
                    <Button size="small" icon={<EditRegular />} onClick={() => setEditing({ connector })}>Edit</Button>
                    <Button size="small" icon={<DeleteRegular />} onClick={() => void change(() => removeConnector(agent.id, connector.id))}>Remove</Button>
                  </div>
                )}
                {result && result !== "checking" && (
                  <MessageBar intent={result.ok ? "success" : "warning"} layout="multiline" data-testid="connector-check">
                    <MessageBarBody>
                      {result.ok ? `Answered in ${result.ms} ms: ${result.snippet}` : `It did not work. ${result.problem ?? ""}`}
                    </MessageBarBody>
                  </MessageBar>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {studio && (
        <div className={styles.row}>
          <Button icon={<AddRegular />} disabled={connectors.length >= MAX_CONNECTORS} onClick={() => setEditing({ connector: null })}>Add connector</Button>
        </div>
      )}
      {problem && (
        <MessageBar intent="error">
          <MessageBarBody>{problem}</MessageBarBody>
        </MessageBar>
      )}
      {editing && <ConnectorDialog agent={agent} editing={editing} onClose={() => setEditing(null)} onCatalog={onCatalog} />}
    </Card>
  );
}
