from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests
import akshare as ak

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        keyword = query.get('keyword', [''])[0]

        try:
            search_kw = keyword if keyword else "A股"
            
            # Use akshare's real financial news API
            df = ak.stock_news_em(symbol=search_kw)
            
            result = []
            if not df.empty:
                df = df.sort_values(by='发布时间', ascending=False)
                
                for _, row in df.head(30).iterrows():
                    try:
                        title = str(row['新闻标题'])
                        content = str(row['新闻内容'])
                        show_time = str(row['发布时间'])[:16] # "2026-02-27 13:14"
                        
                        result.append({
                            'time': show_time,
                            'title': title,
                            'content': content
                        })
                    except Exception as loop_e:
                        continue

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
