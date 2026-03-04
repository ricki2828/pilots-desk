"""
Database connection and session management
SQLite backend (consistent with CoSauce portal infrastructure)
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

# Database URL from environment — default to SQLite in data/
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DATA_DIR, 'pilots_desk.db')}"
)

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)

# Enable WAL mode and foreign keys for SQLite
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency for FastAPI endpoints"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for database sessions"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Initialize database (create tables)"""
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)

    # Graceful ALTER TABLE for new columns on existing tables
    _add_column_if_missing("call_metadata", "audio_file_path", "VARCHAR(500)")
    _add_column_if_missing("call_metadata", "audio_duration_seconds", "FLOAT")
    _add_column_if_missing("call_metadata", "analysis_status", "VARCHAR(20)")

    logger.info("Database initialized")


def _add_column_if_missing(table: str, column: str, col_type: str):
    """Add a column to an existing table, ignoring if it already exists."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            conn.commit()
            logger.info(f"Added column {table}.{column}")
    except Exception as e:
        if "duplicate column" in str(e).lower():
            pass  # Column already exists
        else:
            logger.debug(f"Column {table}.{column} may already exist: {e}")


def check_db_connection():
    """Check if database is accessible"""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False
