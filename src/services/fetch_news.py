import sys
import json
import akshare as ak
import datetime

def fetch_and_filter_news(keyword):
    try:
        # 获取东方财富全球快讯
        df = ak.stock_info_global_em()
        
        # 东方财富的数据栏位通常包含：'时间', '标题', '内容' 等
        # 将 DataFrame 转为字典列表
        news_list = df.to_dict(orient='records')
        
        result = []
        for item in news_list:
            title = str(item.get('标题', ''))
            content = str(item.get('内容', ''))
            time_str = str(item.get('时间', ''))
            
            # 如果有关键词要求，则进行粗略匹配
            if keyword:
                if keyword.lower() not in title.lower() and keyword.lower() not in content.lower():
                    continue
            
            result.append({
                'time': time_str,
                'title': title,
                'content': content
            })
            
            # 限制返回条数，避免前端卡顿
            if len(result) >= 100:
                break
                
        print(json.dumps({'success': True, 'data': result}, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    # 接收运行参数作为关键词
    kw = sys.argv[1] if len(sys.argv) > 1 else ""
    fetch_and_filter_news(kw)
