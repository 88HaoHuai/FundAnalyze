from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from datetime import date
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# ============================================================
# 环境变量配置
# ============================================================
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
# 需要使用 service_role key 以绕过 RLS，在 Vercel 中单独配置，与前端 anon key 不同
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.qq.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "")

def supabase_headers():
    """返回访问 Supabase REST API 的请求头"""
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sb_get(table, params=None):
    """查询 Supabase 表"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.get(url, headers=supabase_headers(), params=params or {}, timeout=10)
    res.raise_for_status()
    return res.json()

def sb_post(table, body):
    """向 Supabase 表插入一行"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=supabase_headers(), json=body, timeout=10)
    res.raise_for_status()
    return res.json()

# ============================================================
# 邮件发送
# ============================================================
def send_alert_email(to_email, fund_name, fund_code, current_change):
    """使用 QQ SMTP 发送提醒邮件"""
    if not all([SMTP_USER, SMTP_PASS, to_email]):
        print(f"SMTP 配置缺失，跳过发件给 {to_email}")
        return False

    subject = f"【涨跌提醒】{fund_name} ({fund_code}) 变动 {current_change}%"
    body = (
        f"您好，\n\n"
        f"您关注的基金发生较大波动：\n"
        f"  基金名称：{fund_name}\n"
        f"  基金代码：{fund_code}\n"
        f"  当前涨跌：{current_change}%\n"
        f"  触发时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        f"（同一基金每日最多提醒 2 次，请合理安排操作。）\n"
        f"——来自 FundAnalyze 自动监控系统"
    )

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['From'] = Header(f"FundAnalyze <{SMTP_FROM or SMTP_USER}>")
    msg['To'] = to_email
    msg['Subject'] = Header(subject, 'utf-8')

    try:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, [to_email], msg.as_string())
        server.quit()
        print(f"✅ 已发送邮件给 {to_email}：{fund_code} {current_change}%")
        return True
    except Exception as e:
        print(f"❌ 邮件发送失败: {e}")
        return False

# ============================================================
# 实时行情获取
# ============================================================
def get_realtime_change(code):
    """获取基金盘中估算涨跌幅，返回 (涨跌幅, 基金名称)"""
    url = f"http://fundgz.1234567.com.cn/js/{code}.js?rt={int(time.time())}"
    try:
        res = requests.get(url, timeout=5)
        text = res.text
        if "jsonpgz(" in text:
            start = text.find("(") + 1
            end = text.rfind(")")
            if start > 0 and end > start:
                data = json.loads(text[start:end])
                gszzl = data.get("gszzl")
                if gszzl not in (None, "", "0.00"):
                    return float(gszzl), data.get("name", code)
    except Exception as e:
        print(f"获取 {code} 行情失败: {e}")
    return None, None

# ============================================================
# 主 Handler
# ============================================================
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 安全校验：如果设置了 CRON_SECRET，验证 Authorization Header
        cron_secret = os.environ.get("CRON_SECRET", "")
        if cron_secret:
            auth_header = self.headers.get("Authorization", "")
            if auth_header != f"Bearer {cron_secret}":
                self._send(401, {"error": "Unauthorized"})
                return

        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            self._send(500, {"error": "Supabase 环境变量未配置"})
            return

        try:
            results = []
            today = date.today().isoformat()

            # 1. 查询所有开启提醒的用户配置
            configs = sb_get("user_alert_config", {"is_enabled": "eq.true", "select": "*"})

            for cfg in configs:
                user_id = cfg['user_id']
                threshold = float(cfg.get('threshold', 2.0))
                receiver = cfg.get('email_receiver', '') or ''

                # 没有自定义邮箱时，通过 auth admin API 获取注册邮箱
                if not receiver:
                    try:
                        user_res = requests.get(
                            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                            headers=supabase_headers(),
                            timeout=10
                        )
                        if user_res.ok:
                            receiver = user_res.json().get("email", "")
                    except:
                        pass

                if not receiver:
                    print(f"用户 {user_id} 无接收邮箱，跳过")
                    continue

                # 2. 收集该用户所有关注的基金代码
                codes = set()

                # a. 分组基金
                groups = sb_get("fund_groups", {"user_id": f"eq.{user_id}", "select": "id"})
                g_ids = [g["id"] for g in groups]
                if g_ids:
                    gf = sb_get("group_funds", {
                        "group_id": f"in.({','.join(str(i) for i in g_ids)})",
                        "select": "fund_code"
                    })
                    for f in gf:
                        codes.add(f["fund_code"])

                # b. 市场风向标
                mf = sb_get("market_funds", {"user_id": f"eq.{user_id}", "select": "fund_code"})
                for f in mf:
                    codes.add(f["fund_code"])

                # 3. 并发查询所有基金实时行情（最多 20 个线程，避免超时）
                def fetch_one(code):
                    return code, get_realtime_change(code)

                triggered = []  # 超过阈值的基金列表
                with ThreadPoolExecutor(max_workers=20) as pool:
                    futures = {pool.submit(fetch_one, c): c for c in codes}
                    for future in as_completed(futures, timeout=8):
                        try:
                            code, (curr_change, fund_name) = future.result()
                            if curr_change is not None and abs(curr_change) >= threshold:
                                triggered.append((code, curr_change, fund_name))
                        except Exception:
                            pass

                # 4. 对超阈值基金逐一检查历史并发信
                for code, curr_change, fund_name in triggered:
                    hist = sb_get("alert_history", {
                        "user_id": f"eq.{user_id}",
                        "fund_code": f"eq.{code}",
                        "sent_at": f"gte.{today}T00:00:00",
                        "select": "id"
                    })

                    if len(hist) >= 2:
                        print(f"  {code} 今日已发 {len(hist)} 封，跳过")
                        continue

                    # 5. 发送邮件
                    ok = send_alert_email(receiver, fund_name, code, curr_change)
                    if ok:
                        # 6. 记录发送历史（失败不阻断）
                        try:
                            sb_post("alert_history", {
                                "user_id": user_id,
                                "fund_code": code,
                                "change_val": curr_change
                            })
                        except Exception as e:
                            print(f"写入 alert_history 失败（不影响发信）: {e}")
                        results.append(f"sent:{code}({curr_change}%) -> {receiver}")

            self._send(200, {"success": True, "count": len(results), "results": results})

        except Exception as e:
            import traceback
            self._send(500, {"success": False, "error": str(e), "trace": traceback.format_exc()})

    def _send(self, code, body):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode())
