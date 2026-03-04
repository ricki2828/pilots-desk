"""
Pilot's Desk - Scoring & Coaching Backend
FastAPI service for real-time adherence scoring and compliance monitoring
"""

import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.routers import scoring, analytics, supervisor, scripts, search, coaching
from app.routers import calls as calls_router
from app.routers import reports as reports_router
from app.services.llm_provider import LLMProvider
from app.services.coaching import CoachingEngine
from app.services.transcription import TranscriptionService
from app.services.post_call_analyzer import PostCallAnalyzer
from app.services.job_processor import JobProcessor
from app.services.pii_redactor import PIIRedactor
from app.db.database import init_db

# Ensure logs directory exists
os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs"), exist_ok=True)

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

# API key for authentication
API_KEY = os.getenv("API_KEY", "pilots-desk-api-key-change-in-production")


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Require API key for all endpoints except health checks and docs"""

    EXEMPT_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        # Skip auth for exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Skip auth for WebSocket (handled separately)
        if request.url.path.startswith("/ws/") or request.url.path.startswith("/api/supervisor/ws/"):
            return await call_next(request)

        # Check API key
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if api_key != API_KEY:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"}
            )

        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting Pilot's Desk Backend")
    logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")

    # Initialize database
    init_db()

    # Ensure audio directory exists
    audio_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "audio")
    os.makedirs(audio_dir, exist_ok=True)

    # Seed default data if empty
    _seed_defaults()

    # Initialize LLM provider
    app.state.llm_provider = LLMProvider()

    # Initialize coaching engine
    app.state.coaching_engine = CoachingEngine()

    # Initialize post-call analysis pipeline
    app.state.transcription_service = TranscriptionService()
    app.state.post_call_analyzer = PostCallAnalyzer(app.state.llm_provider)
    app.state.pii_redactor = PIIRedactor()
    app.state.job_processor = JobProcessor(
        transcription_service=app.state.transcription_service,
        analyzer=app.state.post_call_analyzer,
        pii_redactor=app.state.pii_redactor,
        ws_manager=manager,
    )
    await app.state.job_processor.start()
    logger.info("Job processor started")

    yield

    # Shutdown
    await app.state.job_processor.stop()
    logger.info("Shutting down Pilot's Desk Backend")


def _seed_defaults():
    """Insert seed data if agents table is empty"""
    from app.db.database import get_db_context
    from app.db.models import Agent
    try:
        with get_db_context() as db:
            if db.query(Agent).count() == 0:
                logger.info("Seeding default agents...")
                agents = [
                    Agent(email="agent1@example.com", name="Sarah Johnson", client_id="SKY_TV_NZ", team="Team A"),
                    Agent(email="agent2@example.com", name="Michael Chen", client_id="SKY_TV_NZ", team="Team A"),
                    Agent(email="agent3@example.com", name="Priya Patel", client_id="SKY_TV_NZ", team="Team B"),
                    Agent(email="supervisor1@example.com", name="David Williams", client_id="SKY_TV_NZ", team="Management"),
                ]
                db.add_all(agents)
                logger.info("Default agents seeded")
    except Exception as e:
        logger.error(f"Failed to seed defaults: {e}")


app = FastAPI(
    title="Pilot's Desk API",
    description="Real-time scoring and coaching for BPO agents",
    version="0.2.0",
    lifespan=lifespan
)

# API key auth middleware
app.add_middleware(APIKeyMiddleware)

# CORS — only allow known origins
ALLOWED_ORIGINS = [
    origin for origin in [
        "http://localhost:1420",       # Tauri dev server
        "tauri://localhost",           # Tauri production
        "https://tauri.localhost",     # Tauri alternative
        "http://localhost:3000",       # Dashboard dev
        "http://localhost:5173",       # Dashboard Vite dev
        os.getenv("DASHBOARD_URL"),    # Production dashboard
    ] if origin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],
)

# Include routers
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(supervisor.router, prefix="/api/supervisor", tags=["supervisor"])
app.include_router(scripts.router, prefix="/api/scripts", tags=["scripts"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(coaching.router, prefix="/api/coaching", tags=["coaching"])
app.include_router(calls_router.router, prefix="/api/calls", tags=["calls"])
app.include_router(reports_router.router, prefix="/api/reports", tags=["reports"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Pilot's Desk API",
        "version": "0.2.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    from app.db.database import check_db_connection
    db_ok = check_db_connection()
    job_processor = getattr(app.state, "job_processor", None)
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "llm_provider": "ready",
        "job_processor_running": job_processor.running if job_processor else False,
        "timestamp": datetime.utcnow().isoformat()
    }


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time scoring"""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, agent_id: str, websocket: WebSocket, api_key: str = None):
        # Validate API key for WebSocket connections
        if api_key != API_KEY:
            await websocket.close(code=4001, reason="Invalid API key")
            return False
        await websocket.accept()
        self.active_connections[agent_id] = websocket
        logger.info(f"Agent {agent_id} connected via WebSocket")
        return True

    def disconnect(self, agent_id: str):
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]
            logger.info(f"Agent {agent_id} disconnected")

    async def send_score(self, agent_id: str, score_data: dict):
        if agent_id in self.active_connections:
            try:
                await self.active_connections[agent_id].send_json(score_data)
            except Exception as e:
                logger.error(f"Failed to send score to {agent_id}: {e}")
                self.disconnect(agent_id)

    async def send_nudge(self, agent_id: str, nudge_data: dict):
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
async def websocket_endpoint(
    websocket: WebSocket,
    agent_id: str,
    api_key: str = Query(default=None)
):
    """WebSocket endpoint for real-time scoring updates"""
    connected = await manager.connect(agent_id, websocket, api_key)
    if not connected:
        return

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "ack":
                logger.debug(f"Agent {agent_id} acknowledged: {data.get('message_id')}")

    except WebSocketDisconnect:
        manager.disconnect(agent_id)
    except Exception as e:
        logger.error(f"WebSocket error for {agent_id}: {e}")
        manager.disconnect(agent_id)


if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv

    load_dotenv()

    port = int(os.getenv("PORT", 8010))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
