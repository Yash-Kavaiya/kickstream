"""Auto live's spoken commentary: a model words it from the facts when one is set up, templates otherwise."""

import asyncio
import logging
import random
import time
from collections import deque
from collections.abc import Callable

from kickstream.autolive.facts import MatchFacts, pct
from kickstream.autolive.languages import PHRASES, known
from kickstream.contracts import AutoLiveScene, FanZone
from kickstream.ports.commentary import CommentaryContext, CommentaryWriter

log = logging.getLogger(__name__)
MAX_CHARS = 600

_AGENT_NAMES = {
    "interpreter": "the Event Interpreter",
    "tactics": "the Tactical Analyst",
    "prediction": "the Prediction Agent",
    "explainability": "the Explainability Agent",
    "visualization": "the Visualization Agent",
    "tracking": "the Player Tracking Agent",
    "highlights": "the Highlights Agent",
}
_OPENINGS = ("Now on screen: {name}.", "Let's go to {name}.", "Here's {name}.", "Over to {name}.")


def _sentence(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    return text if text[-1] in ".!?" else text + "."


def _join(*parts: str | None) -> str:
    return " ".join(_sentence(part) for part in parts if part)


def _stats_line(f: MatchFacts) -> str | None:
    if f.stats is None:
        return None
    h, a = f.stats.home, f.stats.away
    return (
        f"{f.name('home')} have {h.xg:.2f} expected goals from {h.shots} shots, "
        f"{f.name('away')} {a.xg:.2f} from {a.shots}"
    )


def _possession_line(f: MatchFacts) -> str | None:
    if f.stats is None:
        return None
    h, a = f.stats.home, f.stats.away
    side = "home" if h.possession >= a.possession else "away"
    share = max(h.possession, a.possession)
    accuracy = (h if side == "home" else a).pass_accuracy
    return f"{f.name(side)} have {share:.0f} percent of the ball, completing {accuracy:.0f} percent of their passes"


def _prediction_line(f: MatchFacts) -> str | None:
    p = f.prediction
    if p is None:
        return None
    return (
        f"the Prediction Agent makes it {f.name('home')} {pct(p.win_home)}, the draw {pct(p.draw)}, "
        f"{f.name('away')} {pct(p.win_away)}"
    )


def _next_goal_line(f: MatchFacts) -> str | None:
    p = f.prediction
    if p is None:
        return None
    side = "home" if p.next_goal_home >= p.next_goal_away else "away"
    chance = max(p.next_goal_home, p.next_goal_away)
    return f"{f.name(side)} are likelier to score in the next ten minutes, at {pct(chance)}"


def _tactics_line(f: MatchFacts) -> str | None:
    t = f.tactics
    if t is None:
        return None
    side = next((side for side in ("home", "away") if f.patterns(side)), None)
    played = f"{f.name(side)} are going with {f.patterns(side)[0]}" if side else f"the rhythm is {t.rhythm}"
    return _join(t.summary, played)


def _momentum_line(f: MatchFacts) -> str | None:
    if f.stats is None:
        return None
    m = f.stats.momentum
    if abs(m) < 0.15:
        return "momentum is evenly balanced right now"
    return f"{f.name('home' if m > 0 else 'away')} have the upper hand in momentum at the moment"


def _player_line(f: MatchFacts) -> str | None:
    player = f.top_player()
    if player is None:
        return None
    goals = f", with {player.goals} goal{'s' if player.goals != 1 else ''}" if player.goals else ""
    return (
        f"the standout so far is {player.name} of {f.name(player.team)}, rated {player.rating:.1f}, "
        f"{player.touches} touches{goals}"
    )


def _explanation_line(f: MatchFacts) -> str | None:
    e = f.explanation
    return None if e is None else _join(e.headline, e.why)


def _moment_line(f: MatchFacts) -> str | None:
    return f"the latest big moment was {f.moment(f.moments[-1])}" if f.moments else None


def _narrative_line(f: MatchFacts) -> str | None:
    return f.narratives[-1].text if f.narratives else None


def _highlight_line(f: MatchFacts) -> str | None:
    if not f.highlights:
        return None
    h = f.highlights[-1]
    kind = "a hidden highlight" if h.kind == "hidden" else "a key highlight"
    return f"the Highlights Agent flags {kind}: {h.title}. {h.reason}"


def _fans_line(fans: FanZone | None) -> str | None:
    if fans is None or not fans.summary.total:
        return None
    poll = f" The poll asks: {fans.poll.question}" if fans.poll is not None else ""
    return fans.summary.text + poll


def _lines_for(scene: AutoLiveScene, f: MatchFacts, fans: FanZone | None) -> list[str | None]:
    """What each screen talks about, best first."""
    by_scene: dict[str, list[str | None]] = {
        "welcome": [_moment_line(f), _prediction_line(f)],
        "live-match": [_narrative_line(f), _moment_line(f), _momentum_line(f)],
        "score-centre": [_stats_line(f), _possession_line(f)],
        "stadium-3d": [_possession_line(f), _next_goal_line(f)],
        "pressure-map": [_tactics_line(f), _momentum_line(f)],
        "momentum": [_momentum_line(f), _explanation_line(f)],
        "xg-race": [_stats_line(f), _moment_line(f)],
        "win-probability": [_prediction_line(f), _next_goal_line(f)],
        "key-moments": [_moment_line(f), _narrative_line(f)],
        "analyst-desk": [_stats_line(f), _tactics_line(f)],
        "fan-zone": [_fans_line(fans), _narrative_line(f)],
        "story-so-far": [_narrative_line(f), _stats_line(f)],
        "possession": [_possession_line(f), _momentum_line(f)],
        "headlines": [_narrative_line(f), _moment_line(f)],
        "agent-interpreter": [_moment_line(f), _narrative_line(f)],
        "agent-tactics": [_tactics_line(f), _momentum_line(f)],
        "agent-prediction": [_prediction_line(f), _next_goal_line(f), f.next_action()],
        "agent-explainability": [_explanation_line(f), _moment_line(f)],
        "agent-visualization": [_possession_line(f), f.next_action()],
        "agent-tracking": [_player_line(f), _stats_line(f)],
        "agent-highlights": [_highlight_line(f), _moment_line(f)],
        "agent-squad": [_tactics_line(f), _prediction_line(f), _player_line(f)],
    }
    return by_scene.get(scene.id, [_narrative_line(f), _stats_line(f)])


def _say(language: str, key: str, **values: object) -> str:
    return PHRASES[language][key].format(**values)


def _one(language: str, f: MatchFacts, *kinds: str) -> str | None:
    for kind in kinds:
        line = _fact(language, f, kind)
        if line:
            return line
    return None


def _fact(language: str, f: MatchFacts, kind: str) -> str | None:
    if kind == "stats" and f.stats is not None:
        home, away = f.stats.home, f.stats.away
        return _say(
            language, "stats", home=f.name("home"), away=f.name("away"),
            hxg=f"{home.xg:.2f}", hshots=home.shots, axg=f"{away.xg:.2f}", ashots=away.shots,
        )
    if kind == "possession" and f.stats is not None:
        home, away = f.stats.home, f.stats.away
        side = "home" if home.possession >= away.possession else "away"
        team = home if side == "home" else away
        return _say(
            language, "possession", side=f.name(side), share=f"{max(home.possession, away.possession):.0f}",
            accuracy=f"{team.pass_accuracy:.0f}",
        )
    if kind == "prediction" and f.prediction is not None:
        guess = f.prediction
        return _say(
            language, "prediction", home=f.name("home"), away=f.name("away"),
            home_pct=pct(guess.win_home), draw=pct(guess.draw), away_pct=pct(guess.win_away),
        )
    if kind == "next_goal" and f.prediction is not None:
        guess = f.prediction
        side = "home" if guess.next_goal_home >= guess.next_goal_away else "away"
        return _say(language, "next_goal", side=f.name(side), chance=pct(max(guess.next_goal_home, guess.next_goal_away)))
    if kind == "momentum" and f.stats is not None:
        swing = f.stats.momentum
        if abs(swing) < 0.15:
            return _say(language, "momentum_even")
        return _say(language, "momentum", side=f.name("home" if swing > 0 else "away"))
    if kind == "player" and (player := f.top_player()) is not None:
        return _say(
            language, "player", name=player.name, team=f.name(player.team),
            rating=f"{player.rating:.1f}", touches=player.touches, goals=player.goals,
        )
    if kind == "moment" and f.moments:
        moment = f.moments[-1]
        what = _say(language, moment.kind if moment.kind in PHRASES[language] else "big_chance")
        who = f.player_name(moment.player_id)
        if who:
            return _say(language, "moment_by", what=what, player=who, team=f.name(moment.team), minute=moment.minute)
        return _say(language, "moment", what=what, team=f.name(moment.team), minute=moment.minute)
    if kind == "next_action" and f.prediction is not None and f.prediction.next_actions and f.prediction.possession:
        best = max(f.prediction.next_actions, key=lambda action: action.probability)
        move = best.action if best.action in {"pass", "shot", "turnover"} else "pass"
        return _say(
            language, "next_action", side=f.name(f.prediction.possession),
            action=_say(language, move), chance=pct(best.probability),
        )
    return None


_SPOKEN = {
    "welcome": ("moment", "prediction"),
    "live-match": ("moment", "momentum"),
    "score-centre": ("stats", "possession"),
    "stadium-3d": ("possession", "next_goal"),
    "pressure-map": ("momentum", "possession"),
    "momentum": ("momentum", "moment"),
    "xg-race": ("stats", "moment"),
    "win-probability": ("prediction", "next_goal"),
    "key-moments": ("moment", "stats"),
    "analyst-desk": ("stats", "momentum"),
    "fan-zone": ("moment", "prediction"),
    "story-so-far": ("stats", "moment"),
    "possession": ("possession", "momentum"),
    "headlines": ("moment", "prediction"),
    "agent-interpreter": ("moment", "next_action"),
    "agent-tactics": ("momentum", "possession"),
    "agent-prediction": ("prediction", "next_goal", "next_action"),
    "agent-explainability": ("moment", "momentum"),
    "agent-visualization": ("possession", "next_action"),
    "agent-tracking": ("player", "stats"),
    "agent-highlights": ("moment", "player"),
    "agent-squad": ("player", "prediction"),
}


def _in_language(
    language: str, scene: AutoLiveScene, f: MatchFacts, *, opening: bool, rng: random.Random
) -> str:
    """The same shape as the English templates, in the chosen language. Free English prose is left out."""
    parts: list[str | None] = []
    if opening:
        parts.append(_say(language, rng.choice(("open_a", "open_b", "open_c", "open_d")), name=scene.name))
    status = f.status
    if status is None:
        parts.append(_say(language, "waiting_open" if opening else "waiting"))
        return _join(*parts)[:MAX_CHARS]
    if status.score_home == status.score_away:
        parts.append(_say(language, "level", home=status.home.name, away=status.away.name, n=status.score_home))
    else:
        lead, trail = ("home", "away") if status.score_home > status.score_away else ("away", "home")
        parts.append(_say(
            language, "lead", lead=f.name(lead), trail=f.name(trail),
            high=max(status.score_home, status.score_away), low=min(status.score_home, status.score_away),
        ))
    clock = {"pre_match": "pre_match", "half_time": "half_time", "finished": "finished", "abandoned": "abandoned"}.get(status.state)
    parts.append(_say(language, clock) if clock else _say(language, "minute", n=max(status.minute, 1)))
    parts.append(_one(language, f, *_SPOKEN.get(scene.id, ("moment", "stats"))))
    return _join(*parts)[:MAX_CHARS]


def scripted(
    scene: AutoLiveScene, f: MatchFacts, fans: FanZone | None, *, opening: bool, rng: random.Random,
    language: str = "en",
) -> str:
    """Commentary from templates: who is on screen, the score, then what this screen is about."""
    language = known(language)
    if language != "en":
        return _in_language(language, scene, f, opening=opening, rng=rng)
    name = _AGENT_NAMES.get(scene.agent or "", scene.name)
    intro = rng.choice(_OPENINGS).format(name=name) + " " + _sentence(scene.blurb) if opening else ""
    found = [line for line in _lines_for(scene, f, fans) if line]
    if f.status is None:
        waiting = (
            "The next match is on its way, so stay with us."
            if opening
            else "We're waiting for the next kick-off."
        )
        return _join(intro or "Kickstream Live, football around the clock", waiting)[:MAX_CHARS]
    score = f"{f.score()}, {f.clock()}"
    if opening:
        return _join(intro, score, *(found[:1]))[:MAX_CHARS]
    # More said while a screen stays on air: something it has not just said, if there is anything.
    said = rng.choice(found) if found else None
    return _join(score, said)[:MAX_CHARS]


class CommentaryService:
    """The model's words while its hourly allowance lasts and it answers in time; the templates otherwise."""

    def __init__(
        self,
        writer: CommentaryWriter | None = None,
        *,
        per_hour: int = 30,
        timeout_s: float = 20.0,
        rng: random.Random | None = None,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self._writer = writer
        self._per_hour = per_hour
        self._timeout_s = timeout_s
        self._rng = rng or random.Random()
        self._now = now
        self._calls: deque[float] = deque()

    @property
    def has_model(self) -> bool:
        return self._writer is not None

    def _allowed(self) -> bool:
        hour_ago = self._now() - 3600
        while self._calls and self._calls[0] < hour_ago:
            self._calls.popleft()
        return len(self._calls) < self._per_hour

    async def write(
        self, scene: AutoLiveScene, facts: MatchFacts, fans: FanZone | None, *, opening: bool, language: str = "en",
    ) -> tuple[str, str]:
        """The text and where it came from: "model" or "scripted"."""
        language = known(language)
        if self._writer is not None and self._allowed():
            self._calls.append(self._now())
            ctx = CommentaryContext(
                scene=scene.name,
                kind=scene.kind,
                agent=_AGENT_NAMES.get(scene.agent or ""),
                blurb=scene.blurb,
                facts=facts.labelled(fans),
                opening=opening,
                language=language,
            )
            try:
                text = await asyncio.wait_for(self._writer.write(ctx), self._timeout_s)
                if text.strip():
                    return text.strip()[:MAX_CHARS], "model"
            except Exception as exc:  # noqa: BLE001 - every model failure falls back to the templates
                log.warning("the auto live commentator failed (%s); using the templates", type(exc).__name__)
        return scripted(scene, facts, fans, opening=opening, rng=self._rng, language=language), "scripted"
