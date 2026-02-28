from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests
import re

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        keyword = query.get('keyword', [''])[0]

        try:
            search_kw = keyword if keyword else "A股"
            
            url = "https://search-api-web.eastmoney.com/search/jsonp"
            inner_param = {
                "uid": "",
                "keyword": search_kw,
                "type": ["cmsArticleWebOld"],
                "client": "web",
                "clientType": "web",
                "clientVersion": "curr",
                "param": {
                    "cmsArticleWebOld": {
                        "searchScope": "default",
                        "sort": "default",
                        "pageIndex": 1,
                        "pageSize": 30,
                        "preTag": "",
                        "postTag": "",
                    }
                },
            }
            params = {
                "cb": "cb",
                "param": json.dumps(inner_param, ensure_ascii=False, separators=(',', ':'))
            }
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Referer": "https://so.eastmoney.com/",
                "Accept": "*/*",
                "Host": "search-api-web.eastmoney.com"
            }
            
            res = requests.get(url, params=params, headers=headers, timeout=8)
            text = res.text
            
            start_idx = text.find('(')
            end_idx = text.rfind(')')
            
            result = []
            if start_idx != -1 and end_idx != -1:
                json_str = text[start_idx+1:end_idx]
                try:
                    data_json = json.loads(json_str)
                except:
                    data_json = {}
                articles = data_json.get("result", {}).get("cmsArticleWebOld", [])
                
                for item in articles:
                    try:
                        title = item.get("title", "").replace("<em>", "").replace("</em>", "")
                        content = item.get("content", "").replace("<em>", "").replace("</em>", "").replace("　", "").replace("\r\n", " ")
                        show_time = item.get("date", "")[:16]
                        url = item.get("url", item.get("artUrl", ""))
                        
                        result.append({
                            'time': show_time,
                            'title': title,
                            'content': content,
                            'url': url
                        })
                    except Exception as loop_e:
                        continue
                        
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': True, 'data': result}
            if not result:
                response['debug_text'] = text[:1000]
                
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            err_trace = traceback.format_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': False, 'error': str(e), 'traceback': err_trace}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
