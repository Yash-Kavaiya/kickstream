import { Badge, Button, makeStyles, MessageBar, MessageBarBody, Switch, Text, tokens } from "@fluentui/react-components";
import {
  BotSparkleRegular, ChatSparkleRegular, NextRegular, OpenRegular, Speaker2Regular, SpeakerMuteRegular, WindowNewRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { nextScene, sayNow, saveAutoLiveSettings } from "../../autolive/api";
import { captionOf } from "../../autolive/caption";
import { AutoLiveStage } from "../../autolive/AutoLiveStage";
import type { SpeakerDeps } from "../../autolive/speaker";
import { useAutoLiveVoice } from "../../autolive/useAutoLiveVoice";
import type { AutoLive, AutoLiveSettings, Output } from "../../contracts";
import { programAudio } from "../capture";
import type { ProgramData } from "../elements";
import { CANVAS } from "../geometry";

/** The preview's width inside the tool panel, in screen pixels. */
const PREVIEW_WIDTH = 304;

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  preview: {
    width: `${PREVIEW_WIDTH}px`, height: `${Math.round((PREVIEW_WIDTH * CANVAS.height) / CANVAS.width)}px`, overflow: "hidden",
    borderRadius: tokens.borderRadiusMedium, backgroundColor: "#000000", boxShadow: tokens.shadow4,
  },
  muted: { color: tokens.colorNeutralForeground3 },
});

interface AutoLiveToolProps {
  /** Auto live's document, or null while it loads. */
  doc: AutoLive | null;
  data: ProgramData;
  /** The server's clock, Unix seconds. */
  now: number;
  output: Output | null;
  /** Sends one change and applies auto live's answer; true when it was accepted. */
  onRun(request: () => Promise<AutoLive>): Promise<boolean>;
  /** The newest match narrative, read out when the commentary is heard here. */
  narrative: { id: string; text: string } | null;
  speech?: Partial<SpeakerDeps>;
}

function nextScreenText(doc: AutoLive, now: number): string {
  if (!doc.settings.enabled) return "Auto live is off.";
  if (doc.next_at == null) return "Screens change by hand.";
  const left = Math.max(0, Math.round(doc.next_at - now));
  return `Next screen in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}.`;
}

/** The studio's Auto live tool: turn the self-running channel on or off, watch it, and steer it, without leaving the studio. */
export function AutoLiveTool({ doc, data, now, output, onRun, narrative, speech }: AutoLiveToolProps) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const { spoken } = useAutoLiveVoice(doc, narrative, { on: sound, stream: false, monitor: true, deps: speech });

  if (!doc) return <Text>Loading auto live…</Text>;
  const s = doc.settings;
  const onAir = doc.scenes.find((scene) => scene.id === doc.scene_id);
  const hasDestination = output?.destinations.some((item) => item.enabled) ?? false;

  const attempt = async (request: () => Promise<AutoLive>) => {
    setBusy(true);
    try {
      await onRun(request);
    } finally {
      setBusy(false);
    }
  };
  const save = (patch: Partial<AutoLiveSettings>) => void attempt(() => saveAutoLiveSettings({ ...s, ...patch }));
  const turnSoundOn = async () => {
    try {
      const context = programAudio().context;
      if (context.state === "suspended") await context.resume();
    } catch {
      // No Web Audio: the browser's voice still speaks.
    }
    setSound(true);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <Badge appearance="filled" color={s.enabled ? "danger" : "informative"} icon={<BotSparkleRegular />}>
          {s.enabled ? "Auto live on" : "Auto live off"}
        </Badge>
        {onAir && <Text size={200}>On screen: {onAir.name}</Text>}
      </div>

      <div className={styles.preview} role="img" aria-label="Auto live preview">
        <AutoLiveStage doc={doc} data={data} now={now} scale={PREVIEW_WIDTH / CANVAS.width}
          caption={captionOf(doc, now, spoken.text, !sound)} speaking={spoken.text !== null} />
      </div>
      <Text size={200} className={styles.muted}>{nextScreenText(doc, now)}</Text>
      {doc.problem && <MessageBar intent="warning"><MessageBarBody>{doc.problem}</MessageBarBody></MessageBar>}

      <Switch label="Auto live" checked={s.enabled} disabled={busy} onChange={(_, value) => save({ enabled: value.checked })} />
      <Text size={200} className={styles.muted}>
        Rotates {s.scenes.length} screens with live AI commentary and keeps a match playing, with no one in the chair.
      </Text>
      <Switch label="Stream 24/7" checked={s.stream} disabled={busy || (!s.stream && !hasDestination)}
        onChange={(_, value) => save({ stream: value.checked })} />
      <Text size={200} className={styles.muted}>
        {hasDestination || s.stream
          ? "Sends auto live to the destinations in the Stream tool and starts it again if it stops. It waits while the studio is on air."
          : "Turn on a destination in the Stream tool first."}
      </Text>

      <div className={styles.row}>
        <Button size="small" icon={<NextRegular />} disabled={busy} onClick={() => void attempt(nextScene)}>Next screen</Button>
        <Button size="small" icon={<ChatSparkleRegular />} disabled={busy || !s.enabled || !s.commentary}
          onClick={() => void attempt(sayNow)}>Say something now</Button>
        {sound
          ? <Button size="small" icon={<SpeakerMuteRegular />} onClick={() => setSound(false)}>Mute</Button>
          : <Button size="small" icon={<Speaker2Regular />} onClick={() => void turnSoundOn()}>Hear the commentary</Button>}
      </div>
      <div className={styles.row}>
        <Button as="a" href="/live" icon={<OpenRegular />}>Open auto live</Button>
        <Button as="a" href="/live?output" target="_blank" rel="noopener" icon={<WindowNewRegular />}>Watch full screen</Button>
      </div>
    </div>
  );
}
