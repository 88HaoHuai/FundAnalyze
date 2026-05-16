"""models/invest_log.py — 定投/持仓更新日志模型"""
from datetime import date, datetime, timezone
from sqlalchemy import Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class AutoInvestLog(Base):
    __tablename__ = "auto_invest_logs"

    id: Mapped[int]    = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("fund_groups.id", ondelete="SET NULL"), nullable=True)
    fund_code: Mapped[str]  = mapped_column(String(20), nullable=False)
    date: Mapped[date]      = mapped_column(Date, nullable=False)
    old_amount: Mapped[float | None]    = mapped_column(Numeric(15, 2), nullable=True)
    amount_added: Mapped[float | None]  = mapped_column(Numeric(15, 2), nullable=True)
    invest_amount: Mapped[float | None] = mapped_column(Numeric(15, 2), default=0)
    total_amount: Mapped[float | None]  = mapped_column(Numeric(15, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
