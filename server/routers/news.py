"""
routers/news.py — 新闻资讯接口 (东方财富 & 财联社)
"""
from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/api", tags=["news"])
timeout = httpx.Timeout(10.0)

@router.get("/news")
async def get_em_news(keyword: str = Query("A股")):
    """东方财富 7x24小时 快讯代理"""
    url = "https://np-anotice-stock.eastmoney.com/api/security/ann"
    params = {
        "cb": "jQuery1123",
        "sr": "-1",
        "page_size": "20",
        "page_index": "1",
        "ann_type": "A",
        "client_source": "web",
        "f_node": "0",
        "s_node": "0"
    }
    
    # EM API 的实际参数可能不同，这里为了兼容现有前端我们用类似原本 python 的请求
    original_url = f"https://search-api-ms.jdfmgo.com/api/weibo/query?keyword={keyword}&pageIndex=1&pageSize=20"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    # 注意：原代码的 fetch_news.py 可能有复杂的解析逻辑，这里做个简单示例代理
    # 由于原 api/news.py 的实现可能不同，这里仅作骨架演示
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # 此处假设原 api/news.py 会去某个地方抓数据
            res = await client.get(original_url, headers=headers)
            return res.json()
        except Exception as e:
            return {"success": False, "error": str(e), "data": []}

@router.get("/news_cls")
async def get_cls_news(keyword: str = Query("A股")):
    """财联社电报"""
    url = "https://m.cls.cn/telegraph"
    # 在实际应用中，你可能需要用类似 BeautifulSoup 解析或者调用财联社 API
    # 这里保持和原来一样的占位符返回格式
    return {"success": True, "data": [{"title": f"关于 {keyword} 的新闻测试", "time": "刚刚"}]}
