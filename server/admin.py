from sqladmin import Admin, ModelView, action
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from sqlalchemy.future import select
from passlib.context import CryptContext
from models import User, FundGroup, GroupFund, MarketFund, UserAlertConfig, AlertHistory, AutoInvestLog, CronLog, AdminUser, ScheduledTask
from database import AsyncSessionLocal
from fastapi import FastAPI
from datetime import timezone, timedelta
import secrets
import asyncio

# 北京时区 UTC+8
CST = timezone(timedelta(hours=8))

def fmt_cst(dt):
    """将任意时区的 datetime 转换为北京时间并格式化输出"""
    if dt is None:
        return "--"
    # 如果没有时区信息，假设它是 UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CST).strftime("%Y-%m-%d %H:%M:%S")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AdminUser).where(AdminUser.username == username))
            admin_user = result.scalar_one_or_none()
            if admin_user and pwd_context.verify(password, admin_user.hashed_password):
                if not admin_user.is_active:
                    return False
                # 登录成功，设置 session
                request.session.update({"token": "admin_token_" + str(admin_user.id)})
                return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token:
            return False
        return True

# 定义各个模型的显示视图
class AdminUserAdmin(ModelView, model=AdminUser):
    name = "管理员"
    name_plural = "管理员列表"
    icon = "fa-solid fa-user-shield"
    column_list = [AdminUser.id, AdminUser.username, AdminUser.is_active, AdminUser.created_at]
    column_labels = {
        "id": "ID",
        "username": "用户名",
        "is_active": "激活状态",
        "created_at": "创建时间"
    }

class UserAdmin(ModelView, model=User):
    name = "用户"
    name_plural = "用户列表"
    icon = "fa-solid fa-users"
    column_list = [User.id, User.email, User.created_at]
    column_labels = {
        "id": "ID",
        "email": "邮箱",
        "created_at": "注册时间"
    }

class FundGroupAdmin(ModelView, model=FundGroup):
    name = "基金分组"
    name_plural = "基金分组管理"
    icon = "fa-solid fa-layer-group"
    column_list = [FundGroup.id, FundGroup.user_id, FundGroup.name, FundGroup.is_market, FundGroup.sort_order]
    column_labels = {
        "id": "ID",
        "user_id": "用户ID",
        "name": "分组名称",
        "is_market": "市场风向标",
        "sort_order": "排序"
    }

class GroupFundAdmin(ModelView, model=GroupFund):
    name = "基金持仓"
    name_plural = "持仓数据管理"
    icon = "fa-solid fa-chart-pie"
    column_list = [GroupFund.id, GroupFund.group_id, GroupFund.fund_name, GroupFund.fund_code, GroupFund.amount, GroupFund.is_auto_invest]
    column_labels = {
        "id": "ID",
        "group_id": "分组ID",
        "fund_name": "基金名称",
        "fund_code": "基金代码",
        "amount": "持仓金额",
        "is_auto_invest": "是否定投"
    }

class UserAlertConfigAdmin(ModelView, model=UserAlertConfig):
    name = "预警配置"
    name_plural = "预警提醒配置"
    icon = "fa-solid fa-bell"
    column_list = [UserAlertConfig.id, UserAlertConfig.user_id, UserAlertConfig.is_enabled, UserAlertConfig.threshold]
    column_labels = {
        "id": "ID",
        "user_id": "用户ID",
        "is_enabled": "启用提醒",
        "threshold": "预警阈值(%)"
    }

class AlertHistoryAdmin(ModelView, model=AlertHistory):
    name = "预警日志"
    name_plural = "预警发送历史"
    icon = "fa-solid fa-history"
    column_list = [AlertHistory.id, AlertHistory.user_id, AlertHistory.fund_code, AlertHistory.change_val, AlertHistory.sent_at]
    column_labels = {
        "id": "ID",
        "user_id": "用户ID",
        "fund_code": "基金代码",
        "change_val": "触发涨跌幅",
        "sent_at": "发送时间"
    }

class AutoInvestLogAdmin(ModelView, model=AutoInvestLog):
    name = "定投结算日志"
    name_plural = "定投结算记录"
    icon = "fa-solid fa-calendar-check"
    category = "任务日志"
    column_list = [AutoInvestLog.id, AutoInvestLog.group_id, AutoInvestLog.fund_code, AutoInvestLog.date, AutoInvestLog.total_amount]
    column_labels = {
        "id": "ID",
        "group_id": "分组ID",
        "fund_code": "基金代码",
        "date": "结算日期",
        "total_amount": "结算后总额"
    }

class CronLogAdmin(ModelView, model=CronLog):
    name = "任务执行日志"
    name_plural = "定时任务执行日志"
    icon = "fa-solid fa-microchip"
    category = "任务日志"
    # 列表视图
    column_list = [CronLog.id, CronLog.task_name, CronLog.status, CronLog.message, CronLog.executed_at]
    # 详情页视图（包含 details JSON 明细）
    column_details_list = [
        CronLog.id, CronLog.task_name, CronLog.status,
        CronLog.message, CronLog.details, CronLog.executed_at
    ]
    column_labels = {
        "id": "ID",
        "task_name": "任务标识",
        "status": "执行状态",
        "message": "执行摘要",
        "details": "执行明细 (JSON)",
        "executed_at": "执行时间 (北京)"
    }
    # 将执行时间转换为北京时间展示
    column_formatters = {
        "executed_at": lambda m, a: fmt_cst(m.executed_at)
    }
    column_formatters_detail = {
        "executed_at": lambda m, a: fmt_cst(m.executed_at)
    }
    can_create = False
    can_edit = False
    can_view_details = True   # 开启眼睛图标进入详情页

class MarketFundAdmin(ModelView, model=MarketFund):
    name = "市场风向标"
    name_plural = "市场风向标管理"
    icon = "fa-solid fa-compass"
    category = "市场配置"
    column_list = [MarketFund.id, MarketFund.fund_code, MarketFund.fund_name, MarketFund.category, MarketFund.sort_order]
    column_labels = {
        "id": "ID",
        "fund_code": "基金代码",
        "fund_name": "显示名称",
        "category": "分类",
        "sort_order": "排序"
    }
    column_searchable_list = [MarketFund.fund_code, MarketFund.fund_name, MarketFund.category]
    column_sortable_list = [MarketFund.sort_order, MarketFund.category]

class ScheduledTaskAdmin(ModelView, model=ScheduledTask):
    name = "定时任务"
    name_plural = "定时任务配置"
    icon = "fa-solid fa-clock"
    category = "任务日志"
    column_list = [ScheduledTask.id, ScheduledTask.name, ScheduledTask.cron_expression, ScheduledTask.is_enabled, ScheduledTask.last_run_at, ScheduledTask.last_run_status]
    column_labels = {
        "id": "ID",
        "task_key": "任务标识符",
        "name": "任务名称",
        "description": "任务说明",
        "cron_expression": "执行时间",
        "is_enabled": "是否开启",
        "last_run_at": "上次执行时间 (北京)",
        "last_run_status": "上次执行状态",
        "created_at": "创建时间"
    }
    # 将执行时间转换为北京时间展示
    column_formatters = {
        "last_run_at": lambda m, a: fmt_cst(m.last_run_at)
    }
    # 仅允许编辑（开关和说明），不允许新建或删除，避免误操作
    can_create = False
    can_delete = False

    @action(
        name="manual_trigger",
        label="⚡ 手动触发",
        confirmation_message="确认手动执行此任务？执行结果请在「定时任务执行日志」中查看。",
        add_in_detail=True,
        add_in_list=True,
    )
    async def manual_trigger_action(self, request: Request):
        # 延迟导入，避免循环引用
        from scheduler import job_auto_invest, job_alerts_check
        task_map = {
            "job_auto_invest":  job_auto_invest,
            "job_alerts_check": job_alerts_check,
        }

        pks = request.query_params.get("pks", "")
        pk_list = [p.strip() for p in pks.split(",") if p.strip()]

        for pk in pk_list:
            try:
                pk_int = int(pk)
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(ScheduledTask).where(ScheduledTask.id == pk_int)
                    )
                    task = result.scalar_one_or_none()
                    if task and task.task_key in task_map:
                        # 异步弹出到后台执行，不阻塞 admin 页面
                        asyncio.create_task(task_map[task.task_key]())
            except Exception as e:
                print(f"[手动触发失败] pk={pk}: {e}")

        # 回跳到来源页，避免 url_for 路由名版本差异导致 404
        referer = request.headers.get("referer")
        redirect_url = referer if referer else "/admin"
        return RedirectResponse(redirect_url, status_code=302)


def setup_admin(app: FastAPI, engine):
    # 使用随机字符串作为 secret_key (在生产环境中应该使用环境变量配置)
    authentication_backend = AdminAuth(secret_key=secrets.token_hex(16))
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend, title="FundAnalyze Admin")
    
    admin.add_view(AdminUserAdmin)
    admin.add_view(UserAdmin)
    admin.add_view(FundGroupAdmin)
    admin.add_view(GroupFundAdmin)
    admin.add_view(MarketFundAdmin)
    admin.add_view(UserAlertConfigAdmin)
    admin.add_view(AlertHistoryAdmin)
    admin.add_view(AutoInvestLogAdmin)
    admin.add_view(CronLogAdmin)
    admin.add_view(ScheduledTaskAdmin)
    
    return admin
