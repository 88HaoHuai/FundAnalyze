import sys
import json
import requests

import akshare as ak

def fetch_and_filter_news(keyword):
    try:
        # Default fallback keyword if nothing provided
        search_kw = keyword if keyword else "A股"
        
        # Use akshare's real financial news API
        df = ak.stock_news_em(symbol=search_kw)
        
        result = []
        if not df.empty:
            # Sort by time just in case, though it usually comes sorted
            df = df.sort_values(by='发布时间', ascending=False)
            
            # Take top 30 news
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
                    
        print(json.dumps({'success': True, 'data': result}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    kw = sys.argv[1] if len(sys.argv) > 1 else ""
    fetch_and_filter_news(kw)
