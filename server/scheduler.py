"""
scheduler.py — APScheduler 定时任务调度中心（支持数据库动态配置）
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone, timedelta
import httpx

from database import AsyncSessionLocal
from models.user import User
from models.alert_config import UserAlertConfig
from models.fund_group import FundGroup
from models.group_fund import GroupFund
from models.alert_history import AlertHistory
from models.invest_log import AutoInvestLog
from models.cron_log import CronLog
from models.scheduled_task import ScheduledTask
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from services.email_service import send_alert_email
import re
import json

scheduler = AsyncIOScheduler()
FOREIGN_FUND_KEYWORDS = (
    "qdii", "fof", "纳斯达克", "标普", "道琼斯", "越南", "印度", "日本", "德国",
    "海外", "全球", "美国", "美股", "港股", "恒生", "香港", "中概", "亚洲",
    "美元", "人民币", "互联", "科技市值"
)

def get_beijing_time():
    return datetime.now(timezone.utc) + timedelta(hours=8)

async def write_cron_log(task_key: str, status: str, message: str = None, details: dict = None):
    """向数据库写入一条任务执行日志，并更新 ScheduledTask 的 last_run 信息"""
    async with AsyncSessionLocal() as db:
        # 写 CronLog（executed_at 已在模型中默认为北京时间）
        log = CronLog(task_name=task_key, status=status, message=message, details=details)
        db.add(log)
        # 同步更新 ScheduledTask 的最近执行状态（使用北京时间）
        result = await db.execute(select(ScheduledTask).where(ScheduledTask.task_key == task_key))
        task = result.scalar_one_or_none()
        if task:
            task.last_run_at = get_beijing_time()  # 北京时间 UTC+8
            task.last_run_status = status
        await db.commit()

async def is_task_enabled(task_key: str) -> bool:
    """检查某个任务是否在后台被启用"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ScheduledTask).where(ScheduledTask.task_key == task_key))
        task = result.scalar_one_or_none()
        if task is None:
            return True  # 若任务记录不存在，默认执行
        return task.is_enabled

async def fetch_fund_change(code: str) -> tuple[float | None, str | None]:
    """获取基金当日涨跌幅和名称"""
    url = f"http://fundgz.1234567.com.cn/js/{code}.js"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if res.status_code == 200:
                match = re.search(r'jsonpgz\((.*)\);', res.text)
                if match:
                    data = json.loads(match.group(1))
                    gszzl = data.get("gszzl")
                    if gszzl is not None and gszzl != "":
                        return float(gszzl), data.get("name", code)
        except Exception:
            pass
    return None, None

async def job_alerts_check():
    """预警检查定时任务"""
    if not await is_task_enabled("job_alerts_check"):
        return

    today = get_beijing_time().date().isoformat()
    sent_count = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserAlertConfig).where(UserAlertConfig.is_enabled == True))
        configs = result.scalars().all()
        
        for cfg in configs:
            threshold = float(cfg.threshold)
            receiver = cfg.email_receiver
            if not receiver:
                user_res = await db.execute(select(User).where(User.id == cfg.user_id))
                user = user_res.scalar_one_or_none()
                if user:
                    receiver = user.email
            if not receiver:
                continue
            
            g_res = await db.execute(
                select(FundGroup).where(FundGroup.user_id == cfg.user_id).options(selectinload(FundGroup.funds))
            )
            groups = g_res.scalars().all()
            codes = set()
            for g in groups:
                for f in g.funds:
                    codes.add(f.fund_code)
            
            for code in codes:
                change, name = await fetch_fund_change(code)
                if change is not None and abs(change) >= threshold:
                    h_res = await db.execute(
                        select(AlertHistory).where(
                            AlertHistory.user_id == cfg.user_id,
                            AlertHistory.fund_code == code,
                            AlertHistory.sent_at >= f"{today} 00:00:00+08:00"
                        )
                    )
                    history = h_res.scalars().all()
                    if len(history) >= 2:
                        continue
                        
                    ok = send_alert_email(receiver, name or code, code, change)
                    if ok:
                        sent_count += 1
                        hist = AlertHistory(user_id=cfg.user_id, fund_code=code, change_val=change)
                        db.add(hist)
                        await db.commit()

    await write_cron_log("job_alerts_check", "success", f"预警检查完成，本次触发发送 {sent_count} 条邮件")

def is_foreign_related_fund(code: str, fund_name: str | None = None, fund_type: str | None = None) -> bool:
    """识别海外/QDII/跨市场基金，这类基金净值通常比 A 股基金晚一个交易日。"""
    if fund_type == "007":
        return True
    text = f"{code} {fund_name or ''}".lower()
    return any(keyword.lower() in text for keyword in FOREIGN_FUND_KEYWORDS)

def pick_change_from_history(
    items: list[dict],
    target_date: str,
    allow_previous_date: bool,
) -> tuple[float | None, str | None]:
    for item in items:
        if item.get("FSRQ") == target_date:
            jzzzl = item.get("JZZZL")
            if jzzzl is not None and jzzzl != "":
                return float(jzzzl), target_date

    if not allow_previous_date:
        return None, None

    target = datetime.fromisoformat(target_date).date()
    for item in items:
        nav_date_str = item.get("FSRQ")
        jzzzl = item.get("JZZZL")
        if not nav_date_str or jzzzl is None or jzzzl == "":
            continue
        try:
            nav_date = datetime.fromisoformat(nav_date_str).date()
        except ValueError:
            continue
        if nav_date <= target and (target - nav_date).days <= 7:
            return float(jzzzl), nav_date_str

    return None, None

async def fetch_actual_fund_change(code: str, target_date: str, fund_name: str | None = None) -> tuple[float | None, str | None]:
    """
    获取用于结算的实际涨跌幅。
    国内基金必须匹配 target_date；海外/QDII 基金若目标日尚未更新，允许使用最近一个更早净值日。
    返回 (涨跌幅, 净值日期) 或 (None, None)
    """
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "http://fund.eastmoney.com/"
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        # 移动端接口通常比 Web 版 lsjz 更新更快，和 iOS 端“昨日涨跌”口径保持一致。
        try:
            mobile_res = await client.get(
                "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList",
                params={
                    "FCODE": code,
                    "PageIndex": 1,
                    "PageSize": 5,
                    "deviceid": "Wap",
                    "plat": "Wap",
                    "product": "EFund",
                    "Version": "2.0.0",
                },
                headers=headers,
            )
            if mobile_res.status_code == 200:
                data = mobile_res.json()
                result = pick_change_from_history(
                    data.get("Datas", []) or [],
                    target_date,
                    allow_previous_date=is_foreign_related_fund(code, fund_name),
                )
                if result[0] is not None:
                    return result
        except Exception:
            pass

        try:
            res = await client.get(
                "http://api.fund.eastmoney.com/f10/lsjz",
                params={"fundCode": code, "pageIndex": 1, "pageSize": 5},
                headers=headers,
            )
            if res.status_code == 200:
                data = res.json()
                if "Data" in data and data["Data"] and "LSJZList" in data["Data"]:
                    items = data["Data"]["LSJZList"]
                    fund_type = data["Data"].get("FundType")
                    result = pick_change_from_history(
                        items,
                        target_date,
                        allow_previous_date=is_foreign_related_fund(code, fund_name, fund_type),
                    )
                    if result[0] is not None:
                        return result
        except Exception:
            pass
    return None, None

async def job_auto_invest():
    """每日盘后结算定投与收益（第二天凌晨执行，结算前一交易日的实际涨幅）"""
    if not await is_task_enabled("job_auto_invest"):
        await write_cron_log("job_auto_invest", "skipped", "任务已在后台管理中被禁用，跳过本次执行")
        return

    bj_now = get_beijing_time()
    target_date = (bj_now - timedelta(days=1)).date()
    target_date_str = target_date.isoformat()
    
    if target_date.weekday() >= 5:
        await write_cron_log("job_auto_invest", "skipped", f"{target_date_str} 为周末，跳过结算")
        return

    updated_count = 0
    skipped_count = 0
    fund_details = []
    skipped_details = []
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(GroupFund).where(GroupFund.amount > 0))
            funds = result.scalars().all()
            
            for f in funds:
                # 防重：已经结算过这个净值日期的跳过
                if f.last_auto_invest_date == target_date:
                    skipped_count += 1
                    skipped_details.append({"code": f.fund_code, "reason": f"已结算 {f.last_auto_invest_date}"})
                    continue
                    
                # 国内基金只用目标净值日期；海外/QDII 允许使用最近一个更早净值日。
                change, nav_date = await fetch_actual_fund_change(f.fund_code, target_date_str, f.fund_name)
                if change is None:
                    skipped_count += 1
                    skipped_details.append({"code": f.fund_code, "reason": f"未找到可用于 {target_date_str} 结算的净值涨跌"})
                    continue
                
                # 将 nav_date 字符串转换为 date 对象（仅用于日志记录）
                from datetime import date as date_cls
                try:
                    actual_nav_date = date_cls.fromisoformat(nav_date) if nav_date else target_date
                except ValueError:
                    actual_nav_date = target_date
                    
                old_amt = float(f.amount)
                profit = round(old_amt * change / 100, 2)
                invest_amt = float(f.auto_invest_amount) if f.is_auto_invest else 0
                new_amt = round(old_amt + profit + invest_amt, 2)
                
                f.amount = new_amt
                f.last_auto_invest_date = target_date
                
                log = AutoInvestLog(
                    group_id=f.group_id,
                    fund_code=f.fund_code,
                    date=actual_nav_date,  # 日志记录实际净值日期，便于核对
                    old_amount=old_amt,
                    amount_added=profit,
                    invest_amount=invest_amt,
                    total_amount=new_amt
                )
                db.add(log)
                updated_count += 1
                
                fund_details.append({
                    "code": f.fund_code,
                    "nav_date": nav_date,        # 实际净值日期
                    "target_date": target_date_str, # 结算目标日期
                    "change_pct": change,
                    "old_amount": old_amt,
                    "profit": profit,
                    "invest": invest_amt,
                    "new_amount": new_amt
                })
            await db.commit()

        await write_cron_log(
            "job_auto_invest", "success",
            f"持仓结算完成 [{target_date_str}]，更新 {updated_count} 条，跳过 {skipped_count} 条",
            {
                "target_date": target_date_str,
                "updated": updated_count,
                "skipped": skipped_count,
                "fund_results": fund_details,
                "skipped_list": skipped_details,
            }
        )
    except Exception as e:
        await write_cron_log("job_auto_invest", "failed", f"结算异常: {str(e)}")

async def init_scheduled_tasks():
    """首次启动时，将预设的定时任务配置写入数据库（如果不存在则新增）"""
    default_tasks = [
        {
            "task_key": "job_auto_invest",
            "name": "每日持仓自动结算",
            "description": "每日凌晨 00:30 执行，根据天天基金历史净值接口，计算前一交易日的真实涨跌幅，自动更新所有用户的持仓金额。",
            "cron_expression": "周二至周六 00:30 (Asia/Shanghai)",
            "is_enabled": True,
        },
        {
            "task_key": "job_alerts_check",
            "name": "盘中涨跌预警检查",
            "description": "交易日 9:30 至 15:00，每 30 分钟检查一次用户关注基金的涨跌幅，若触发阈值则发送预警邮件（每支基金每天最多发 2 次）。",
            "cron_expression": "周一至周五 09:30-15:00 每30分钟",
            "is_enabled": True,
        }
    ]
    async with AsyncSessionLocal() as db:
        for t in default_tasks:
            result = await db.execute(select(ScheduledTask).where(ScheduledTask.task_key == t["task_key"]))
            if not result.scalar_one_or_none():
                db.add(ScheduledTask(**t))
        await db.commit()

def start_scheduler():
    # 交易日 9:30 - 15:00，每30分钟检查一次预警
    scheduler.add_job(job_alerts_check, 'cron', day_of_week='mon-fri', hour='9-14', minute='*/30', timezone='Asia/Shanghai')
    scheduler.add_job(job_alerts_check, 'cron', day_of_week='mon-fri', hour='15', minute='0', timezone='Asia/Shanghai')
    
    # 周二至周六凌晨 0:30 结算上一日（交易日）的实际涨跌
    scheduler.add_job(job_auto_invest, 'cron', day_of_week='tue-sat', hour='0', minute='30', timezone='Asia/Shanghai')
    
    scheduler.start()
