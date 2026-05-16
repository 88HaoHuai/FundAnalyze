"""
services/email_service.py — 邮件发送服务
"""
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from datetime import datetime, timezone, timedelta
import config

def get_beijing_time():
    return datetime.now(timezone.utc) + timedelta(hours=8)

def send_alert_email(to_email: str, fund_name: str, fund_code: str, current_change: float) -> bool:
    """使用 SMTP 发送提醒邮件"""
    if not all([config.SMTP_USER, config.SMTP_PASS, to_email]):
        print(f"SMTP 配置缺失，跳过发件给 {to_email}")
        return False

    trend_icon = "📈" if current_change > 0 else "📉"
    trend_text = "大涨监控" if current_change > 0 else "大跌预警"
    sign = "+" if current_change > 0 else ""
    subject = f"{trend_icon}【{trend_text}】{fund_name} ({fund_code}) 当前变动 {sign}{current_change}%"
    body = (
        f"您好，\n\n"
        f"您关注的基金发生较大波动：\n"
        f"  基金名称：{fund_name}\n"
        f"  基金代码：{fund_code}\n"
        f"  当前涨跌：{current_change}%\n"
        f"  触发时间：{get_beijing_time().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        f"（同一基金每日最多提醒 2 次，请合理安排操作。）\n"
        f"——来自 FundAnalyze 自动监控系统"
    )

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['From'] = Header(f"FundAnalyze <{config.SMTP_FROM or config.SMTP_USER}>")
    msg['To'] = to_email
    msg['Subject'] = Header(subject, 'utf-8')

    try:
        server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
        server.login(config.SMTP_USER, config.SMTP_PASS)
        server.sendmail(config.SMTP_USER, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"邮件发送失败: {e}")
        return False
