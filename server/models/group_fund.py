"""models/group_fund.py — 分组持仓基金模型"""
from datetime import date
from sqlalchemy import Integer, String, Boolean, Numeric, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class GroupFund(Base):
    __tablename__ = "group_funds"
    __table_args__ = (UniqueConstraint("group_id", "fund_code"),)

    id: Mapped[int]    = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("fund_groups.id", ondelete="CASCADE"), nullable=False)
    fund_code: Mapped[str] = mapped_column(String(20), nullable=False)
    fund_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fund_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fund_keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    amount: Mapped[float]   = mapped_column(Numeric(15, 2), default=0)
    is_auto_invest: Mapped[bool]   = mapped_column(Boolean, default=False)
    auto_invest_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    last_auto_invest_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    group: Mapped["FundGroup"] = relationship("FundGroup", back_populates="funds")
