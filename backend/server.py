from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
import asyncio
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection is optional.
# The online 1x1 mode does NOT need database.
mongo_url = os.environ.get("MONGO_URL", "")
client = AsyncIOMotorClient(mongo_url) if mongo_url else None
db = client[os.environ.get("DB_NAME", "shinobi")] if client else None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if db is None:
        return []
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ===========================================================================
# ONLINE 1x1 ROOMS (in-memory)
# ===========================================================================

class RoomCreatePayload(BaseModel):
    turnMinutes: int = 20
    matchType: str = "1x1"
    bossMode: bool = False
    bossDifficulty: str = "facil"
    maxPlayers: Optional[int] = None


def _max_players_for(match_type: str, boss_mode: bool = False) -> int:
    if boss_mode or "Boss" in match_type:
        try:
            return max(1, min(3, int(match_type.split("x", 1)[0])))
        except Exception:
            return 3
    try:
        left, right = match_type.split("x", 1)
        return max(2, min(6, int(left) + int(right)))
    except Exception:
        return 2

class Room:
    def __init__(self, code: str, config: Dict[str, Any]):
        self.code = code
        self.config = config
        self.host_ws: Optional[WebSocket] = None
        self.guest_ws: Optional[WebSocket] = None
        self.host_info: Optional[Dict[str, Any]] = None
        self.guest_info: Optional[Dict[str, Any]] = None
        self.participants: Dict[str, Dict[str, Any]] = {}
        self.created_at = datetime.now(timezone.utc).timestamp()

    def is_full(self) -> bool:
        if self.config.get("teamMode"):
            players = [p for p in self.participants.values() if (p.get("player") or {}).get("role") != "spectator"]
            return len(players) >= int(self.config.get("maxPlayers", 2))
        return self.host_ws is not None and self.guest_ws is not None

    def opponent_ws(self, role: str) -> Optional[WebSocket]:
        return self.guest_ws if role == "host" else self.host_ws

    def opponent_info(self, role: str) -> Optional[Dict[str, Any]]:
        return self.guest_info if role == "host" else self.host_info

    def participants_info(self) -> List[Dict[str, Any]]:
        return [p.get("player", {}) for p in self.participants.values()]

    def participant_sockets(self, except_id: Optional[str] = None) -> List[WebSocket]:
        sockets: List[WebSocket] = []
        for pid, entry in self.participants.items():
            if pid == except_id:
                continue
            ws = entry.get("ws")
            if ws is not None:
                sockets.append(ws)
        return sockets


ROOMS: Dict[str, Room] = {}
ROOMS_LOCK = asyncio.Lock()


def _generate_code() -> str:
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + "23456789"
    for _ in range(20):
        code = "".join(random.choice(alphabet) for _ in range(6))
        if code not in ROOMS:
            return code
    # fallback
    return uuid.uuid4().hex[:6].upper()


@api_router.post("/rooms")
async def create_room(payload: RoomCreatePayload):
    if payload.turnMinutes not in (0, 10, 20, 30):
        raise HTTPException(status_code=400, detail="turnMinutes must be 0, 10, 20 or 30")
    allowed_matches = {"1x1", "1x2", "2x2", "2x3", "3x1", "3x2", "3x3", "1xBoss", "2xBoss", "3xBoss"}
    if payload.matchType not in allowed_matches:
        raise HTTPException(status_code=400, detail="matchType inválido")
    team_mode = payload.matchType != "1x1" or payload.bossMode or "Boss" in payload.matchType
    async with ROOMS_LOCK:
        # cleanup very old empty rooms (>1h)
        now = datetime.now(timezone.utc).timestamp()
        for code in list(ROOMS.keys()):
            r = ROOMS[code]
            if r.host_ws is None and r.guest_ws is None and len(r.participants) == 0 and now - r.created_at > 3600:
                del ROOMS[code]
        code = _generate_code()
        ROOMS[code] = Room(code, {
            "turnMinutes": payload.turnMinutes,
            "matchType": payload.matchType,
            "bossMode": payload.bossMode,
            "bossDifficulty": payload.bossDifficulty,
            "teamMode": team_mode,
            "maxPlayers": payload.maxPlayers or _max_players_for(payload.matchType, payload.bossMode),
        })
    return {"code": code, "config": ROOMS[code].config}


@api_router.get("/rooms/{code}")
async def get_room(code: str):
    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    return {
        "code": code,
        "config": room.config,
        "hasHost": room.host_ws is not None,
        "hasGuest": room.guest_ws is not None,
        "participants": room.participants_info(),
        "full": room.is_full(),
    }


async def _safe_send(ws: Optional[WebSocket], payload: Dict[str, Any]):
    if ws is None:
        return
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass


@app.websocket("/api/ws/{code}")
async def room_ws(websocket: WebSocket, code: str):
    await websocket.accept()
    code = code.upper().strip()
    role: Optional[str] = None
    participant_id: Optional[str] = None
    try:
        # First message MUST be a hello with role + player info
        raw = await websocket.receive_text()
        msg = json.loads(raw)
        if msg.get("type") != "hello":
            await _safe_send(websocket, {"type": "error", "message": "Mensagem inicial inválida."})
            await websocket.close()
            return

        requested_role = msg.get("role")
        player = msg.get("player") or {}
        if requested_role not in ("host", "guest", "player", "spectator"):
            await _safe_send(websocket, {"type": "error", "message": "Role inválido."})
            await websocket.close()
            return

        async with ROOMS_LOCK:
            room = ROOMS.get(code)
            if not room:
                await _safe_send(websocket, {"type": "error", "code": "not_found", "message": "Sala não encontrada."})
                await websocket.close()
                return
            if requested_role in ("player", "spectator") or room.config.get("teamMode"):
                pid = str(player.get("id") or uuid.uuid4())
                if requested_role != "spectator" and pid not in room.participants and room.is_full():
                    await _safe_send(websocket, {"type": "error", "code": "full", "message": "Sala cheia."})
                    await websocket.close()
                    return
                player["id"] = pid
                player["role"] = "spectator" if requested_role == "spectator" else player.get("role", "player")
                room.participants[pid] = {"ws": websocket, "player": player}
                role = "player"
                participant_id = pid
            elif requested_role == "host":
                if room.host_ws is not None:
                    await _safe_send(websocket, {"type": "error", "code": "full", "message": "Sala cheia."})
                    await websocket.close()
                    return
                room.host_ws = websocket
                room.host_info = player
                role = "host"
            else:
                if room.guest_ws is not None:
                    await _safe_send(websocket, {"type": "error", "code": "full", "message": "Sala cheia."})
                    await websocket.close()
                    return
                room.guest_ws = websocket
                room.guest_info = player
                role = "guest"

        if role == "player":
            await _safe_send(websocket, {
                "type": "team_ready",
                "you": participant_id,
                "code": code,
                "config": room.config,
                "participants": room.participants_info(),
            })
            for ws in room.participant_sockets(participant_id):
                await _safe_send(ws, {
                    "type": "participant_joined",
                    "participant": player,
                    "participants": room.participants_info(),
                    "config": room.config,
                })
        else:
            # Send "ready" to this socket with opponent info (if any)
            await _safe_send(websocket, {
                "type": "ready",
                "you": role,
                "code": code,
                "config": room.config,
                "opponent": room.opponent_info(role),
            })
            # Notify opponent
            opp = room.opponent_ws(role)
            if opp is not None:
                await _safe_send(opp, {
                    "type": "opponent_joined",
                    "opponent": player,
                    "config": room.config,
                })

        # Relay loop
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            mtype = data.get("type")
            if mtype == "relay":
                if role == "player":
                    for ws in room.participant_sockets(participant_id):
                        await _safe_send(ws, {
                            "type": "team_relay",
                            "from": participant_id,
                            "payload": data.get("payload"),
                        })
                else:
                    await _safe_send(room.opponent_ws(role), {
                        "type": "relay",
                        "from": role,
                        "payload": data.get("payload"),
                    })
            elif mtype == "ping":
                await _safe_send(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        # cleanup
        async with ROOMS_LOCK:
            room = ROOMS.get(code)
            if room and role:
                if role == "player" and participant_id:
                    room.participants.pop(participant_id, None)
                    for ws in room.participant_sockets(None):
                        await _safe_send(ws, {"type": "participant_left", "id": participant_id, "participants": room.participants_info()})
                elif role == "host" and room.host_ws is websocket:
                    room.host_ws = None
                    room.host_info = None
                elif role == "guest" and room.guest_ws is websocket:
                    room.guest_ws = None
                    room.guest_info = None
                opp = room.opponent_ws(role) if role else None
                if opp is not None:
                    await _safe_send(opp, {"type": "opponent_disconnected"})
                # If both gone, delete room
                if room.host_ws is None and room.guest_ws is None and len(room.participants) == 0:
                    ROOMS.pop(code, None)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
