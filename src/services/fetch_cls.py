import urllib.parse
import requests
import time
import json

def fetch_and_filter_cls_news(keyword):
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
            
            if keyword and keyword != 'A股':
                if keyword not in content and keyword not in title:
                    continue
            
            show_time = time.strftime('%Y-%m-%d %H:%M', time.localtime(item.get("ctime", time.time())))
            
            result.append({
                'time': show_time,
                'title': title if title else "【财联社电报】",
                'content': content
            })
            
        return json.dumps({'success': True, 'data': result[:30]}, ensure_ascii=False)
        
    except Exception as e:
        return json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False)
