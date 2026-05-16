"""
models/__init__.py — 统一导出所有 ORM 模型
"""
from .user import User
from .fund_group import FundGroup
from .group_fund import GroupFund
from .market_fund import MarketFund
from .alert_config import UserAlertConfig
from .alert_history import AlertHistory
from .invest_log import AutoInvestLog
from .cron_log import CronLog
from .admin_user import AdminUser
from .scheduled_task import ScheduledTask

__all__ = [
    "User", "FundGroup", "GroupFund", "MarketFund",
    "UserAlertConfig", "AlertHistory", "AutoInvestLog", "CronLog", "AdminUser", "ScheduledTask"
]
