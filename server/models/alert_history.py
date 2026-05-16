"""models/alert_history.py — 预警发送历史"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[int]    = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False)
    change_val: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
