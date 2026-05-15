"""Backend tests for Shinobi Arena Online 1x1 rooms + WebSocket relay."""
import os
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://shinobi-arena-api.onrender.com").rstrip("/")
WS_BASE = BASE_URL.replace("http", "ws", 1)


# ============ Rooms REST ============
class TestRoomsREST:
    def test_health_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"

    def test_create_room_valid(self):
        r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": 20})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "code" in data and isinstance(data["code"], str)
        assert len(data["code"]) >= 4
        assert data["config"]["turnMinutes"] == 20

    def test_create_room_invalid_minutes(self):
        r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": 15})
        assert r.status_code == 400

    def test_create_room_each_time(self):
        for tm in (0, 10, 20, 30):
            r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": tm})
            assert r.status_code == 200
            assert r.json()["config"]["turnMinutes"] == tm

    def test_get_room_unknown_404(self):
        r = requests.get(f"{BASE_URL}/api/rooms/ZZZZZZ")
        assert r.status_code == 404

    def test_get_room_existing(self):
        r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": 10})
        code = r.json()["code"]
        r2 = requests.get(f"{BASE_URL}/api/rooms/{code}")
        assert r2.status_code == 200
        d = r2.json()
        assert d["code"] == code
        assert d["full"] is False
        assert d["hasHost"] is False
        assert d["hasGuest"] is False


# ============ WebSocket Relay ============
@pytest.mark.asyncio
async def test_ws_hello_relay_disconnect():
    """Full lifecycle: host + guest connect, ready+opponent_joined, relay forward, disconnect notify."""
    r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": 30})
    assert r.status_code == 200
    code = r.json()["code"]
    url = f"{WS_BASE}/api/ws/{code}"

    host = await websockets.connect(url)
    await host.send(json.dumps({"type": "hello", "role": "host", "player": {"name": "Naruto", "village": "Konoha"}}))
    msg_host = json.loads(await asyncio.wait_for(host.recv(), timeout=10))
    assert msg_host["type"] == "ready"
    assert msg_host["you"] == "host"
    assert msg_host["opponent"] is None
    assert msg_host["config"]["turnMinutes"] == 30

    guest = await websockets.connect(url)
    await guest.send(json.dumps({"type": "hello", "role": "guest", "player": {"name": "Sasuke", "village": "Konoha"}}))
    msg_guest = json.loads(await asyncio.wait_for(guest.recv(), timeout=10))
    assert msg_guest["type"] == "ready"
    assert msg_guest["you"] == "guest"
    assert msg_guest["opponent"]["name"] == "Naruto"

    # Host receives opponent_joined
    host_event = json.loads(await asyncio.wait_for(host.recv(), timeout=10))
    assert host_event["type"] == "opponent_joined"
    assert host_event["opponent"]["name"] == "Sasuke"

    # Relay from host -> guest
    await host.send(json.dumps({"type": "relay", "payload": {"action": "initial_ct", "ct": {"id": "x", "name": "Kakashi"}}}))
    relayed = json.loads(await asyncio.wait_for(guest.recv(), timeout=10))
    assert relayed["type"] == "relay"
    assert relayed["from"] == "host"
    assert relayed["payload"]["action"] == "initial_ct"

    # Relay from guest -> host
    await guest.send(json.dumps({"type": "relay", "payload": {"action": "pass", "turn": 1}}))
    relayed2 = json.loads(await asyncio.wait_for(host.recv(), timeout=10))
    assert relayed2["type"] == "relay"
    assert relayed2["from"] == "guest"
    assert relayed2["payload"]["action"] == "pass"

    # Disconnect guest -> host gets opponent_disconnected
    await guest.close()
    disc = json.loads(await asyncio.wait_for(host.recv(), timeout=10))
    assert disc["type"] == "opponent_disconnected"
    await host.close()


@pytest.mark.asyncio
async def test_ws_unknown_room():
    url = f"{WS_BASE}/api/ws/XXXXXX"
    ws = await websockets.connect(url)
    await ws.send(json.dumps({"type": "hello", "role": "host", "player": {"name": "x", "village": "y"}}))
    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
    assert msg["type"] == "error"
    assert msg.get("code") == "not_found"
    await ws.close()


@pytest.mark.asyncio
async def test_ws_room_full():
    r = requests.post(f"{BASE_URL}/api/rooms", json={"turnMinutes": 10})
    code = r.json()["code"]
    url = f"{WS_BASE}/api/ws/{code}"
    h1 = await websockets.connect(url)
    await h1.send(json.dumps({"type": "hello", "role": "host", "player": {"name": "A", "village": "K"}}))
    await asyncio.wait_for(h1.recv(), timeout=10)

    h2 = await websockets.connect(url)
    await h2.send(json.dumps({"type": "hello", "role": "host", "player": {"name": "B", "village": "K"}}))
    msg = json.loads(await asyncio.wait_for(h2.recv(), timeout=10))
    assert msg["type"] == "error"
    assert msg.get("code") == "full"
    await h1.close()
    await h2.close()
