from http.server import BaseHTTPRequestHandler
import json
import os
import requests
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs
import traceback

# ============================================================
# 环境变量配置
# ============================================================
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def get_bj_now():
    return datetime.now(timezone.utc) + timedelta(hours=8)

def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sb_request(method, table, params=None, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.request(method, url, headers=supabase_headers(), params=params, json=body, timeout=15)
    if not res.ok:
        print(f"Supabase Error [{method} {table}]: {res.text}")
    res.raise_for_status()
    return res.json()

# ============================================================
# 主 Handler
# ============================================================
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()
        
    def handle_request(self):
        # 1. 基础环境校验
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            self._send(500, {"success": False, "error": "Supabase 配置缺失"})
            return

        # 2. 解析请求参数
        is_manual = False
        try:
            query = parse_qs(urlparse(self.path).query)
            if query.get("manual", [""])[0].lower() == "true":
                is_manual = True
        except:
            pass

        # 3. 安全与时间校验
        cron_secret = os.environ.get("CRON_SECRET", "")
        if cron_secret and not is_manual:
            if self.headers.get("Authorization") != f"Bearer {cron_secret}":
                self._send(401, {"success": False, "error": "Unauthorized"})
                return

        bj_now = get_bj_now()
        if not is_manual and bj_now.weekday() >= 5:
            self._send(200, {"success": True, "message": "周末不执行定投结算"})
            return

        today_str = bj_now.strftime('%Y-%m-%d')
        results = []
        logs_to_insert = []

        try:
            # 4. 获取需要结算的持仓
            funds = sb_request("GET", "group_funds", params={
                "is_auto_invest": "eq.true",
                "auto_invest_amount": "gt.0"
            })

            for f in funds:
                gid, code = f.get("group_id"), f.get("fund_code")
                curr_amt, auto_amt = f.get("amount", 0) or 0, f.get("auto_invest_amount", 0) or 0
                
                if f.get("last_auto_invest_date") == today_str:
                    results.append(f"skipped:{code}")
                    continue

                try:
                    new_amt = round(curr_amt + auto_amt, 2)
                    # 执行本金更新
                    sb_request("PATCH", "group_funds", params={
                        "group_id": f"eq.{gid}", "fund_code": f"eq.{code}"
                    }, body={
                        "amount": new_amt, "last_auto_invest_date": today_str
                    })
                    
                    # 准备日志
                    logs_to_insert.append({
                        "group_id": gid, "fund_code": code, "date": today_str,
                        "amount_added": auto_amt, "total_amount": new_amt
                    })
                    results.append(f"ok:{code}")
                except Exception as e:
                    results.append(f"fail:{code}({str(e)})")

            # 5. 批量写入日志
            if logs_to_insert:
                try:
                    sb_request("POST", "auto_invest_logs", body=logs_to_insert)
                except Exception as le:
                    print(f"Log error: {le}")

            self._send(200, {
                "success": True, "date": today_str, 
                "processed": len(results), "details": results
            })

        except Exception as e:
            self._send(500, {
                "success": False, "error": str(e), "trace": traceback.format_exc()
            })

    def _send(self, code, body):
        try:
            self.send_response(code)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(body, ensure_ascii=False).encode('utf-8'))
        except:
            pass # 防止二次报错导致崩溃
