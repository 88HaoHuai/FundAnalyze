from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests
import time
import traceback

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        keyword = query.get('keyword', [''])[0].strip()

        try:
            url = "https://www.cls.cn/nodeapi/telegraphList"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Host": "www.cls.cn",
                "Origin": "https://www.cls.cn",
                "Referer": "https://www.cls.cn/telegraph"
            }
            
            all_articles = []
            # fetch up to 2 pages (100 items) to ensure we get some keyword matches if requested
            for page in range(1, 3):
                params = {
                    "app": "CailianpressWeb",
                    "category": "",
                    "page": page,
                    "rn": 50
                }
                res = requests.get(url, params=params, headers=headers, timeout=8)
                data = res.json()
                items = data.get("data", {}).get("roll_data", [])
                if items:
                    all_articles.extend(items)
                else:
                    break

            result = []
            for item in all_articles:
                content = item.get("content", "")
                title = item.get("title", "")
                
                # simulate str.contains
                if keyword and keyword != 'A股':
                    if keyword not in content and keyword not in title:
                        continue
                
                show_time = time.strftime('%Y-%m-%d %H:%M', time.localtime(item.get("ctime", time.time())))
                
                result.append({
                    'time': show_time,
                    'title': title if title else "【财联社电报】",
                    'content': content
                })

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': True, 'data': result}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            err_trace = traceback.format_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': False, 'error': str(e), 'traceback': err_trace}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
