"""
config.py — 统一读取环境变量配置
"""
import os
from dotenv import load_dotenv

# 优先加载 .env 文件（开发环境）
load_dotenv()

DATABASE_URL: str = os.environ["DATABASE_URL"]

JWT_SECRET: str    = os.environ.get("JWT_SECRET", "changeme")
JWT_ALGORITHM: str = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS: int = int(os.environ.get("JWT_EXPIRE_HOURS", "720"))

SMTP_HOST: str  = os.environ.get("SMTP_HOST", "smtp.qq.com")
SMTP_PORT: int  = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER: str  = os.environ.get("SMTP_USER", "")
SMTP_PASS: str  = os.environ.get("SMTP_PASS", "")
SMTP_FROM: str  = os.environ.get("SMTP_FROM", "")

AI_API_KEY: str = os.environ.get("AI_API_KEY", "")
AI_MODEL: str   = os.environ.get("AI_MODEL", "deepseek-ai/DeepSeek-V3")

CRON_SECRET: str = os.environ.get("CRON_SECRET", "")
