from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        keyword = query.get('keyword', [''])[0]

        try:
            # 使用更通用稳健的 7x24 小时资讯接口 (东方财富)
            api_url = "https://np-anotice-stock.eastmoney.com/api/security/ann?page_size=50&page_index=1&ann_type=A"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            res = requests.get(api_url, headers=headers, timeout=5)
            data_json = res.json()
            
            result = []
            if data_json and 'data' in data_json and 'list' in data_json['data']:
                for item in data_json['data']['list']:
                    title = str(item.get('title', ''))
                    # 此接口没有单独的 content 摘要，内容就在 title 里
                    content = title 
                    show_time = str(item.get('notice_date', ''))[:16] # 截断到分钟
                    
                    if keyword:
                        if keyword.lower() not in title.lower():
                            continue
                    
                    result.append({
                        'time': show_time,
                        'title': "今日财讯",
                        'content': content
                    })
                    
                    if len(result) >= 50:
                        break

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': True, 'data': result}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
