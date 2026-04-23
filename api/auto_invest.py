from http.server import BaseHTTPRequestHandler
import json
import os
import requests
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

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

def sb_request(method, table, params=None, body=None, timeout=10):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.request(method, url, headers=supabase_headers(), params=params, json=body, timeout=timeout)
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
        # 周末不执行自动结算，但手动可以执行
        if not is_manual and bj_now.weekday() >= 5:
            self._send(200, {"success": True, "message": "周末不执行定投结算"})
            return

        today_str = bj_now.strftime('%Y-%m-%d')
        results = []
        logs_to_insert = []

        try:
            # 4. 获取需要结算的持仓
            print(f"[DEBUG] Fetching funds... URL: {SUPABASE_URL}")
            print(f"[DEBUG] Using Key Prefix: {SUPABASE_SERVICE_KEY[:10]}...")
            
            funds = sb_request("GET", "group_funds", params={
                "is_auto_invest": "eq.true",
                "auto_invest_amount": "gt.0"
            })
            
            print(f"[DEBUG] Found {len(funds)} funds matching criteria.")

            # 并发执行更新任务
            def process_fund(f):
                gid, code = f.get("group_id"), f.get("fund_code")
                curr_amt, auto_amt = f.get("amount", 0) or 0, f.get("auto_invest_amount", 0) or 0
                
                # 如果今天已经结算过，跳过
                if str(f.get("last_auto_invest_date")) == today_str:
                    return f"skipped:{code}", None

                try:
                    new_amt = round(curr_amt + auto_amt, 2)
                    # 执行本金更新 (使用较短的超时，避免阻塞整个线程池)
                    sb_request("PATCH", "group_funds", params={
                        "group_id": f"eq.{gid}", "fund_code": f"eq.{code}"
                    }, body={
                        "amount": new_amt, "last_auto_invest_date": today_str
                    }, timeout=5)
                    
                    log = {
                        "group_id": gid, "fund_code": code, "date": today_str,
                        "amount_added": auto_amt, "total_amount": new_amt
                    }
                    return f"ok:{code}", log
                except Exception as e:
                    print(f"Update fail for {code}: {str(e)}")
                    return f"fail:{code}({str(e)})", None

            # 使用线程池加速 (Vercel 环境建议不要开太大，10-20 即可)
            with ThreadPoolExecutor(max_workers=15) as executor:
                future_to_fund = {executor.submit(process_fund, f): f for f in funds}
                for future in as_completed(future_to_fund):
                    res_str, log_entry = future.result()
                    results.append(res_str)
                    if log_entry:
                        logs_to_insert.append(log_entry)

            # 5. 批量写入日志
            if logs_to_insert:
                try:
                    sb_request("POST", "auto_invest_logs", body=logs_to_insert, timeout=10)
                except Exception as le:
                    print(f"Log bulk write error: {le}")

            self._send(200, {
                "success": True, "date": today_str, 
                "processed": len(results), "details": results
            })

        except Exception as e:
            print(f"Main processing error: {traceback.format_exc()}")
            self._send(500, {
                "success": False, "error": str(e), "trace": traceback.format_exc()
            })

    def _send(self, code, body):
        try:
            self.send_response(code)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(body, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            print(f"Send response error: {e}")
            pass

if __name__ == "__main__":
    import sys
    # 模拟 Vercel 环境下的请求执行
    class MockHandler:
        def __init__(self, path):
            self.path = path
            self.headers = {}
        def _send(self, code, body):
            print(json.dumps(body, ensure_ascii=False))
        def send_response(self, code): pass
        def send_header(self, k, v): pass
        def end_headers(self): pass

    # 从命令行获取参数，例如：python3 auto_invest.py "/api/auto_invest?manual=true"
    req_path = sys.argv[1] if len(sys.argv) > 1 else "/api/auto_invest"
    h = handler.__new__(handler)
    h.path = req_path
    h.headers = {}
    # 覆盖 _send 以便输出到 stdout
    h._send = lambda code, body: print(json.dumps(body, ensure_ascii=False))
    
    # 捕获标准输出的打印（Supabase Error等），防止混入 JSON
    h.handle_request()

