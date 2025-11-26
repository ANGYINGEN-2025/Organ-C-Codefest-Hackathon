import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

# Get database URL from environment, or use SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Production: PostgreSQL on Render
    # Fix for Render's postgres:// URL (SQLAlchemy needs postgresql://)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    print("✅ Connected to PostgreSQL database")
else:
    # Local development: SQLite
    BASE_DIR = Path(__file__).resolve().parent
    SQLITE_PATH = BASE_DIR / "local_database.db"
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    print(f"📦 Using local SQLite database: {SQLITE_PATH}")

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
