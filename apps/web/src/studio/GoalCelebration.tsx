import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { Banner, MatchStatus } from "../contracts";
import type { MatchData } from "../stream/store";
import type { ProgramData } from "./elements";

const HOLD_MS = 5600;
const QUIET_MS = 7000;

export interface GoalFlash {
  id: string;
  detail: string;
  score: string;
  color: string;
}

const PIECES = [
  { id: "a", left: "6%", delay: "0.05s", color: "#FFB900", drift: "-90px", round: "2px", w: 16, h: 32 },
  { id: "b", left: "12%", delay: "0.22s", color: "#FFFFFF", drift: "40px", round: "50%", w: 18, h: 18 },
  { id: "c", left: "18%", delay: "0s", color: "#00E5FF", drift: "-24px", round: "2px", w: 12, h: 36 },
  { id: "d", left: "26%", delay: "0.36s", color: "#FF2D87", drift: "70px", round: "2px", w: 22, h: 14 },
  { id: "e", left: "34%", delay: "0.12s", color: "#FFB900", drift: "-70px", round: "50%", w: 14, h: 14 },
  { id: "f", left: "41%", delay: "0.28s", color: "#FFFFFF", drift: "18px", round: "2px", w: 14, h: 30 },
  { id: "g", left: "48%", delay: "0.04s", color: "#7CFF6B", drift: "-36px", round: "2px", w: 18, h: 18 },
  { id: "h", left: "55%", delay: "0.44s", color: "#FF2D87", drift: "48px", round: "50%", w: 16, h: 16 },
  { id: "i", left: "63%", delay: "0.16s", color: "#00E5FF", drift: "-16px", round: "2px", w: 10, h: 34 },
  { id: "j", left: "71%", delay: "0.32s", color: "#FFB900", drift: "28px", round: "2px", w: 20, h: 12 },
  { id: "k", left: "78%", delay: "0.08s", color: "#FFFFFF", drift: "-44px", round: "50%", w: 12, h: 12 },
  { id: "l", left: "85%", delay: "0.4s", color: "#FF2D87", drift: "36px", round: "2px", w: 14, h: 28 },
  { id: "m", left: "92%", delay: "0.18s", color: "#00E5FF", drift: "-20px", round: "2px", w: 16, h: 16 },
  { id: "n", left: "22%", delay: "0.5s", color: "#FFFFFF", drift: "12px", round: "50%", w: 10, h: 10 },
  { id: "o", left: "67%", delay: "0.48s", color: "#FFB900", drift: "-28px", round: "2px", w: 24, h: 10 },
  { id: "p", left: "50%", delay: "0.26s", color: "#FFFFFF", drift: "8px", round: "2px", w: 8, h: 40 },
];

function teamName(status: MatchStatus | null, team: "home" | "away"): string {
  return status ? status[team].name : team === "home" ? "Home" : "Away";
}

function playerName(status: MatchStatus | null, team: "home" | "away", playerId: string | null | undefined): string | null {
  if (!status || !playerId) return null;
  return status[team].players.find((player) => player.id === playerId)?.name ?? null;
}

function fromMoment(match: MatchData, id: string): GoalFlash {
  const moment = match.moments.find((item) => item.id === id);
  const status = match.status;
  const team = moment?.team ?? "home";
  const name = playerName(status, team, moment?.player_id);
  const side = teamName(status, team);
  const minute = moment ? `${moment.minute}'` : "";
  return {
    id,
    detail: [minute, name ?? side].filter(Boolean).join("  ·  "),
    score: moment ? `${moment.score_home}  –  ${moment.score_away}` : "",
    color: status ? status[team].color : "#FFB900",
  };
}

function fromBanner(banner: Banner, status: MatchStatus | null): GoalFlash {
  return {
    id: `banner:${banner.id}`,
    detail: banner.text,
    score: status ? `${status.score_home}  –  ${status.score_away}` : "",
    color: "#FFB900",
  };
}

/**
 * A short celebration when a goal arrives. Goals already in the match when the picture
 * opens are not replayed; a goal banner that is on air now still plays, so a capture
 * that opens mid-celebration does not miss it.
 */
export function useGoalFlash(data: ProgramData): GoalFlash | null {
  const [flash, setFlash] = useState<GoalFlash | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const last = useRef(0);
  const moments = data.match.moments;
  const banner = data.studio.banner;
  const match = data.match;

  useEffect(() => {
    const goals = moments.filter((moment) => moment.kind === "goal");
    const bannerGoal = banner?.kind === "goal" ? banner : null;
    const play = (next: GoalFlash) => {
      const now = Date.now();
      if (now - last.current < QUIET_MS) return;
      last.current = now;
      setFlash(next);
    };
    if (seen.current === null) {
      seen.current = new Set(goals.map((moment) => moment.id));
      if (bannerGoal) {
        seen.current.add(`banner:${bannerGoal.id}`);
        play(fromBanner(bannerGoal, match.status));
      }
      return;
    }
    const fresh = goals.find((moment) => !seen.current!.has(moment.id));
    for (const moment of goals) seen.current.add(moment.id);
    if (fresh) {
      play(fromMoment(match, fresh.id));
      return;
    }
    if (bannerGoal && !seen.current.has(`banner:${bannerGoal.id}`)) {
      seen.current.add(`banner:${bannerGoal.id}`);
      play(fromBanner(bannerGoal, match.status));
    }
  }, [moments, banner, match]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return flash;
}

const FILL: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/** A ball into a 3D goal, then the word. It never takes a click. */
export function GoalCelebration({ flash }: { flash: GoalFlash }) {
  return (
    <div data-testid="goal-celebration" aria-hidden
      style={{ ...FILL, zIndex: 60, perspective: "1600px", overflow: "hidden", fontFamily: '"Segoe UI", Arial, sans-serif' }}>
      <style>{CSS}</style>
      <div className="ks-goal-wash" style={{ ...FILL, background: `radial-gradient(ellipse at 50% 42%, ${flash.color}66, rgba(0,0,0,0.62) 72%)` }} />
      <div className="ks-goal-sweep" />
      <div className="ks-goal-light ks-goal-light-left" />
      <div className="ks-goal-light ks-goal-light-right" />
      <div className="ks-goal-burst" style={{ borderColor: flash.color }} />
      {PIECES.map((piece) => (
        <span key={piece.id} className="ks-goal-piece" style={{
          left: piece.left, background: piece.color, animationDelay: piece.delay,
          width: piece.w, height: piece.h, borderRadius: piece.round, ["--drift" as string]: piece.drift,
        }} />
      ))}
      <div className="ks-goal-stage">
        <div className="ks-goal-frame">
          <div className="ks-goal-post ks-goal-post-l" />
          <div className="ks-goal-post ks-goal-post-r" />
          <div className="ks-goal-bar" />
          <div className="ks-goal-net" style={{ borderColor: flash.color }} />
        </div>
        <div className="ks-goal-shadow" />
        <div className="ks-goal-ball" />
      </div>
      <div className="ks-goal-word">
        <div className="ks-goal-title3d">
          <div className="ks-goal-title-back" style={{ color: flash.color }}>GOAL</div>
          <div className="ks-goal-title" style={{ textShadow: `0 22px 48px ${flash.color}` }}>GOAL</div>
        </div>
        {flash.detail && <div className="ks-goal-detail">{flash.detail}</div>}
        {flash.score && <div className="ks-goal-score" style={{ borderColor: flash.color }}>{flash.score}</div>}
      </div>
    </div>
  );
}

const CSS = `
@keyframes ks-goal-wash { 0% { opacity: 0 } 10% { opacity: 1 } 78% { opacity: 1 } 100% { opacity: 0 } }
@keyframes ks-goal-light { 0% { opacity: 0; transform: scaleY(0.4) } 18% { opacity: 0.95; transform: scaleY(1) } 100% { opacity: 0.15 } }
@keyframes ks-goal-sweep { 0% { transform: translateX(-130%); opacity: 0 } 12% { opacity: 1 } 100% { transform: translateX(620%); opacity: 0 } }
@keyframes ks-goal-burst { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2) } 8% { opacity: 0 } 55% { opacity: 0.85; transform: translate(-50%, -50%) scale(1) } 100% { opacity: 0; transform: translate(-50%, -50%) scale(16) } }
@keyframes ks-goal-stage { 0% { transform: rotateY(-26deg) translateZ(-180px) } 100% { transform: rotateY(-12deg) translateZ(30px) } }
@keyframes ks-goal-ball {
  0% { transform: translate3d(-980px, 80px, 40px) rotateZ(0deg) scale(0.45); opacity: 0 }
  8% { opacity: 1 }
  40% { transform: translate3d(-200px, -300px, 80px) rotateZ(180deg) scale(1.08) }
  68% { transform: translate3d(200px, -150px, 20px) rotateZ(320deg) scale(1) }
  100% { transform: translate3d(230px, -130px, 0px) rotateZ(400deg) scale(0.96); opacity: 1 }
}
@keyframes ks-goal-net {
  0%, 72% { transform: translateZ(-36px) scaleX(1); opacity: 0.8 }
  82% { transform: translateZ(-120px) scaleX(1.14) skewX(-7deg); opacity: 1 }
  92% { transform: translateZ(-50px) skewX(4deg) }
  100% { transform: translateZ(-42px) skewX(0deg); opacity: 0.92 }
}
@keyframes ks-goal-shadow {
  0%, 48% { opacity: 0; transform: scale(0.5) }
  66% { opacity: 0.75; transform: scale(1.15) }
  100% { opacity: 0.4; transform: scale(1) }
}
@keyframes ks-goal-word {
  0% { transform: rotateX(80deg) translateY(80px) scale(0.8); opacity: 0 }
  18% { opacity: 0 }
  36% { transform: rotateX(-6deg) translateY(0) scale(1.05); opacity: 1 }
  48% { transform: rotateX(0deg) scale(1) }
  100% { transform: rotateX(0deg) scale(1); opacity: 1 }
}
@keyframes ks-goal-score {
  0%, 28% { transform: rotateX(88deg); opacity: 0 }
  44% { transform: rotateX(0deg); opacity: 1 }
  100% { transform: rotateX(0deg); opacity: 1 }
}
@keyframes ks-goal-piece {
  0% { transform: translate3d(0, -60px, 0) rotateZ(0deg); opacity: 0 }
  14% { opacity: 1 }
  100% { transform: translate3d(var(--drift), 1040px, 120px) rotateZ(280deg); opacity: 0 }
}
.ks-goal-wash { animation: ks-goal-wash 5.4s ease forwards }
.ks-goal-sweep {
  position: absolute; top: 0; bottom: 0; left: 0; width: 16%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent);
  animation: ks-goal-sweep 1.5s ease-in-out 0.15s forwards;
}
.ks-goal-light { position: absolute; top: -8%; width: 22%; height: 78%; filter: blur(10px); transform-origin: top center; animation: ks-goal-light 5.4s ease forwards }
.ks-goal-light-left { left: 6%; background: linear-gradient(180deg, rgba(255,255,255,0.7), transparent 75%) }
.ks-goal-light-right { right: 8%; background: linear-gradient(180deg, rgba(255,185,0,0.62), transparent 75%) }
.ks-goal-burst {
  position: absolute; left: 72%; top: 42%; width: 48px; height: 48px; border-radius: 50%; border: 8px solid #FFFFFF;
  animation: ks-goal-burst 1.35s ease-out forwards;
}
.ks-goal-stage { position: absolute; left: 70%; top: 54%; width: 0; height: 0; transform-style: preserve-3d; animation: ks-goal-stage 5.4s ease forwards }
.ks-goal-frame { position: absolute; left: -30px; top: -300px; width: 520px; height: 340px; transform-style: preserve-3d; transform: rotateY(-22deg) rotateX(10deg) }
.ks-goal-post, .ks-goal-bar {
  position: absolute; background: linear-gradient(90deg, #C5D2DE, #FFFFFF 42%, #8EA2B6);
  box-shadow: 0 0 22px rgba(255,255,255,0.5); transform: translateZ(18px);
}
.ks-goal-post { top: 0; width: 18px; height: 100%; border-radius: 3px }
.ks-goal-post-l { left: 0 }
.ks-goal-post-r { right: 0 }
.ks-goal-bar { left: 0; right: 0; top: 0; height: 18px; border-radius: 3px }
.ks-goal-net {
  position: absolute; left: 12px; right: 12px; top: 18px; bottom: 0;
  background:
    repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,255,255,0.88) 22px 24px),
    repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,0.88) 22px 24px);
  border-bottom: 5px solid rgba(255,255,255,0.75);
  transform-origin: top center; animation: ks-goal-net 2.3s ease forwards;
}
.ks-goal-shadow {
  position: absolute; left: 40px; top: 36px; width: 420px; height: 36px; border-radius: 50%;
  background: rgba(0,0,0,0.55); filter: blur(8px); animation: ks-goal-shadow 2.3s ease forwards;
}
.ks-goal-ball {
  position: absolute; left: -58px; top: -58px; width: 116px; height: 116px; border-radius: 50%;
  background:
    radial-gradient(circle at 32% 28%, #FFFFFF 0 7%, transparent 8%),
    radial-gradient(circle at 70% 68%, rgba(0,0,0,0.35), transparent 42%),
    conic-gradient(from 14deg, #F7F8FA 0 18%, #151515 0 34%, #F7F8FA 0 52%, #151515 0 68%, #F7F8FA 0 84%, #151515 0 100%);
  box-shadow: inset -18px -20px 0 rgba(0,0,0,0.28), inset 10px 12px 0 rgba(255,255,255,0.4), 0 22px 36px rgba(0,0,0,0.5);
  animation: ks-goal-ball 1.85s cubic-bezier(0.18, 0.72, 0.22, 1) forwards;
}
.ks-goal-word {
  position: absolute; left: 72px; top: 150px; width: 980px; display: flex; flex-direction: column; align-items: flex-start; gap: 18px;
  transform-style: preserve-3d; animation: ks-goal-word 5.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.ks-goal-title3d { position: relative; transform-style: preserve-3d }
.ks-goal-title, .ks-goal-title-back {
  font-family: "Arial Black", "Segoe UI", sans-serif; font-size: 188px; font-weight: 900; letter-spacing: 12px; line-height: 0.82;
}
.ks-goal-title { position: relative; color: #FFFFFF }
.ks-goal-title-back { position: absolute; left: 0; top: 0; transform: translate3d(8px, 16px, -40px); opacity: 0.85 }
.ks-goal-detail { font-size: 40px; font-weight: 700; color: #FFFFFF; text-align: left; max-width: 900px; text-shadow: 0 8px 24px rgba(0,0,0,0.65) }
.ks-goal-score {
  padding: 10px 42px; border-radius: 999px; border: 4px solid #FFB900; color: #FFFFFF; font-size: 52px; font-weight: 800;
  background: rgba(8, 12, 20, 0.78); transform-style: preserve-3d; animation: ks-goal-score 5.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.ks-goal-piece { position: absolute; top: 0; animation: ks-goal-piece 3.6s ease-in forwards }
@media (prefers-reduced-motion: reduce) {
  .ks-goal-wash, .ks-goal-sweep, .ks-goal-light, .ks-goal-burst, .ks-goal-stage, .ks-goal-ball, .ks-goal-net, .ks-goal-shadow, .ks-goal-word, .ks-goal-score, .ks-goal-piece { animation: none }
  .ks-goal-word, .ks-goal-score { opacity: 1; transform: none }
  .ks-goal-ball, .ks-goal-piece, .ks-goal-burst, .ks-goal-sweep { opacity: 0 }
}
`;
