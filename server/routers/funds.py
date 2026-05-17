"""
routers/funds.py — 基金与股票行情代理接口 (替代原有的 Vercel Serverless proxy)
"""
from fastapi import APIRouter, Response, Query, HTTPException
import httpx
import schemas
from services.fund_metadata_service import fetch_fund_metadata

router = APIRouter(prefix="/api", tags=["funds_proxy"])

# HTTP 客户端配置
timeout = httpx.Timeout(10.0)

@router.get("/fund/meta/{code}", response_model=schemas.FundMetadataResponse)
async def get_fund_meta(code: str):
    """返回基金名称、类型与主题关键词"""
    try:
        metadata = await fetch_fund_metadata(code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"获取基金元数据失败: {str(e)}")

    if not metadata:
        raise HTTPException(status_code=404, detail="未找到该基金元数据")
    return metadata

@router.get("/fund/{code}.js")
async def get_fund_gz(code: str, rt: str = Query(None)):
    """东方财富实时估值代理 (对应原 fundgz.1234567.com.cn)"""
    url = f"http://fundgz.1234567.com.cn/js/{code}.js"
    params = {"rt": rt} if rt else {}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "http://fund.eastmoney.com/"
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, params=params, headers=headers)
            return Response(content=res.content, media_type="application/javascript")
        except Exception as e:
            return Response(content=f"jsonpgz(); // {str(e)}", media_type="application/javascript")

@router.get("/pingzhong/{code}.js")
async def get_pingzhong(code: str, rt: str = Query(None)):
    """东方财富净值走势代理 (对应原 pingzhongdata)"""
    url = f"https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList"
    # 原版 pingzhong 代理获取方式有点不同，原代码是去 fetch pingzhongdata.eastmoney.com/fund/{code}.js
    # 我们按照原来的 proxy 逻辑走：
    original_url = f"http://pingzhongdata.eastmoney.com/fund/{code}.js"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "http://fund.eastmoney.com/"
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(original_url, headers=headers)
            return Response(content=res.content, media_type="application/javascript")
        except Exception as e:
            return Response(content=f"// {str(e)}", media_type="application/javascript", status_code=500)

@router.get("/f10/lsjz")
async def get_f10_lsjz(fundCode: str, pageIndex: int = 1, pageSize: int = 20):
    """历史净值接口代理 (Web版，更新稍慢)"""
    url = "http://api.fund.eastmoney.com/f10/lsjz"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "http://fund.eastmoney.com/"
    }
    params = {"fundCode": fundCode, "pageIndex": pageIndex, "pageSize": pageSize}
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, params=params, headers=headers)
            return Response(content=res.content, media_type="application/json")
        except Exception as e:
            return Response(content=f'{{"error": "{str(e)}"}}', media_type="application/json", status_code=500)

@router.get("/fund/history")
async def get_fund_history_fast(code: str, pageIndex: int = 1, pageSize: int = 10):
    """移动端历史净值代理 (更新非常快，零点左右即可获取前一日净值)"""
    url = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList"
    params = {
        "FCODE": code,
        "PageIndex": pageIndex,
        "PageSize": pageSize,
        "deviceid": "Wap",
        "plat": "Wap",
        "product": "EFund",
        "Version": "2.0.0",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, params=params)
            return Response(content=res.content, media_type="application/json")
        except Exception as e:
            return Response(content=f'{{"error": "{str(e)}"}}', media_type="application/json", status_code=500)

@router.get("/f10/FundArchivesDatas.aspx")
async def get_fund_archives(type: str, code: str, topline: int = 10):
    """基金持仓信息代理"""
    url = "http://fundf10.eastmoney.com/FundArchivesDatas.aspx"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": f"http://fundf10.eastmoney.com/ccmx_{code}.html"
    }
    params = {"type": type, "code": code, "topline": topline}
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, params=params, headers=headers)
            return Response(content=res.content, media_type="text/html")
        except Exception as e:
            return Response(content=str(e), status_code=500)

@router.get("/stock")
async def get_stock_quotes(q: str):
    """腾讯股票行情接口代理"""
    url = f"http://qt.gtimg.cn/q={q}"
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.get(url, headers=headers)
            # 腾讯接口返回的是 GBK 编码文本，这里直接以二进制传回即可让前端自行或原样解析
            # 但更好的方式是我们解析为 UTF8 传回
            content = res.content.decode('gbk', errors='ignore')
            return Response(content=content, media_type="application/javascript")
        except Exception as e:
            return Response(content=f"// {str(e)}", status_code=500)
