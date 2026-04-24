from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
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

# 东方财富 API 地址
FUND_GZ_URL = "http://fundgz.1234567.com.cn/js/{code}.js"
FUND_LSJZ_URL = "http://api.fund.eastmoney.com/f10/lsjz"

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
        print(f"Supabase Error [{method} {table}]: {res.text}", file=sys.stderr)
    res.raise_for_status()
    return res.json()


def fetch_fund_change(code):
    """
    获取基金当日涨跌幅（%）
    优先使用盘中实时估值（gszzl），若无则用历史净值（JZZZL）
    返回 float 或 None
    """
    # 1. 尝试实时估值接口
    try:
        res = requests.get(
            FUND_GZ_URL.format(code=code),
            timeout=5,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        if res.ok:
            match = re.search(r'jsonpgz\((.*)\);', res.text)
            if match:
                data = json.loads(match.group(1))
                gszzl = data.get("gszzl")
                if gszzl is not None and gszzl != "":
                    return float(gszzl)
    except Exception as e:
        print(f"[fetch_change] 实时估值失败 {code}: {e}", file=sys.stderr)

    # 2. 回退到历史净值接口（QDII 等无盘中估值的基金）
    try:
        res = requests.get(
            FUND_LSJZ_URL,
            params={"fundCode": code, "pageIndex": 1, "pageSize": 1},
            headers={
                "Referer": "http://fund.eastmoney.com/",
                "User-Agent": "Mozilla/5.0"
            },
            timeout=5
        )
        if res.ok:
            data = res.json()
            lsjz_list = data.get("Data", {}).get("LSJZList", [])
            if lsjz_list:
                jzzzl = lsjz_list[0].get("JZZZL")
                if jzzzl is not None and jzzzl != "":
                    return float(jzzzl)
    except Exception as e:
        print(f"[fetch_change] 历史净值失败 {code}: {e}", file=sys.stderr)

    return None


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
            self._send(200, {"success": True, "message": "周末不执行自动结算"})
            return

        today_str = bj_now.strftime('%Y-%m-%d')
        results = []
        logs_to_insert = []

        try:
            # 权限预校验
            if SUPABASE_SERVICE_KEY.startswith("sb_publishable"):
                msg = "检测到您使用的是 Anon Key，需要使用 service_role key。请前往 Supabase -> Settings -> API 获取。"
                print(f"[ERROR] {msg}", file=sys.stderr)
                self._send(403, {"success": False, "error": msg})
                return

            # 获取所有有持仓金额的基金（amount > 0）
            print(f"[DEBUG] 获取持仓基金... URL: {SUPABASE_URL}", file=sys.stderr)
            
            funds = sb_request("GET", "group_funds", params={
                "amount": "gt.0",
                "select": "group_id,fund_code,amount,is_auto_invest,auto_invest_amount,last_auto_invest_date"
            })
            
            print(f"[DEBUG] 找到 {len(funds)} 支持仓基金", file=sys.stderr)

            # 并发获取涨跌数据 + 计算 + 更新
            def process_fund(f):
                gid = f.get("group_id")
                code = f.get("fund_code")
                old_amt = f.get("amount", 0) or 0
                is_auto = f.get("is_auto_invest", False)
                auto_amt = f.get("auto_invest_amount", 0) or 0
                
                # 防重复：今天已结算过的跳过
                if str(f.get("last_auto_invest_date")) == today_str:
                    return f"skipped:{code}", None

                try:
                    # 获取当日涨跌幅
                    change_pct = fetch_fund_change(code)
                    if change_pct is None:
                        return f"no_data:{code}", None

                    # 计算收益
                    profit = round(old_amt * change_pct / 100, 2)
                    # 定投金额
                    invest_amt = auto_amt if is_auto else 0
                    # 新金额 = 原金额 + 收益 + 定投
                    new_amt = round(old_amt + profit + invest_amt, 2)

                    # 更新持仓金额
                    sb_request("PATCH", "group_funds", params={
                        "group_id": f"eq.{gid}", "fund_code": f"eq.{code}"
                    }, body={
                        "amount": new_amt, "last_auto_invest_date": today_str
                    }, timeout=5)
                    
                    # 构建日志（显式使用北京时间）
                    bj_time_str = get_bj_now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
                    log = {
                        "group_id": gid,
                        "fund_code": code,
                        "date": today_str,
                        "old_amount": old_amt,
                        "amount_added": profit,
                        "invest_amount": invest_amt,
                        "total_amount": new_amt,
                        "created_at": bj_time_str
                    }
                    
                    detail = f"{code}: {old_amt} + ({'+' if profit >= 0 else ''}{profit})"
                    if invest_amt > 0:
                        detail += f" + 定投{invest_amt}"
                    detail += f" = {new_amt}"
                    
                    return f"ok:{detail}", log

                except Exception as e:
                    print(f"处理 {code} 失败: {str(e)}", file=sys.stderr)
                    return f"fail:{code}({str(e)})", None

            # 使用线程池并发处理
            with ThreadPoolExecutor(max_workers=10) as executor:
                future_to_fund = {executor.submit(process_fund, f): f for f in funds}
                for future in as_completed(future_to_fund):
                    res_str, log_entry = future.result()
                    results.append(res_str)
                    if log_entry:
                        logs_to_insert.append(log_entry)

            # 批量写入持仓更新日志
            if logs_to_insert:
                try:
                    sb_request("POST", "auto_invest_logs", body=logs_to_insert, timeout=10)
                except Exception as le:
                    print(f"写入日志失败: {le}", file=sys.stderr)

            # 统计结果
            ok_count = sum(1 for r in results if r.startswith("ok:"))
            skip_count = sum(1 for r in results if r.startswith("skipped:"))
            nodata_count = sum(1 for r in results if r.startswith("no_data:"))
            fail_count = sum(1 for r in results if r.startswith("fail:"))

            self._send(200, {
                "success": True,
                "date": today_str,
                "processed": ok_count,
                "skipped": skip_count,
                "no_data": nodata_count,
                "failed": fail_count,
                "details": results
            })

        except Exception as e:
            print(f"主流程异常: {traceback.format_exc()}", file=sys.stderr)
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
            print(f"发送响应失败: {e}", file=sys.stderr)
            pass

if __name__ == "__main__":
    # 本地调试入口
    req_path = sys.argv[1] if len(sys.argv) > 1 else "/api/auto_invest"
    h = handler.__new__(handler)
    h.path = req_path
    h.headers = {}
    h._send = lambda code, body: print(json.dumps(body, ensure_ascii=False, indent=2))
    h.handle_request()
