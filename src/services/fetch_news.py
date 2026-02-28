import sys
import json
import requests
import re

def fetch_and_filter_news(keyword):
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
        
        res = requests.get(url, params=params, timeout=8)
        text = res.text
        
        # JSONP extract, fallback to string split
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
                    
                    result.append({
                        'time': show_time,
                        'title': title,
                        'content': content
                    })
                except Exception as loop_e:
                    continue
                    
        print(json.dumps({'success': True, 'data': result}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    kw = sys.argv[1] if len(sys.argv) > 1 else ""
    fetch_and_filter_news(kw)
