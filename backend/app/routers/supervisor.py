"""
Supervisor Router
Real-time WebSocket endpoint for supervisor dashboard
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import Optional
import logging
import asyncio

from app.db.database import get_db
from app.db.models import ActiveCall, Agent

logger = logging.getLogger(__name__)
router = APIRouter()


class SupervisorConnectionManager:
    """Manages WebSocket connections for supervisors"""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}  # client_id -> [websockets]

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        logger.info(f"Supervisor connected for client {client_id} (total: {len(self.active_connections[client_id])})")

    def disconnect(self, client_id: str, websocket: WebSocket):
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
            logger.info(f"Supervisor disconnected for client {client_id}")

    async def broadcast_to_client(self, client_id: str, message: dict):
        """Broadcast message to all supervisors watching this client"""
        if client_id not in self.active_connections:
            return

        disconnected = []
        for websocket in self.active_connections[client_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to supervisor: {e}")
                disconnected.append(websocket)

        for ws in disconnected:
            self.disconnect(client_id, ws)

    async def broadcast_call_update(self, client_id: str, call_data: dict, event_type: str = "call_updated"):
        """Broadcast call update to supervisors"""
        await self.broadcast_to_client(client_id, {
            "type": event_type,
            "call": call_data,
            "timestamp": datetime.utcnow().isoformat()
        })


supervisor_manager = SupervisorConnectionManager()


@router.websocket("/ws/{client_id}")
async def supervisor_websocket(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for supervisor real-time dashboard

    Sends updates when:
    - Call starts (call_started)
    - Call updates (call_updated)
    - Call ends (call_ended)
    - Periodic full refresh (active_calls_update)
    """
    await supervisor_manager.connect(client_id, websocket)

    # Get database session
    from app.db.database import SessionLocal
    db = SessionLocal()

    try:
        # Send initial active calls
        active_calls = db.query(ActiveCall).join(Agent).filter(Agent.client_id == client_id).all()

        await websocket.send_json({
            "type": "active_calls_update",
            "active_calls": [
                {
                    "call_id": str(call.id),
                    "agent_id": str(call.agent_id),
                    "agent_name": call.agent_name,
                    "current_node_id": call.current_node_id,
                    "current_node_text": call.current_node_text,
                    "latest_adherence_score": call.latest_adherence_score,
                    "compliance_ok": call.compliance_ok,
                    "started_at": call.started_at.isoformat(),
                    "duration_seconds": int((datetime.utcnow() - call.started_at).total_seconds()),
                    "last_updated": call.last_updated.isoformat()
                }
                for call in active_calls
            ],
            "timestamp": datetime.utcnow().isoformat()
        })

        # Keep connection alive and send periodic updates
        while True:
            try:
                # Wait for ping from client or timeout after 30 seconds
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)

                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

                elif data.get("type") == "request_update":
                    # Send fresh active calls data
                    db.expire_all()  # Refresh session
                    active_calls = db.query(ActiveCall).join(Agent).filter(Agent.client_id == client_id).all()

                    await websocket.send_json({
                        "type": "active_calls_update",
                        "active_calls": [
                            {
                                "call_id": str(call.id),
                                "agent_id": str(call.agent_id),
                                "agent_name": call.agent_name,
                                "current_node_id": call.current_node_id,
                                "current_node_text": call.current_node_text,
                                "latest_adherence_score": call.latest_adherence_score,
                                "compliance_ok": call.compliance_ok,
                                "started_at": call.started_at.isoformat(),
                                "duration_seconds": int((datetime.utcnow() - call.started_at).total_seconds()),
                                "last_updated": call.last_updated.isoformat()
                            }
                            for call in active_calls
                        ],
                        "timestamp": datetime.utcnow().isoformat()
                    })

            except asyncio.TimeoutError:
                # Send periodic update every 30 seconds
                db.expire_all()
                active_calls = db.query(ActiveCall).join(Agent).filter(Agent.client_id == client_id).all()

                await websocket.send_json({
                    "type": "active_calls_update",
                    "active_calls": [
                        {
                            "call_id": str(call.id),
                            "agent_id": str(call.agent_id),
                            "agent_name": call.agent_name,
                            "current_node_id": call.current_node_id,
                            "current_node_text": call.current_node_text,
                            "latest_adherence_score": call.latest_adherence_score,
                            "compliance_ok": call.compliance_ok,
                            "started_at": call.started_at.isoformat(),
                            "duration_seconds": int((datetime.utcnow() - call.started_at).total_seconds()),
                            "last_updated": call.last_updated.isoformat()
                        }
                        for call in active_calls
                    ],
                    "timestamp": datetime.utcnow().isoformat()
                })

    except WebSocketDisconnect:
        supervisor_manager.disconnect(client_id, websocket)
    except Exception as e:
        logger.error(f"Supervisor WebSocket error: {e}")
        supervisor_manager.disconnect(client_id, websocket)
    finally:
        db.close()


# Helper function to notify supervisors (can be called from other routers)
async def notify_supervisors_call_started(client_id: str, call_data: dict):
    """Notify supervisors that a new call has started"""
    await supervisor_manager.broadcast_call_update(client_id, call_data, "call_started")


async def notify_supervisors_call_updated(client_id: str, call_data: dict):
    """Notify supervisors that a call has been updated"""
    await supervisor_manager.broadcast_call_update(client_id, call_data, "call_updated")


async def notify_supervisors_call_ended(client_id: str, call_id: str):
    """Notify supervisors that a call has ended"""
    await supervisor_manager.broadcast_to_client(client_id, {
        "type": "call_ended",
        "call_id": call_id,
        "timestamp": datetime.utcnow().isoformat()
    })
