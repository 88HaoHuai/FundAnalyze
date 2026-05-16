"""models/cron_log.py — 定时任务执行日志模型"""
from datetime import datetime, timezone, timedelta

# 中国标准时间 UTC+8
CST = timezone(timedelta(hours=8))
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class CronLog(Base):
    __tablename__ = "cron_logs"

    id: Mapped[int]       = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # 'success' | 'failed' | 'skipped'
    status: Mapped[str]   = mapped_column(String(20), nullable=False)
    message: Mapped[str | None]  = mapped_column(String, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(CST))
