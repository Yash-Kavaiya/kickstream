import { Badge, Button, makeStyles, mergeClasses, MessageBar, MessageBarBody, Spinner, Text, Textarea, tokens } from "@fluentui/react-components";
import { ChatRegular, PlugConnectedRegular, SendRegular } from "@fluentui/react-icons";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AgentSpec, CopilotAnswer } from "../contracts";
import { askCopilot } from "../copilot/api";
import { CopilotMarkdown } from "../copilot/Markdown";
import { AGENT_ICONS, Card } from "./cards";

const MAX_QUESTION = 300;

/** What to ask each agent first. */
const STARTERS: Record<AgentSpec["id"], string[]> = {
  event_interpreter: ["What were the latest plays?", "Which side has the ball most?"],
  tactical_analyst: ["What are the tactics?", "Who is pressing higher?"],
  prediction: ["Who will win from here?", "Who scores next?"],
  explainability: ["Why does the latest change matter?", "Explain the momentum."],
  visualization: ["Where is the danger coming from?", "What is the 3D pitch showing?"],
  player_tracking: ["Who is the best player so far?", "Who has the most touches?"],
  highlights: ["What are the key moments?", "Show a hidden highlight."],
};

interface Turn {
  id: number;
  question: string;
  answer?: CopilotAnswer;
  failure?: string;
}

const useStyles = makeStyles({
  log: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxHeight: "460px", overflowY: "auto", paddingRight: tokens.spacingHorizontalXS },
  question: {
    alignSelf: "flex-end", maxWidth: "80%", padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusXLarge, color: tokens.colorNeutralForegroundOnBrand, backgroundColor: tokens.colorBrandBackground,
    overflowWrap: "anywhere",
  },
  reply: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-start", maxWidth: "92%" },
  avatar: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", flexShrink: 0, fontSize: "16px",
    borderRadius: tokens.borderRadiusCircular, color: tokens.colorBrandForeground1, backgroundColor: tokens.colorBrandBackground2,
  },
  bubble: {
    display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0, padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusXLarge, backgroundColor: tokens.colorNeutralBackground3,
  },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  sources: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  source: { display: "flex", flexDirection: "column", fontSize: tokens.fontSizeBase200 },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  input: { flexGrow: 1 },
});

/** A conversation with one agent: each question is put to it, and it answers from its part of the match and its connectors. */
export function AgentChat({ agent }: { agent: AgentSpec }) {
  const styles = useStyles();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const next = useRef(0);

  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [turns]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const id = (next.current += 1);
    setTurns((current) => [...current, { id, question: text }]);
    setDraft("");
    setBusy(true);
    try {
      const answer = await askCopilot(text, { web: false, agent: agent.id });
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    } catch (caught) {
      const failure = caught instanceof Error ? caught.message : "The agent could not be reached.";
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, failure } : turn)));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(draft);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
    }
  };
  const connectors = (agent.connectors ?? []).filter((connector) => connector.enabled);

  return (
    <Card title={`Chat with the ${agent.name}`} testId="card-chat" extra={<ChatRegular aria-hidden />}>
      <Text size={200} className={styles.muted}>
        Ask the {agent.name} about its part of the match.
        {connectors.length > 0 ? ` It also asks ${connectors.map((connector) => connector.name).join(", ")}.` : ""}
        {agent.custom_instructions ? " It follows your custom instructions." : ""}
      </Text>
      <div ref={log} className={styles.log} role="log" aria-label={`Chat with the ${agent.name}`}>
        {turns.length === 0 && (
          <div className={styles.chips} aria-label="Suggested questions">
            {STARTERS[agent.id].map((starter) => (
              <Button key={starter} size="small" shape="circular" appearance="outline" onClick={() => void ask(starter)}>{starter}</Button>
            ))}
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS }}>
            <Text className={styles.question} data-testid="chat-question">{turn.question}</Text>
            <div className={styles.reply}>
              <span className={styles.avatar} aria-hidden>{AGENT_ICONS[agent.id]}</span>
              <div className={styles.bubble} data-testid="chat-answer">
                {!turn.answer && !turn.failure && <Spinner size="tiny" label={`The ${agent.name} is answering`} />}
                {turn.failure && (
                  <MessageBar intent="error">
                    <MessageBarBody>{turn.failure}</MessageBarBody>
                  </MessageBar>
                )}
                {turn.answer && (
                  <>
                    <CopilotMarkdown text={turn.answer.answer} />
                    {turn.answer.problem && <Text size={200} className={styles.muted} data-testid="chat-problem">{turn.answer.problem}</Text>}
                    {turn.answer.sources.length > 0 && (
                      <ul className={styles.sources} aria-label="Sources">
                        {turn.answer.sources.map((source, index) => (
                          <li key={`${source.url}-${index}`} className={styles.source}>
                            <span className={styles.chips}>
                              {source.kind === "connector" && <Badge size="small" appearance="tint" color="brand" icon={<PlugConnectedRegular />}>Connector</Badge>}
                              {source.kind === "connector" ? <Text size={200} weight="semibold">{source.title}</Text> : (
                                <a href={source.url} target="_blank" rel="noopener noreferrer"><Text size={200} weight="semibold">{source.title}</Text></a>
                              )}
                            </span>
                            <Text size={200} className={styles.muted}>{source.snippet}</Text>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className={styles.chips}>
                      <Badge appearance="outline" size="small">{turn.answer.source === "agent" ? "Written by a model" : "From the match data"}</Badge>
                    </div>
                    {turn === turns[turns.length - 1] && turn.answer.followups.length > 0 && (
                      <div className={styles.chips} aria-label="Suggested questions">
                        {turn.answer.followups.map((followup) => (
                          <Button key={followup} size="small" shape="circular" appearance="outline" onClick={() => void ask(followup)}>{followup}</Button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <Textarea className={mergeClasses(styles.input)} value={draft} maxLength={MAX_QUESTION} rows={2} resize="none"
          aria-label={`Ask the ${agent.name}`} placeholder={`Ask the ${agent.name}…`}
          onChange={(_, data) => setDraft(data.value)} onKeyDown={keyDown} />
        <Button type="submit" appearance="primary" icon={<SendRegular />} disabled={busy || !draft.trim()}>Send</Button>
      </form>
    </Card>
  );
}
