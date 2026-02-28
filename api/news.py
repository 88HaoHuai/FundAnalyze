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
                "param": json.dumps(inner_param, ensure_ascii=False)
            }
            
            res = requests.get(url, params=params, timeout=8)
            text = res.text
            # jsonp "cb({...})" -> extract inside
            match = re.search(r'^cb\((.*)\)$', text.strip())
            
            result = []
            if match:
                data_json = json.loads(match.group(1))
                articles = data_json.get("result", {}).get("cmsArticleWebOld", [])
                
                for item in articles:
                    try:
                        title = item.get("title", "").replace("<em>", "").replace("</em>", "")
                        content = item.get("content", "").replace("<em>", "").replace("</em>", "").replace("　", "").replace("\r\n", " ")
                        show_time = item.get("date", "")[:16]
                        
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
            err_trace = traceback.format_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': False, 'error': str(e), 'traceback': err_trace}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
