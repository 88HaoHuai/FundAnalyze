"""
routers/news.py — 新闻资讯接口 (东方财富 & 财联社)
"""
from datetime import datetime
import json
import re

from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/api", tags=["news"])
timeout = httpx.Timeout(10.0)


def _clean_html_marks(text: str) -> str:
    cleaned = text.replace("<em>", "").replace("</em>", "")
    cleaned = cleaned.replace("　", "").replace("\r\n", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", cleaned).strip()


def _format_ts(ts: int | float | None) -> str:
    if not ts:
        return "刚刚"
    try:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return "刚刚"


@router.get("/news")
async def get_em_news(keyword: str = Query("A股")):
    """东方财富新闻搜索结果，作为资讯流真实数据源"""
    search_kw = keyword or "A股"
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
        "param": json.dumps(inner_param, ensure_ascii=False, separators=(",", ":"))
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://so.eastmoney.com/",
        "Accept": "*/*",
        "Host": "search-api-web.eastmoney.com"
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, params=params, headers=headers)
            res.raise_for_status()
            text = res.text

            start_idx = text.find("(")
            end_idx = text.rfind(")")
            if start_idx == -1 or end_idx == -1:
                return {"success": True, "data": []}

            payload = json.loads(text[start_idx + 1:end_idx])
            articles = payload.get("result", {}).get("cmsArticleWebOld", [])

            result = []
            for item in articles:
                title = _clean_html_marks(item.get("title", ""))
                content = _clean_html_marks(item.get("content", ""))
                show_time = (item.get("date", "") or "")[:16]
                article_url = item.get("url") or item.get("artUrl", "")
                if not title and not content:
                    continue
                result.append({
                    "time": show_time or "刚刚",
                    "title": title or "东方财富快讯",
                    "content": content or title,
                    "url": article_url
                })

            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e), "data": []}


@router.get("/news_cls")
async def get_cls_news(keyword: str = Query("A股")):
    """财联社电报真实数据"""
    search_kw = keyword or "A股"
    url = "https://www.cls.cn/nodeapi/telegraphList"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.cls.cn",
        "Referer": "https://www.cls.cn/telegraph"
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            all_articles = []
            for page in range(1, 3):
                params = {
                    "app": "CailianpressWeb",
                    "category": "",
                    "page": page,
                    "rn": 50
                }
                res = await client.get(url, params=params, headers=headers)
                res.raise_for_status()
                data = res.json()
                items = data.get("data", {}).get("roll_data", [])
                if not items:
                    break
                all_articles.extend(items)

            result = []
            for item in all_articles:
                title = _clean_html_marks(item.get("title", ""))
                content = _clean_html_marks(item.get("content", ""))
                haystack = f"{title}\n{content}"
                if search_kw != "A股" and search_kw not in haystack:
                    continue

                result.append({
                    "time": _format_ts(item.get("ctime")),
                    "title": title or "财联社电报",
                    "content": content or title,
                    "url": item.get("shareurl", "")
                })

            return {"success": True, "data": result[:30]}
        except Exception as e:
            return {"success": False, "error": str(e), "data": []}
