import asyncio
from database import engine
from sqlalchemy import text

async def upgrade():
    async with engine.begin() as conn:
        try:
            # 尝试给 group_funds 表添加 fund_name 列
            await conn.execute(text("ALTER TABLE group_funds ADD COLUMN fund_name VARCHAR(100);"))
            print("成功：已为 group_funds 表添加 fund_name 列！")
        except Exception as e:
            print("列可能已存在或添加失败，忽略该错误。详情:", e)

if __name__ == "__main__":
    asyncio.run(upgrade())
