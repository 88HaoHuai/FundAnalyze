"""
schemas.py — Pydantic 数据验证模型
"""
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date, datetime
import uuid

# ==========================
# Group Funds (持仓信息)
# ==========================
class GroupFundBase(BaseModel):
    fund_code: str
    sort_order: int = 0
    amount: float = 0
    is_auto_invest: bool = False
    auto_invest_amount: float = 0
    last_auto_invest_date: Optional[date] = None

class GroupFundCreate(GroupFundBase):
    pass

class GroupFundUpdate(BaseModel):
    amount: float
    is_auto_invest: bool
    auto_invest_amount: float

class GroupFundResponse(GroupFundBase):
    id: int
    group_id: int
    class Config:
        from_attributes = True

# ==========================
# Fund Groups (基金分组)
# ==========================
class FundGroupBase(BaseModel):
    name: str
    is_market: bool = False
    sort_order: int = 0

class FundGroupCreate(FundGroupBase):
    pass

class FundGroupUpdate(BaseModel):
    name: str

class FundGroupResponse(FundGroupBase):
    id: int
    user_id: uuid.UUID
    created_at: datetime
    # 为了兼容旧前端，嵌套返回 positions
    codes: List[str] = []
    positions: Dict[str, dict] = {}
    
    class Config:
        from_attributes = True

# ==========================
# 市场风向标（全局配置）
# ==========================
class MarketFundResponse(BaseModel):
    id: int
    fund_code: str
    fund_name: str
    category: Optional[str] = None
    sort_order: int = 0

    class Config:
        from_attributes = True
