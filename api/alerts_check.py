from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from datetime import datetime, date
import time
from supabase import create_client, Client

# Supabase 配置
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY") # 建议 Vercel 侧使用 SERVICE_ROLE_KEY 以绕过 RLS
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# SMTP 配置
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.qq.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_FROM = os.environ.get("SMTP_FROM")

def send_alert_email(to_email, fund_name, fund_code, current_change):
    """发送提醒邮件"""
    if not all([SMTP_USER, SMTP_PASS, to_email]):
        print(f"SMTP 配置缺失，无法发送给 {to_email}")
        return False
    
    subject = f"【涨跌提醒】{fund_name} ({fund_code}) 今日变动 {current_change}%"
    body = f"""
    您好，
    
    您关注的基金发生剧烈波动：
    基金名称：{fund_name}
    基金代码：{fund_code}
    当前涨跌：{current_change}%
    提醒时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    
    (本邮件由 FundAnalyze 系统自动发送，相同基金每日最多提醒 2 次)
    """
    
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['From'] = Header(f"FundAnalyze <{SMTP_FROM or SMTP_USER}>")
    msg['To'] = Header(to_email)
    msg['Subject'] = Header(subject, 'utf-8')
    
    try:
        # 使用 SSL
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"邮件发送失败: {str(e)}")
        return False

def get_realtime_change(code):
    """获取基金实时涨跌幅"""
    url = f"http://fundgz.1234567.com.cn/js/{code}.js?rt={int(time.time())}"
    try:
        res = requests.get(url, timeout=5)
        text = res.text
        if "jsonpgz(" in text:
            start = text.find("(") + 1
            end = text.rfind(")")
            data = json.loads(text[start:end])
            return float(data.get("gszzl", 0)), data.get("name", code)
    except:
        pass
    return None, None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. 安全校验 (Vercel Cron 会带此 Header)
        cron_secret = os.environ.get("CRON_SECRET")
        auth_header = self.headers.get("Authorization")
        
        # 如果设置了密钥，则进行校验
        if cron_secret and auth_header != f"Bearer {cron_secret}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Unauthorized")
            return

        try:
            # 2. 获取开启提醒的用户配置
            # 注意：此处建议在 Vercel 侧将 VITE_SUPABASE_ANON_KEY 替换为 SERVICE_ROLE_KEY
            # 否则只能查到 RLS 允许的数据。为了轮询所有用户，必须用管理员权限。
            configs_res = supabase.table("user_alert_config").select("*, auth_users:user_id(email)").eq("is_enabled", True).execute()
            configs = configs_res.data
            
            results = []
            today = date.today().isoformat()

            for cfg in configs:
                user_id = cfg['user_id']
                # 确定接收邮箱：优先使用设置的，其次使用注册邮箱
                receiver_email = cfg.get('email_receiver') or cfg.get('auth_users', {}).get('email')
                threshold = float(cfg.get('threshold', 2.0))
                
                # 获取该用户关注的所有基金代码
                # a) 分组基金
                g_res = supabase.table("fund_groups").select("id").eq("user_id", user_id).execute()
                g_ids = [g['id'] for g in g_res.data]
                f_res = supabase.table("group_funds").select("fund_code").in_("group_id", g_ids).execute()
                codes = set([f['fund_code'] for f in f_res.data])
                
                # b) 市场风向标
                m_res = supabase.table("market_funds").select("fund_code").eq("user_id", user_id).execute()
                for f in m_res.data:
                    codes.add(f['fund_code'])
                
                # 3. 遍历检查实时数据
                for code in codes:
                    curr_change, fund_name = get_realtime_change(code)
                    if curr_change is not None and abs(curr_change) >= threshold:
                        # 4. 检查今日已发送记录
                        # 统计 sent_at 在今天的记录数
                        hist_res = supabase.table("alert_history") \
                            .select("id") \
                            .eq("user_id", user_id) \
                            .eq("fund_code", code) \
                            .gte("sent_at", f"{today}T00:00:00") \
                            .execute()
                        
                        if len(hist_res.data) < 2:
                            # 5. 发送邮件
                            success = send_alert_email(receiver_email, fund_name, code, curr_change)
                            if success:
                                # 6. 记录历史
                                supabase.table("alert_history").insert({
                                    "user_id": user_id,
                                    "fund_code": code,
                                    "change_val": curr_change
                                }).execute()
                                results.append(f"Sent: {code} to {receiver_email}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "results": results}).encode())

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())
