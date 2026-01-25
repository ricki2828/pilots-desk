"""
Pilot's Desk - Scoring & Coaching Backend
FastAPI service for real-time adherence scoring and compliance monitoring
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.routers import scoring, analytics, supervisor, scripts, search
from app.services.llm_provider import LLMProvider
from app.models.score import ScoreRequest, ScoreResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting Pilot's Desk Backend")
    logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")

    # Initialize LLM provider
    app.state.llm_provider = LLMProvider()

    yield

    logger.info("Shutting down Pilot's Desk Backend")


app = FastAPI(
    title="Pilot's Desk API",
    description="Real-time scoring and coaching for BPO agents",
    version="0.1.0",
    lifespan=lifespan
)

# CORS configuration for Tauri desktop app and dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",  # Tauri dev server
        "tauri://localhost",      # Tauri production
        "https://tauri.localhost", # Tauri alternative
        "http://localhost:3000",  # Dashboard dev server
        "http://localhost:5173",  # Dashboard Vite dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(supervisor.router, prefix="/api/supervisor", tags=["supervisor"])
app.include_router(scripts.router, prefix="/api/scripts", tags=["scripts"])
app.include_router(search.router, prefix="/api/search", tags=["search"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Pilot's Desk API",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "llm_provider": "ready",
        "timestamp": datetime.utcnow().isoformat()
    }


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time scoring"""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, agent_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[agent_id] = websocket
        logger.info(f"Agent {agent_id} connected via WebSocket")

    def disconnect(self, agent_id: str):
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]
            logger.info(f"Agent {agent_id} disconnected")

    async def send_score(self, agent_id: str, score_data: dict):
        """Send score update to specific agent"""
        if agent_id in self.active_connections:
            try:
                await self.active_connections[agent_id].send_json(score_data)
            except Exception as e:
                logger.error(f"Failed to send score to {agent_id}: {e}")
                self.disconnect(agent_id)

    async def send_nudge(self, agent_id: str, nudge_data: dict):
        """Send coaching nudge to specific agent"""
        if agent_id in self.active_connections:
            try:
                await self.active_connections[agent_id].send_json({
                    "type": "nudge",
                    **nudge_data
                })
            except Exception as e:
                logger.error(f"Failed to send nudge to {agent_id}: {e}")
                self.disconnect(agent_id)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected agents"""
        disconnected = []
        for agent_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {agent_id}: {e}")
                disconnected.append(agent_id)

        for agent_id in disconnected:
            self.disconnect(agent_id)


manager = ConnectionManager()


@app.websocket("/ws/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    """WebSocket endpoint for real-time scoring updates"""
    await manager.connect(agent_id, websocket)

    try:
        while True:
            # Receive messages from client (keepalive, acknowledgments, etc.)
            data = await websocket.receive_json()

            # Handle client messages
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "ack":
                logger.debug(f"Agent {agent_id} acknowledged: {data.get('message_id')}")

    except WebSocketDisconnect:
        manager.disconnect(agent_id)
        logger.info(f"Agent {agent_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {agent_id}: {e}")
        manager.disconnect(agent_id)


if __name__ == "__main__":
    import uvicorn
    import os
    from dotenv import load_dotenv

    load_dotenv()

    port = int(os.getenv("PORT", 8007))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
