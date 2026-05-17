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
FUND_MOBILE_HISTORY_URL = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList"
FOREIGN_FUND_KEYWORDS = (
    "qdii", "fof", "纳斯达克", "标普", "道琼斯", "越南", "印度", "日本", "德国",
    "海外", "全球", "美国", "美股", "港股", "恒生", "香港", "中概", "亚洲",
    "美元", "人民币", "互联", "科技市值"
)

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
    # PATCH/DELETE 可能返回空 body
    try:
        return res.json()
    except Exception:
        return None


def is_foreign_related_fund(code, fund_name=None, fund_type=None):
    if fund_type == "007":
        return True
    text = f"{code} {fund_name or ''}".lower()
    return any(keyword.lower() in text for keyword in FOREIGN_FUND_KEYWORDS)


def pick_change_from_history(items, target_date, allow_previous_date):
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


def fetch_fund_change(code, target_date, fund_name=None):
    """
    获取用于结算的实际涨跌幅（%）。
    国内基金必须匹配 target_date；海外/QDII 基金若目标日尚未更新，允许使用最近一个更早净值日。
    """
    try:
        res = requests.get(
            FUND_MOBILE_HISTORY_URL,
            params={
                "FCODE": code,
                "PageIndex": 1,
                "PageSize": 5,
                "deviceid": "Wap",
                "plat": "Wap",
                "product": "EFund",
                "Version": "2.0.0",
            },
            timeout=3,
            headers={"User-Agent": "Mozilla/5.0", "Referer": "http://fund.eastmoney.com/"}
        )
        if res.ok:
            data = res.json()
            result = pick_change_from_history(
                data.get("Datas", []) or [],
                target_date,
                allow_previous_date=is_foreign_related_fund(code, fund_name),
            )
            if result[0] is not None:
                return result
    except Exception as e:
        print(f"[fetch_change] 移动端历史净值失败 {code}: {e}", file=sys.stderr)

    try:
        res = requests.get(
            FUND_LSJZ_URL,
            params={"fundCode": code, "pageIndex": 1, "pageSize": 5},
            headers={
                "Referer": "http://fund.eastmoney.com/",
                "User-Agent": "Mozilla/5.0"
            },
            timeout=3
        )
        if res.ok:
            data = res.json()
            data_dict = data.get("Data", {}) or {}
            result = pick_change_from_history(
                data_dict.get("LSJZList", []) or [],
                target_date,
                allow_previous_date=is_foreign_related_fund(code, fund_name, data_dict.get("FundType")),
            )
            if result[0] is not None:
                return result
    except Exception as e:
        print(f"[fetch_change] 历史净值失败 {code}: {e}", file=sys.stderr)

    return None, None


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
        target_date = (bj_now - timedelta(days=1)).date()
        target_date_str = target_date.isoformat()
        # 结算上一交易日；目标日期为周末时跳过，但手动可以执行用于补偿。
        if not is_manual and target_date.weekday() >= 5:
            self._send(200, {"success": True, "message": f"{target_date_str} 为周末，不执行自动结算"})
            return

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
                "select": "group_id,fund_code,fund_name,amount,is_auto_invest,auto_invest_amount,last_auto_invest_date"
            })
            
            print(f"[DEBUG] 找到 {len(funds)} 支持仓基金", file=sys.stderr)

            # 并发获取涨跌数据 + 计算 + 更新
            def process_fund(f):
                gid = f.get("group_id")
                code = f.get("fund_code")
                fund_name = f.get("fund_name")
                old_amt = f.get("amount", 0) or 0
                is_auto = f.get("is_auto_invest", False)
                auto_amt = f.get("auto_invest_amount", 0) or 0
                
                # 防重复：目标净值日期已结算过的跳过
                if str(f.get("last_auto_invest_date")) == target_date_str:
                    return f"skipped:{code}", None

                try:
                    # 国内基金只用目标净值日期；海外/QDII 允许使用最近一个更早净值日。
                    change_pct, nav_date = fetch_fund_change(code, target_date_str, fund_name)
                    if change_pct is None:
                        return f"no_data:{code}({target_date_str})", None

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
                        "amount": new_amt, "last_auto_invest_date": target_date_str
                    }, timeout=5)
                    
                    # 构建日志（显式使用北京时间）
                    bj_time_str = get_bj_now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
                    log = {
                        "group_id": gid,
                        "fund_code": code,
                        "date": nav_date or target_date_str,
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

            # 使用线程池并发处理（Vercel 限制执行时间，降低并发数）
            with ThreadPoolExecutor(max_workers=5) as executor:
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
                "date": target_date_str,
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
