from typing import Any

import httpx

SEARCH_URL = "http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx"
TIMEOUT = httpx.Timeout(10.0)

MANAGER_PREFIXES = [
    "易方达", "华夏", "广发", "富国", "招商", "天弘", "南方", "嘉实", "汇添富", "景顺长城",
    "工银瑞信", "中欧", "华安", "银华", "鹏华", "兴证全球", "兴全", "交银施罗德", "博时", "万家",
    "国泰", "平安", "建信", "永赢", "华泰柏瑞", "鹏扬", "信澳", "摩根", "诺安", "创金合信",
    "大成", "农银汇理", "国联安", "中庚", "前海开源", "东方红", "华宝", "长城", "中邮", "国投瑞银",
    "长盛", "长信", "中银", "华富", "国寿安保", "银河", "国联", "财通", "东财", "财通资管"
]

GENERIC_TOKENS = [
    "证券投资基金", "发起式", "发起", "联接基金", "联接", "基金", "指数型", "指数",
    "主题型", "主题", "增强", "分级", "混合型", "混合", "股票型", "股票", "债券型", "债券",
    "灵活配置", "配置", "精选", "优选", "A", "C", "E", "I", "Y", "LOF", "ETF", "FOF", "QDII", "人民币"
]


def _only_chinese(text: str) -> str:
    return "".join(ch for ch in text if "\u4e00" <= ch <= "\u9fff")


def _clean_phrase(text: str) -> str:
    cleaned = text.strip()
    for prefix in MANAGER_PREFIXES:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break
    cleaned = _only_chinese(cleaned)
    for token in GENERIC_TOKENS:
        cleaned = cleaned.replace(token, "")
    return cleaned.strip()


def _expand_keywords(base: str) -> list[str]:
    if not base:
        return []

    keywords = [base]
    if "养老" in base and "养老" not in keywords:
        keywords.append("养老")
    if "健康" in base and "健康" not in keywords:
        keywords.append("健康")
    if "煤炭" in base and "煤炭" not in keywords:
        keywords.append("煤炭")
    if "传媒" in base and "传媒" not in keywords:
        keywords.append("传媒")
    if "影视" in base and "影视" not in keywords:
        keywords.append("影视")
    if "医药" in base and "医药" not in keywords:
        keywords.append("医药")
    if "医疗" in base and "医疗" not in keywords:
        keywords.append("医疗")

    deduped: list[str] = []
    for keyword in keywords:
        normalized = keyword.strip()
        if len(normalized) < 2:
            continue
        if normalized not in deduped:
            deduped.append(normalized)
    return deduped


def _extract_keywords(name: str, other_name: str, themed_info: list[dict[str, Any]] | None) -> list[str]:
    collected: list[str] = []

    base_name = _clean_phrase(name)
    collected.extend(_expand_keywords(base_name))

    for alias in (other_name or "").split(","):
        cleaned_alias = _clean_phrase(alias)
        collected.extend(_expand_keywords(cleaned_alias))

    for info in themed_info or []:
        themed_name = _clean_phrase(str(info.get("TTYPENAME") or ""))
        if themed_name:
            collected.append(themed_name)

    deduped: list[str] = []
    for keyword in collected:
        if keyword and keyword not in deduped:
            deduped.append(keyword)
    return deduped


async def fetch_fund_metadata(code_or_keyword: str) -> dict[str, Any] | None:
    params = {"m": 1, "key": code_or_keyword}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.get(SEARCH_URL, params=params)
        res.raise_for_status()
        payload = res.json()

    items = payload.get("Datas") or []
    if not items:
        return None

    preferred = None
    for item in items:
        if str(item.get("CODE") or "") == code_or_keyword:
            preferred = item
            break
    item = preferred or items[0]

    base_info = item.get("FundBaseInfo") or {}
    fund_name = item.get("NAME") or base_info.get("SHORTNAME") or code_or_keyword
    fund_type = base_info.get("FTYPE") or base_info.get("FUNDTYPE") or ""
    keywords = _extract_keywords(fund_name, base_info.get("OTHERNAME") or "", item.get("ZTJJInfo"))

    return {
        "fund_code": item.get("CODE") or code_or_keyword,
        "fund_name": fund_name,
        "fund_type": fund_type,
        "keywords": keywords
    }
