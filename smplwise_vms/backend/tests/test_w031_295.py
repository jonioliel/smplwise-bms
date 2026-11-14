"""W031-295 (WisKey item W-031): every signed direct command that reaches the WisKey bridge maps identity, role and scope to an Arx
admission decision. These tests pin the three gaps the review found (docs/changes/W031-295.md); the paths that were already admitted
keep their own tests. FAKES ONLY: nothing here contacts WisKey, Home Assistant, a station or a door."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_intercom_media import fake_provider, mode, start  # noqa: F401 - fixtures / helpers
from test_wkcap_295 import env, prep  # noqa: F401 - fixture / helper
from test_wkwrite_295 import ACTOR, Clock, decision, run, sent
from wkcap_fakes import FakeDirectPort
from wkwrite_fake import FakeWisKey

from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl


@pytest.fixture()
def wenv(tmp_path: Path) -> Any:
    """test_wkwrite_295's writer world (a lineage on a scratch settings table, the WisKey fake)."""
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    lin = wl.open_lineage(tmp_path, wl.SettingsAnchor(main), holder="holder-A", clock=Clock())
    fake = FakeWisKey()
    yield {"fake": fake, "writer": nw.NativePeopleWriter(fake, lin)}
    lin.close()


# ================================================================ gap 1: the feature request's actor is the principal judged

def test_a_feature_request_whose_human_actor_is_not_the_judged_principal_is_refused_before_anything(env):  # noqa: F811
    """`features/start | prepare_media`: the policy snapshot is resolved for `principals`; the wire names `actor`. The two must be the same
    Arx user (siblings: the people write decides for `act.principal` and attributes the write to the same user)."""
    port = FakeDirectPort()
    other = env.principal("plain")
    with pytest.raises(fd.FeatureWireError) as e:
        prep(env, port, "live_validation", actor=fx.human_actor(other.user_id), principals=[env.admin])
    assert (e.value.code, e.value.outcome) == ("Unauthorized", "not_sent")
    with pytest.raises(fd.FeatureWireError) as e:
        prep(env, port, "live_validation", principals=[env.admin, other])  # a second principal widens nothing and binds nothing
    assert (e.value.code, e.value.outcome) == ("Unauthorized", "not_sent")
    assert port.calls == []
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_feature_intents").fetchone()[0] == 0


def test_an_automation_feature_request_is_judged_for_exactly_its_creator_and_approver(env):  # noqa: F811
    port = FakeDirectPort()
    other = env.principal("plain")
    auto = fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=env.admin.user_id,
                               approver_user_id=other.user_id, grant_revision=5)
    with pytest.raises(fd.FeatureWireError) as e:
        prep(env, port, "door_automations", actor=auto, principals=[env.admin])  # the approver was never judged
    assert (e.value.code, e.value.outcome) == ("Unauthorized", "not_sent")
    assert port.calls == []
    same = fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=env.admin.user_id,
                               approver_user_id=env.admin.user_id, grant_revision=5)
    _ad, body, snap = prep(env, port, "door_automations", actor=same, principals=[env.admin])  # the allowed path is unchanged
    assert snap["complete"] is True and body["actor"] == same


# ================================================================ gap 2: the name_ref pair carries a fresh Arx decision like `write`

def test_a_rename_needs_a_fresh_arx_decision_like_every_other_native_people_write(wenv):  # noqa: F811
    fake = wenv["fake"]
    fake.seed_user("u-n", revision=5)
    stale = decision(datetime.now(timezone.utc) - timedelta(seconds=30))
    with pytest.raises(nw.NativeWriteError) as e:
        run(wenv["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=stale))
    assert e.value.code == "decision_stale"
    bad = nw.ArxDecision(decision_id="", grant_id="g", grant_revision=1, permission_revision=1, decided_at=datetime.now(timezone.utc))
    with pytest.raises(nw.NativeWriteError) as e:
        run(wenv["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=bad))
    assert e.value.code == "invalid_decision"
    assert sent(fake, "users/name_ref_prepare_v1") == [] and sent(fake, "users/name_ref_apply_v1") == []
    with pytest.raises(TypeError):
        run(wenv["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR))  # no decision, no rename
    out = run(wenv["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=decision()))
    assert (out.state, out.person_revision) == ("committed", 6)


# ================================================================ gap 3: `media/talk_open` is re-admitted with the start's own scope

def test_talk_open_is_refused_when_the_station_is_no_longer_visible_to_the_talker(feed, fake_go2rtc, fake_provider, station_scope):  # noqa: F811
    """`talk_start` admits `access.read` (the station is visible) AND `access.call`; the socket that sends `media/talk_open` re-decided only
    `access.call`. A read deny on the station between the start and the socket now ends it before anything is sent upstream."""
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    bind(c, s, "sara", "site_admin", "installation", "*")
    t = start(c, headers=as_user("sara")).json()
    station_scope.bind("dev-sara", "viewer", "entry-a", effect="deny")  # access.read (and video.live) denied; access.call kept
    with pytest.raises(Exception) as e:
        with c.websocket_connect(f"/{t['ws_path']}", headers=as_user("sara")) as ws:
            ws.receive_text()
    assert getattr(e.value, "code", None) == 4403
    assert fake_provider.talk_log.opened == 0, "nothing reached the upstream"


def test_talk_still_opens_for_a_talker_who_holds_both(feed, fake_go2rtc, fake_provider):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    t = start(c).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        ws.send_text(json.dumps({"type": "talk/stop"}))
        ws.receive_text()
    assert fake_provider.talk_log.opened == 1
