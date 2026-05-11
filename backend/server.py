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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ===========================================================================
# ONLINE 1x1 ROOMS (in-memory)
# ===========================================================================

class RoomCreatePayload(BaseModel):
    turnMinutes: int = 20

class Room:
    def __init__(self, code: str, config: Dict[str, Any]):
        self.code = code
        self.config = config
        self.host_ws: Optional[WebSocket] = None
        self.guest_ws: Optional[WebSocket] = None
        self.host_info: Optional[Dict[str, Any]] = None
        self.guest_info: Optional[Dict[str, Any]] = None
        self.created_at = datetime.now(timezone.utc).timestamp()

    def is_full(self) -> bool:
        return self.host_ws is not None and self.guest_ws is not None

    def opponent_ws(self, role: str) -> Optional[WebSocket]:
        return self.guest_ws if role == "host" else self.host_ws

    def opponent_info(self, role: str) -> Optional[Dict[str, Any]]:
        return self.guest_info if role == "host" else self.host_info


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
    if payload.turnMinutes not in (10, 20, 30):
        raise HTTPException(status_code=400, detail="turnMinutes must be 10, 20 or 30")
    async with ROOMS_LOCK:
        # cleanup very old empty rooms (>1h)
        now = datetime.now(timezone.utc).timestamp()
        for code in list(ROOMS.keys()):
            r = ROOMS[code]
            if r.host_ws is None and r.guest_ws is None and now - r.created_at > 3600:
                del ROOMS[code]
        code = _generate_code()
        ROOMS[code] = Room(code, {"turnMinutes": payload.turnMinutes})
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
        if requested_role not in ("host", "guest"):
            await _safe_send(websocket, {"type": "error", "message": "Role inválido."})
            await websocket.close()
            return

        async with ROOMS_LOCK:
            room = ROOMS.get(code)
            if not room:
                await _safe_send(websocket, {"type": "error", "code": "not_found", "message": "Sala não encontrada."})
                await websocket.close()
                return
            if requested_role == "host":
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
                if role == "host" and room.host_ws is websocket:
                    room.host_ws = None
                    room.host_info = None
                elif role == "guest" and room.guest_ws is websocket:
                    room.guest_ws = None
                    room.guest_info = None
                opp = room.opponent_ws(role) if role else None
                if opp is not None:
                    await _safe_send(opp, {"type": "opponent_disconnected"})
                # If both gone, delete room
                if room.host_ws is None and room.guest_ws is None:
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
    client.close()
