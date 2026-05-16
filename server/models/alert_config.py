"""models/alert_config.py — 用户预警配置模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Numeric, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class UserAlertConfig(Base):
    __tablename__ = "user_alert_config"

    id: Mapped[int]    = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_enabled: Mapped[bool]   = mapped_column(Boolean, default=True)
    threshold: Mapped[float]   = mapped_column(Numeric(5, 2), default=2.0)
    email_receiver: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
