from http.server import BaseHTTPRequestHandler
import json
import os
import requests
from datetime import datetime, timezone, timedelta
import time

def get_beijing_date_str():
    # 强制返回 YYYY-MM-DD 字符串，确保前端正则匹配不出错
    return (datetime.now(timezone.utc) + timedelta(hours=8)).strftime('%Y-%m-%d')

# ============================================================
# 环境变量配置
# ============================================================
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sb_get(table, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.get(url, headers=supabase_headers(), params=params or {}, timeout=10)
    if not res.ok:
        print(f"GET Error: {res.text}")
    res.raise_for_status()
    return res.json()

def sb_post(table, body):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=supabase_headers(), json=body, timeout=10)
    if not res.ok:
        print(f"POST Error: {res.text}")
    res.raise_for_status()
    return res.json()

def sb_patch(table, query_params, body):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.patch(url, headers=supabase_headers(), params=query_params, json=body, timeout=10)
    if not res.ok:
        print(f"PATCH Error: {res.text}")
    res.raise_for_status()
    return res.json()

# ============================================================
# 交易日判断
# ============================================================
def is_trading_day():
    """粗略判断今天是否为交易日（周一到周五），按照北京时间计算"""
    # 获取北京时间当前的星期几 (0-6)
    bj_now = datetime.now(timezone.utc) + timedelta(hours=8)
    return bj_now.weekday() < 5

# ============================================================
# 主 Handler
# ============================================================
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()
        
    def handle_request(self):
        # 允许手动触发（跳过 cron_secret 校验和交易日限制）
        is_manual = False
        try:
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            if query.get("manual", [""])[0].lower() == "true":
                is_manual = True
        except:
            pass

        cron_secret = os.environ.get("CRON_SECRET", "")
        if cron_secret and not is_manual:
            auth_header = self.headers.get("Authorization", "")
            if auth_header != f"Bearer {cron_secret}":
                self._send(401, {"error": "Unauthorized"})
                return

        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            self._send(500, {"error": "Supabase 环境变量缺失"})
            return
            
        if not is_manual and not is_trading_day():
            self._send(200, {"message": "非交易日，跳过定投结算"})
            return

        today_str = get_beijing_date_str()
        results = []

        try:
            # 1. 查找所有勾选了定投，且定投金额 > 0 的持仓记录
            funds_to_invest = sb_get("group_funds", {
                "is_auto_invest": "eq.true",
                "auto_invest_amount": "gt.0"
            })

            logs_to_insert = []

            for record in funds_to_invest:
                group_id = record.get("group_id")
                fund_code = record.get("fund_code")
                amount = record.get("amount") or 0
                auto_amount = record.get("auto_invest_amount") or 0
                last_date = record.get("last_auto_invest_date")

                if last_date == today_str:
                    results.append(f"skipped (already settled): {fund_code}")
                    continue
                
                new_amount = round(amount + auto_amount, 2)
                try:
                    # 串行更新本金
                    sb_patch("group_funds", {
                        "group_id": f"eq.{group_id}",
                        "fund_code": f"eq.{fund_code}"
                    }, {
                        "amount": new_amount,
                        "last_auto_invest_date": today_str
                    })
                    
                    # 收集日志以备后续批量插入
                    logs_to_insert.append({
                        "group_id": group_id,
                        "fund_code": fund_code,
                        "date": today_str,
                        "amount_added": auto_amount,
                        "total_amount": new_amount
                    })
                    
                    results.append(f"success: {fund_code} ({amount} -> {new_amount})")
                except Exception as e:
                    print(f"更新 {fund_code} 失败: {e}")
                    results.append(f"error: {fund_code}")

            # 批量写入日志
            if logs_to_insert:
                try:
                    sb_post("auto_invest_logs", logs_to_insert)
                except Exception as log_err:
                    print(f"批量写入日志失败: {log_err}")

            self._send(200, {
                "success": True, 
                "date": today_str,
                "processed": len(results),
                "details": results
            })

        except Exception as e:
            import traceback
            self._send(500, {
                "success": False, 
                "error": str(e), 
                "trace": traceback.format_exc()
            })

    def _send(self, code, body):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode())
