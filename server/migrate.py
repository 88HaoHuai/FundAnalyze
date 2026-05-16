"""
migrate.py — 从 Supabase 迁移数据到 PostgreSQL
"""
import asyncio
import os
from datetime import datetime as dt
import httpx
from database import AsyncSessionLocal
from models.user import User
from models.fund_group import FundGroup
from models.group_fund import GroupFund
from models.market_fund import MarketFund
from models.alert_config import UserAlertConfig
import uuid
import sys

# 原有的 Supabase 配置
SUPABASE_URL = "https://oazrzcnmhbmbtcozpxrk.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def fetch_table(client, table):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = await client.get(url, headers=supabase_headers())
    res.raise_for_status()
    return res.json()

async def migrate_data():
    if not SUPABASE_SERVICE_KEY:
        print("错误：请先设置 SUPABASE_SERVICE_KEY 环境变量！")
        sys.exit(1)
        
    print("开始从 Supabase 获取数据...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        users_raw = []
        try:
             # 注意：普通表不含 auth.users，只能先迁移在业务表里的数据
             groups = await fetch_table(client, "fund_groups")
             group_funds = await fetch_table(client, "group_funds")
             market_funds = await fetch_table(client, "market_funds")
             alert_configs = await fetch_table(client, "user_alert_config")
             
             # 获取在所有业务表中出现过的唯一 user_id
             user_ids = set()
             for item in groups + market_funds + alert_configs:
                 if 'user_id' in item:
                     user_ids.add(item['user_id'])
                     
        except Exception as e:
            print(f"Supabase 请求失败: {e}")
            sys.exit(1)
            
    print(f"获取到 {len(user_ids)} 个用户关联，{len(groups)} 个分组，{len(group_funds)} 个持仓...")

    async with AsyncSessionLocal() as db:
        print("开始插入到 PostgreSQL...")
        # 1. 创建占位用户（因为我们无法直接拉取 supabase 的密码哈希，默认设置相同的初始密码或仅保留结构）
        for uid in user_ids:
            try:
                # 随机生成一个 email 和默认密码，因为 auth.users 无法直接从 API 拿
                # 在真实生产环境，可以登录 supabase 控制台导出 auth.users
                fake_email = f"user_{str(uid)[:8]}@migrated.com"
                u = User(id=uuid.UUID(uid), email=fake_email, password_hash="migrate")
                db.add(u)
                await db.commit()
            except Exception:
                await db.rollback() # 用户可能已存在

        # 2. 插入 fund_groups
        # 为了保持外键一致性，我们需要保存老 ID 的映射（如果老 ID 是数字）
        group_id_map = {}
        for g in groups:
            fg = FundGroup(
                user_id=uuid.UUID(g['user_id']),
                name=g['name'],
                is_market=g['is_market'],
                sort_order=g['sort_order']
            )
            db.add(fg)
            await db.commit()
            await db.refresh(fg)
            group_id_map[g['id']] = fg.id

        # 3. 插入 group_funds
        for gf in group_funds:
            new_gid = group_id_map.get(gf['group_id'])
            if new_gid:
                last_date_str = gf.get('last_auto_invest_date')
                last_date = dt.strptime(last_date_str, '%Y-%m-%d').date() if last_date_str else None
                nf = GroupFund(
                    group_id=new_gid,
                    fund_code=gf['fund_code'],
                    sort_order=gf.get('sort_order', 0),
                    amount=gf.get('amount', 0),
                    is_auto_invest=gf.get('is_auto_invest', False),
                    auto_invest_amount=gf.get('auto_invest_amount', 0),
                    last_auto_invest_date=last_date
                )
                db.add(nf)
        await db.commit()
        
        # 4. 插入 market_funds
        for mf in market_funds:
            nmf = MarketFund(
                user_id=uuid.UUID(mf['user_id']),
                fund_code=mf['fund_code'],
                short_name=mf.get('short_name'),
                sort_order=mf.get('sort_order', 0)
            )
            db.add(nmf)
        await db.commit()

        # 5. 插入 alert_config
        for ac in alert_configs:
            try:
                nac = UserAlertConfig(
                    user_id=uuid.UUID(ac['user_id']),
                    is_enabled=ac.get('is_enabled', True),
                    threshold=ac.get('threshold', 2.0),
                    email_receiver=ac.get('email_receiver')
                )
                db.add(nac)
                await db.commit()
            except Exception:
                 await db.rollback()
                 
        print("数据迁移完成！")

if __name__ == "__main__":
    asyncio.run(migrate_data())
