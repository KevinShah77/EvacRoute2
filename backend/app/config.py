import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DEFAULT_DB_PATH = BASE_DIR / "evacroute.db"
DEFAULT_TOPOLOGY_PATH = PROJECT_ROOT / "database" / "seed_data" / "building_topology.json"

class Settings:
    PROJECT_NAME: str = "EvacRoute Emergency Response"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "evacroute_emergency_jwt_super_secret_key_2026_campus_safety_protocol")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Web Push / VAPID (Standard RFC 8292)
    VAPID_PUBLIC_KEY: str = os.getenv(
        "VAPID_PUBLIC_KEY",
        "BC7fPH97XC0x95m1ibluSMTcl9QyBJcNMR87HGovMwwdf00ujBGiJp059QY6ofyu9TPt0PT7TJKOjp40WjZdVVA"
    )
    VAPID_PRIVATE_KEY: str = os.getenv(
        "VAPID_PRIVATE_KEY",
        "MHcCAQEEIPq9Yf+oA6P5+iFj1x2F3GgXp9l2n8Q7Z0k6hR8rU6CkoAoGCCqGSM49AwEHoUQDQgAEBC7fPH97XC0x95m1ibluSMTcl9QyBJcNMR87HGovMwwdf00ujBGiJp059QY6ofyu9TPt0PT7TJKOjp40WjZdVVA=="
    )
    VAPID_CLAIM_EMAIL: str = os.getenv("VAPID_CLAIM_EMAIL", "mailto:safety-officer@evacroute.campus.edu")
    
    # External channels (Configurable placeholders requiring actual third-party credentials)
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    ALERT_EMAIL_FROM: str = os.getenv("ALERT_EMAIL_FROM", "alerts@campus.edu")
    
    # Data files
    BUILDING_TOPOLOGY_PATH: Path = DEFAULT_TOPOLOGY_PATH

settings = Settings()
