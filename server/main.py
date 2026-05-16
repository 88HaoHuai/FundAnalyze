"""
main.py — FastAPI 启动入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import auth, groups, funds, news, ai
from scheduler import start_scheduler, scheduler, init_scheduled_tasks
from admin import setup_admin
from database import engine, Base, AsyncSessionLocal
from models import AdminUser
from sqlalchemy.future import select
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_default_admin():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AdminUser).where(AdminUser.username == "fundhhao"))
        if not result.scalars().first():
            print("初始化管理员: fundhhao")
            hashed = pwd_context.hash("hao3187430!")
            new_admin = AdminUser(username="fundhhao", hashed_password=hashed)
            db.add(new_admin)
            await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 确保数据库表被创建 (如果在用 Alembic，这步可以不做，但为了保证运行，这里带上)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    await init_default_admin()
    
    # 初始化定时任务配置到数据库（首次运行写入，后续跳过）
    await init_scheduled_tasks()
        
    # 启动定时任务
    start_scheduler()
    yield
    # 停止定时任务
    scheduler.shutdown()

app = FastAPI(
    title="FundAnalyze API",
    description="Backend API for FundAnalyze (React Web & iOS)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置，允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境请限制具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(funds.router)
app.include_router(news.router)
app.include_router(ai.router)

# 挂载 SQLAdmin
admin = setup_admin(app, engine)

@app.get("/")
async def root():
    return {"message": "Welcome to FundAnalyze API"}

if __name__ == "__main__":
    import uvicorn
    # 本地开发启动命令：python main.py
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
