import sys
import json
import requests

def fetch_and_filter_news(keyword):
    try:
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
                content = title
                show_time = str(item.get('notice_date', ''))[:16]
                
                if keyword:
                    if keyword.lower() not in title.lower():
                        continue
                
                result.append({
                    'time': show_time,
                    'title': "行情资讯",
                    'content': content
                })
                if len(result) >= 50:
                    break
        print(json.dumps({'success': True, 'data': result}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    kw = sys.argv[1] if len(sys.argv) > 1 else ""
    fetch_and_filter_news(kw)
