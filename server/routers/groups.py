"""
routers/groups.py — 基金分组管理
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete

from database import get_db
from models.user import User
from models.fund_group import FundGroup
from models.group_fund import GroupFund
from models.market_fund import MarketFund
from routers.auth import get_current_user
import schemas
from services.fund_metadata_service import fetch_fund_metadata

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.get("/", response_model=list[schemas.FundGroupResponse])
async def get_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取用户所有分组，如果是市场风向标则从全局配置加载数据"""
    # 获取分组
    stmt = select(FundGroup).where(FundGroup.user_id == current_user.id).order_by(FundGroup.sort_order).options(selectinload(FundGroup.funds))
    result = await db.execute(stmt)
    groups = result.scalars().all()
    
    # 获取全局市场风向标数据
    m_stmt = select(MarketFund).order_by(MarketFund.sort_order)
    m_result = await db.execute(m_stmt)
    market_funds = m_result.scalars().all()
    dirty = False
    
    response_list = []
    for g in groups:
        codes = []
        positions = {}
        
        if g.is_market:
            # 市场风向标分组：直接加载全局配置
            for m in market_funds:
                codes.append(m.fund_code)
                positions[m.fund_code] = {
                    "amount": 0.0,
                    "isAutoInvest": False,
                    "autoInvestAmount": 0.0,
                    "lastAutoInvestDate": None,
                    "fund_name": m.fund_name, # 注入易读名称
                    "keywords": []
                }
        else:
            # 普通用户持仓分组
            codes = [f.fund_code for f in g.funds]
            for f in g.funds:
                if (not f.fund_name) or (not f.fund_keywords):
                    try:
                        metadata = await fetch_fund_metadata(f.fund_code)
                    except Exception:
                        metadata = None
                    if metadata:
                        f.fund_name = metadata["fund_name"]
                        f.fund_type = metadata.get("fund_type")
                        f.fund_keywords = ",".join(metadata.get("keywords") or [])
                        dirty = True
                positions[f.fund_code] = {
                    "amount": float(f.amount),
                    "isAutoInvest": f.is_auto_invest,
                    "autoInvestAmount": float(f.auto_invest_amount),
                    "lastAutoInvestDate": f.last_auto_invest_date.isoformat() if f.last_auto_invest_date else None,
                    "fund_name": f.fund_name,
                    "keywords": [item for item in (f.fund_keywords or "").split(",") if item]
                }
        
        g_dict = {
            "id": g.id,
            "user_id": g.user_id,
            "name": g.name,
            "is_market": g.is_market,
            "sort_order": g.sort_order,
            "created_at": g.created_at,
            "codes": codes,
            "positions": positions
        }
        response_list.append(g_dict)

    if dirty:
        await db.flush()
    
    return response_list

@router.post("/", response_model=schemas.FundGroupResponse)
async def create_group(group: schemas.FundGroupCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """创建新分组"""
    new_group = FundGroup(user_id=current_user.id, **group.model_dump())
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    
    return {
        "id": new_group.id,
        "user_id": new_group.user_id,
        "name": new_group.name,
        "is_market": new_group.is_market,
        "sort_order": new_group.sort_order,
        "created_at": new_group.created_at,
        "codes": [],
        "positions": {}
    }

@router.put("/{group_id}", response_model=dict)
async def rename_group(group_id: int, update_data: schemas.FundGroupUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """重命名分组"""
    stmt = select(FundGroup).where(FundGroup.id == group_id, FundGroup.user_id == current_user.id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="分组不存在或无权限")
    
    group.name = update_data.name
    await db.commit()
    return {"success": True}

@router.delete("/{group_id}")
async def delete_group(group_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """删除分组（级联删除持仓由数据库外键保证）"""
    stmt = select(FundGroup).where(FundGroup.id == group_id, FundGroup.user_id == current_user.id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="分组不存在或无权限")
    
    await db.delete(group)
    await db.commit()
    return {"success": True}

# ==========================
# 分组持仓操作
# ==========================

@router.post("/{group_id}/funds", response_model=dict)
async def add_fund_to_group(group_id: int, fund_data: schemas.GroupFundCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """向分组添加基金"""
    # 鉴权
    stmt = select(FundGroup).where(FundGroup.id == group_id, FundGroup.user_id == current_user.id)
    if not (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="分组不存在")
        
    try:
        metadata = await fetch_fund_metadata(fund_data.fund_code)
    except Exception:
        metadata = None
    new_fund = GroupFund(
        group_id=group_id,
        **fund_data.model_dump(),
        fund_name=(metadata or {}).get("fund_name"),
        fund_type=(metadata or {}).get("fund_type"),
        fund_keywords=",".join((metadata or {}).get("keywords") or [])
    )
    db.add(new_fund)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="基金已存在于该分组或其他错误")
        
    return {"success": True}

@router.delete("/{group_id}/funds/{fund_code}")
async def remove_fund_from_group(group_id: int, fund_code: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """从分组移除基金"""
    # 鉴权 (略简，实际可连表查)
    stmt = select(FundGroup).where(FundGroup.id == group_id, FundGroup.user_id == current_user.id)
    if not (await db.execute(stmt)).scalar_one_or_none():
         raise HTTPException(status_code=404, detail="分组不存在")
         
    del_stmt = delete(GroupFund).where(GroupFund.group_id == group_id, GroupFund.fund_code == fund_code)
    await db.execute(del_stmt)
    await db.commit()
    return {"success": True}

@router.put("/{group_id}/funds/{fund_code}")
async def update_fund_position(group_id: int, fund_code: str, update_data: schemas.GroupFundUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """更新基金持仓和定投配置"""
    # 鉴权
    stmt = select(FundGroup).where(FundGroup.id == group_id, FundGroup.user_id == current_user.id)
    if not (await db.execute(stmt)).scalar_one_or_none():
         raise HTTPException(status_code=404, detail="分组不存在")
         
    q = select(GroupFund).where(GroupFund.group_id == group_id, GroupFund.fund_code == fund_code)
    fund = (await db.execute(q)).scalar_one_or_none()
    if not fund:
        raise HTTPException(status_code=404, detail="记录不存在")
        
    fund.amount = update_data.amount
    fund.is_auto_invest = update_data.is_auto_invest
    fund.auto_invest_amount = update_data.auto_invest_amount
    await db.commit()
    return {"success": True}


# ==========================
# 市场风向标（公开接口，无需认证）
# ==========================

@router.get("/market-compass", response_model=list[schemas.MarketFundResponse])
async def get_market_compass(db: AsyncSession = Depends(get_db)):
    """获取市场风向标指数列表（全局配置，所有用户可访问，无需登录）"""
    stmt = select(MarketFund).order_by(MarketFund.sort_order)
    result = await db.execute(stmt)
    funds = result.scalars().all()
    return funds
