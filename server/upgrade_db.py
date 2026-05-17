import asyncio
from database import engine
from sqlalchemy import text

async def upgrade():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE group_funds ADD COLUMN fund_name VARCHAR(100);"))
            print("成功：已为 group_funds 表添加 fund_name 列！")
        except Exception as e:
            print("group_funds.fund_name 列可能已存在或添加失败，忽略该错误。详情:", e)

        try:
            await conn.execute(text("ALTER TABLE group_funds ADD COLUMN fund_type VARCHAR(50);"))
            print("成功：已为 group_funds 表添加 fund_type 列！")
        except Exception as e:
            print("group_funds.fund_type 列可能已存在或添加失败，忽略该错误。详情:", e)

        try:
            await conn.execute(text("ALTER TABLE group_funds ADD COLUMN fund_keywords VARCHAR(500);"))
            print("成功：已为 group_funds 表添加 fund_keywords 列！")
        except Exception as e:
            print("group_funds.fund_keywords 列可能已存在或添加失败，忽略该错误。详情:", e)

if __name__ == "__main__":
    asyncio.run(upgrade())
