import asyncio

import pytest

from kickstream.adapters.agent_copilot import copilot_instructions
from kickstream.adapters.agent_explainer import explain_instructions
from kickstream.agents.connectors import AgentConnectors, headers_for, readable
from kickstream.agents.registry import MAX_CONNECTORS, AgentError, AgentSwitches, ConnectorDraft
from kickstream.ports.connector import ConnectorFailure
from kickstream.ports.copilot import Speaker
from tests.test_agents import MemoryRecord
from tests.test_copilot import FakeWriter, ask, make_client, play_match

ODDS = ConnectorDraft(
    name="Bookmaker odds", url="https://odds.example/api", description="Live odds", secret="k-1"
)


class FakeClient:
    """A connector service: answers each address with what it was given, or fails."""

    def __init__(self, answers=None) -> None:
        self.answers = answers or {}
        self.calls = []

    async def post(self, url, headers, payload):
        self.calls.append((url, dict(headers), payload))
        answer = self.answers.get(url, (200, '{"answer": "Home are 1.8 to win."}'))
        if isinstance(answer, Exception):
            raise answer
        return answer


# --- the studio's settings for each agent ---------------------------------------------------------


def test_instructions_are_kept_per_agent_trimmed_and_cleared_when_blank():
    record = MemoryRecord()
    switches = AgentSwitches(record)
    switches.set_instructions("prediction", "  Always give odds as fractions.  ")
    assert switches.instructions("prediction") == "Always give odds as fractions."
    assert record.record["instructions"] == {"prediction": "Always give odds as fractions."}
    assert AgentSwitches(record).instructions("prediction") == "Always give odds as fractions."
    assert switches.catalog(model=False).agents[2].custom_instructions == "Always give odds as fractions."
    switches.set_instructions("prediction", "   ")
    assert switches.instructions("prediction") == "" and "instructions" not in record.record
    with pytest.raises(AgentError) as too_long:
        switches.set_instructions("prediction", "x" * 2001)
    assert too_long.value.status == 422
    with pytest.raises(AgentError):
        switches.set_instructions("referee", "Hi")


def test_a_connector_s_secret_is_kept_apart_and_never_shown():
    record, secrets = MemoryRecord(), MemoryRecord()
    switches = AgentSwitches(record, secrets)
    made = switches.add_connector("prediction", ODDS)
    assert made.has_secret and made.header is None and made.enabled
    assert secrets.record == {made.id: "k-1"}
    assert "k-1" not in str(record.record) and "k-1" not in switches.catalog(model=False).model_dump_json()
    reloaded = AgentSwitches(record, secrets)
    assert reloaded.connectors("prediction") == [made] and reloaded.secret(made.id) == "k-1"

    # Left out, the secret is kept; "" removes it.
    kept = switches.update_connector(
        "prediction", made.id, ConnectorDraft(name="Odds", url=ODDS.url, enabled=False)
    )
    assert kept.has_secret and not kept.enabled and switches.secret(made.id) == "k-1"
    cleared = switches.update_connector(
        "prediction", made.id, ConnectorDraft(name="Odds", url=ODDS.url, secret="")
    )
    assert not cleared.has_secret and switches.secret(made.id) is None

    switches.remove_connector("prediction", made.id)
    assert switches.connectors("prediction") == [] and "connectors" not in record.record
    with pytest.raises(AgentError) as gone:
        switches.connector("prediction", made.id)
    assert gone.value.status == 404


@pytest.mark.parametrize(
    ("draft", "field"),
    [
        (ConnectorDraft(name=" ", url="https://a.example"), "name"),
        (ConnectorDraft(name="A", url="ftp://a.example"), "url"),
        (ConnectorDraft(name="A", url="https://user:pass@a.example"), "url"),
        (ConnectorDraft(name="A", url="https://a.example", header="X Key"), "header"),
        (ConnectorDraft(name="A" * 61, url="https://a.example"), "connector"),
    ],
)
def test_a_connector_that_cannot_work_is_refused(draft, field):
    with pytest.raises(AgentError) as refused:
        AgentSwitches().add_connector("highlights", draft)
    assert (refused.value.status, refused.value.field) == (422, field)


def test_an_agent_has_at_most_three_connectors_and_a_failed_save_changes_nothing():
    switches = AgentSwitches()
    for number in range(MAX_CONNECTORS):
        switches.add_connector("highlights", ConnectorDraft(name=f"C{number}", url="https://c.example"))
    with pytest.raises(AgentError):
        switches.add_connector("highlights", ConnectorDraft(name="One more", url="https://c.example"))
    broken = AgentSwitches(MemoryRecord(broken=True))
    with pytest.raises(AgentError) as unsaved:
        broken.add_connector("highlights", ODDS)
    assert unsaved.value.status == 503 and broken.connectors("highlights") == []


def test_a_saved_record_with_broken_connectors_still_loads():
    record = MemoryRecord(
        {
            "off": [],
            "instructions": {"prediction": "Be brief.", "referee": "Hi", "highlights": 3},
            "connectors": {
                "prediction": [
                    {"id": "x"},
                    {
                        "id": "c1",
                        "name": "A",
                        "url": "https://a.example",
                        "description": "",
                        "has_secret": False,
                        "enabled": True,
                    },
                ],
                "referee": [],
            },
        }
    )
    switches = AgentSwitches(record)
    assert switches.instructions("prediction") == "Be brief." and switches.instructions("highlights") == ""
    assert [item.id for item in switches.connectors("prediction")] == ["c1"]


# --- calling the connectors ------------------------------------------------------------------------


def test_the_secret_goes_in_the_named_header_or_as_a_bearer_token():
    switches = AgentSwitches()
    plain = switches.add_connector("prediction", ConnectorDraft(name="A", url="https://a.example"))
    named = switches.add_connector(
        "prediction", ConnectorDraft(name="B", url="https://b.example", header="X-Api-Key")
    )
    assert headers_for(plain, "s") == {"Authorization": "Bearer s"}
    assert headers_for(named, "s") == {"X-Api-Key": "s"}
    assert headers_for(named, None) == {}


@pytest.mark.parametrize(
    ("body", "shown"),
    [
        ('{"answer": "  Home   are favourites. "}', "Home are favourites."),
        ('{"result": {"home": 1.8}}', '{"home":1.8}'),
        ('{"other": 1}', '{"other":1}'),
        ("[1, 2]", "[1,2]"),
        ('"just text"', "just text"),
        ("plain text answer", "plain text answer"),
        ("", ""),
    ],
)
def test_the_readable_part_of_an_answer_is_shown(body, shown):
    assert readable(body) == shown


def test_a_long_answer_is_cut_short():
    assert len(readable("word " * 400)) == 600


def test_each_switched_on_connector_is_asked_and_a_failure_is_reported_not_raised():
    switches = AgentSwitches(None, MemoryRecord())
    odds = switches.add_connector("prediction", ODDS)
    down = switches.add_connector("prediction", ConnectorDraft(name="Down", url="https://down.example"))
    switches.add_connector("prediction", ConnectorDraft(name="Off", url="https://off.example", enabled=False))
    client = FakeClient({"https://down.example": ConnectorFailure("It could not be reached (refused).")})
    connectors = AgentConnectors(switches, client, names={"prediction": "Prediction Agent"})

    sources, problems = asyncio.run(connectors.consult("prediction", "Who wins?", "m-1"))

    assert [(source.title, source.snippet, source.kind) for source in sources] == [
        ("Bookmaker odds", "Home are 1.8 to win.", "connector")
    ]
    assert problems == ["Down: It could not be reached (refused)."]
    assert [call[0] for call in client.calls] == ["https://odds.example/api", "https://down.example"]
    url, headers, payload = client.calls[0]
    assert headers == {"Authorization": "Bearer k-1"}
    assert payload == {
        "question": "Who wins?",
        "agent": "prediction",
        "agent_name": "Prediction Agent",
        "match_id": "m-1",
        "source": "kickstream",
    }
    assert odds.id != down.id
    assert asyncio.run(connectors.consult("highlights", "Who wins?", "m-1")) == ([], [])


def test_an_error_status_or_an_empty_answer_is_a_problem_and_the_budget_stops_the_calls():
    switches = AgentSwitches()
    switches.add_connector("prediction", ConnectorDraft(name="Err", url="https://err.example"))
    switches.add_connector("prediction", ConnectorDraft(name="Empty", url="https://empty.example"))
    client = FakeClient({"https://err.example": (500, "boom"), "https://empty.example": (200, "  ")})
    connectors = AgentConnectors(switches, client, names={}, max_calls_per_match=3)
    assert asyncio.run(connectors.consult("prediction", "Q", "m-1")) == (
        [],
        ["Err answered with an error (500).", "Empty answered with nothing."],
    )
    assert asyncio.run(connectors.consult("prediction", "Q", "m-1"))[1] == [
        "The connectors have been asked as often as one match allows."
    ]
    assert len(client.calls) == 2


def test_a_check_says_whether_the_connector_answers():
    switches = AgentSwitches()
    good = switches.add_connector("highlights", ConnectorDraft(name="Good", url="https://good.example"))
    bad = switches.add_connector("highlights", ConnectorDraft(name="Bad", url="https://bad.example"))
    ticks = iter([0.0, 0.25, 1.0, 1.5])
    client = FakeClient({"https://bad.example": ConnectorFailure("It did not answer within 8 seconds.")})
    connectors = AgentConnectors(switches, client, names={}, clock=lambda: next(ticks))
    passed = asyncio.run(connectors.check("highlights", good.id))
    assert (passed.ok, passed.status, passed.snippet, passed.problem, passed.ms) == (
        True,
        200,
        "Home are 1.8 to win.",
        None,
        250,
    )
    failed = asyncio.run(connectors.check("highlights", bad.id))
    assert (failed.ok, failed.problem, failed.ms) == (False, "It did not answer within 8 seconds.", 500)


# --- the model is told the studio's instructions -----------------------------------------------------


def test_the_studio_s_instructions_come_after_the_writers_own_rules():
    plain = copilot_instructions(Speaker("Prediction Agent", "Forecasts."))
    told = copilot_instructions(Speaker("Prediction Agent", "Forecasts.", "Give odds as fractions."))
    assert told.startswith(plain) and told.endswith(
        "The studio has given Prediction Agent these instructions of its own. Follow them where they do not "
        "conflict with the rules above:\nGive odds as fractions."
    )
    assert copilot_instructions(None) == plain
    assert explain_instructions("") == explain_instructions("  ")
    assert explain_instructions("Mention the crowd.").endswith("rules above:\nMention the crowd.")


# --- over the API ------------------------------------------------------------------------------------


def test_the_studio_sets_an_agent_s_instructions_and_connectors_and_its_answers_use_them(tmp_path):
    writer = FakeWriter()
    service = FakeClient({"https://odds.example/api": (200, '{"answer": "Home are 1.8 to win."}')})
    with make_client(tmp_path, copilot_writer=writer, connector_client=service) as client:
        changed = client.put("/api/agents/prediction/instructions", json={"custom_instructions": "Be brief."})
        assert changed.status_code == 200
        assert changed.json()["agents"][2]["custom_instructions"] == "Be brief."
        assert (
            client.put("/api/agents/referee/instructions", json={"custom_instructions": "x"}).status_code
            == 404
        )

        added = client.post(
            "/api/agents/prediction/connectors",
            json={
                "name": "Bookmaker odds",
                "url": "https://odds.example/api",
                "header": "X-Key",
                "secret": "k-1",
            },
        )
        assert added.status_code == 200 and "k-1" not in added.text
        connector = added.json()["agents"][2]["connectors"][0]
        assert connector["has_secret"] and connector["header"] == "X-Key"
        refused = client.post(
            "/api/agents/prediction/connectors", json={"name": "x", "url": "file:///etc/passwd"}
        )
        assert refused.status_code == 422

        check = client.post(f"/api/agents/prediction/connectors/{connector['id']}/check").json()
        assert check["ok"] and check["snippet"] == "Home are 1.8 to win."
        assert service.calls[-1][1] == {"X-Key": "k-1"}

        play_match(client)
        answer = ask(client, "Who will win?", agent="prediction")
        assert answer.sources[0].title == "Bookmaker odds" and answer.sources[0].kind == "connector"
        question, facts, _ = writer.calls[-1]
        assert facts[-1] == "From Bookmaker odds, a service connected to this agent: Home are 1.8 to win."
        assert writer.speakers[-1].instructions == "Be brief."
        # An agent with no connectors calls none.
        calls = len(service.calls)
        ask(client, "What are the tactics?", agent="tactical_analyst")
        assert len(service.calls) == calls

        edited = client.put(
            f"/api/agents/prediction/connectors/{connector['id']}",
            json={"name": "Odds", "url": "https://odds.example/api", "enabled": False},
        )
        assert edited.json()["agents"][2]["connectors"][0]["has_secret"] is True
        ask(client, "Who will win?", agent="prediction")
        assert len(service.calls) == calls
        removed = client.delete(f"/api/agents/prediction/connectors/{connector['id']}")
        assert removed.json()["agents"][2]["connectors"] == []
        assert client.delete(f"/api/agents/prediction/connectors/{connector['id']}").status_code == 404


def test_without_a_model_a_connector_still_answers_what_the_match_cannot(tmp_path):
    service = FakeClient({"https://wiki.example": (200, "Offside is one of the laws.")})
    with make_client(tmp_path, connector_client=service) as client:
        client.post(
            "/api/agents/explainability/connectors", json={"name": "Rules", "url": "https://wiki.example"}
        )
        answer = ask(client, "What is the offside rule?", agent="explainability")
        assert answer.answer == "From Rules: Offside is one of the laws." and answer.source == "scripted"
