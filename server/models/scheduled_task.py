"""models/scheduled_task.py — 可配置的定时任务模型"""
from datetime import datetime, timezone, timedelta

# 中国标准时间 UTC+8
CST = timezone(timedelta(hours=8))
from sqlalchemy import Integer, String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 任务唯一标识符，对应 scheduler.py 中的函数名
    task_key: Mapped[str]    = mapped_column(String(50), unique=True, nullable=False)
    # 任务中文名称（用于后台展示）
    name: Mapped[str]        = mapped_column(String(100), nullable=False)
    # 任务描述
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # cron 表达式：如 "0 30 0 * * tue-sat"
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    # 是否启用
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # 上次执行时间
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 上次执行状态
    last_run_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(CST)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(CST),
        onupdate=lambda: datetime.now(CST)
    )
