from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import sys
import collections
# try import akshare
import akshare as ak

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 解析查询参数
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        keyword = query.get('keyword', [''])[0]

        try:
            # 获取东方财富全球快讯
            df = ak.stock_info_global_em()
            news_list = df.to_dict(orient='records')
            
            result = []
            for item in news_list:
                title = str(item.get('标题', ''))
                content = str(item.get('内容', ''))
                time_str = str(item.get('时间', ''))
                
                # 关键词匹配
                if keyword:
                    if keyword.lower() not in title.lower() and keyword.lower() not in content.lower():
                        continue
                
                result.append({
                    'time': time_str,
                    'title': title,
                    'content': content
                })
                
                if len(result) >= 100:
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
