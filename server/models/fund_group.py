"""models/fund_group.py — 基金分组模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class FundGroup(Base):
    __tablename__ = "fund_groups"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str]        = mapped_column(String(100), nullable=False)
    is_market: Mapped[bool]  = mapped_column(Boolean, default=False)
    sort_order: Mapped[int]  = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    funds: Mapped[list["GroupFund"]] = relationship("GroupFund", back_populates="group", cascade="all, delete-orphan")
