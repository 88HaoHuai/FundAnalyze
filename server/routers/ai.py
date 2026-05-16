"""
routers/ai.py — 硅基流动 AI 诊断和建议接口
"""
from fastapi import APIRouter
from pydantic import BaseModel
import httpx
import config

router = APIRouter(prefix="/api", tags=["ai"])

class AIAdviceRequest(BaseModel):
    fund_name: str
    amount: float = 0
    est_change: float = 0
    drawdown: float = 0
    rsi: float = 50
    is_auto_invest: bool = False

@router.post("/ai_advice")
async def get_ai_advice(req: AIAdviceRequest):
    """请求 AI 给基金做出诊断建议"""
    url = "https://api.siliconflow.cn/v1/chat/completions"
    system_prompt = f"""你是一位经验丰富的公募基金量化分析师与实战派理财顾问。
请根据以下基金运行数据，输出极具实操性的操作建议和信心指数。

### 核心决策逻辑树：
1. 【量化信号交叉】
   - 超卖信号：RSI < 30。若同时伴随“最大回撤”处于历史高位区间，为极佳的左侧筹码收集期。
   - 超买信号：RSI > 70。短期存在回调压力；RSI > 80为极度超买。
   - 钝化防范：下跌趋势中RSI可能持续钝化（低位徘徊），此时决策权重应向“定投属性”倾斜，而非单笔抄底。

2. 【持仓属性约束 (is_auto_invest)】
   - 定投模式 (True)：核心是“积攒份额”和“钝化成本”。面对深度回撤和低RSI，禁止建议“止盈止损”，必须强化【逢低补仓】或【保持定投】。仅在 RSI>75 时考虑【暂停定投】或【止盈止损】。
   - 单笔重仓 (False)：核心是“绝对收益”与“回撤控制”。若回撤持续扩大且无止跌迹象（如 RSI 处于中低位但未极度超卖），必须果断建议【止盈止损】；若处于右侧初期，建议【持仓待涨】。

3. 【动作词库映射标准】
   - "逢低补仓"：专用于定投计划中，RSI<35且处于较大回撤期，用于摊薄核心成本。
   - "分批建仓"：针对非定投的新目标，处于低估值或超卖区，试探性买入。
   - "保持定投"：RSI处于 40-65 的常规震荡市，无极端信号。
   - "持仓待涨"：RSI 50-70 的多头趋势，享受浮盈。
   - "止盈止损"：单笔买入触及回撤底线，或 RSI>80 的情绪过热期。
   - "暂停定投"：仅用于定投计划中，基金处于极度高估或 RSI 长期>75 的阶段顶。

### 输出约束（极度重要）：
1. 必须返回合法的 JSON 格式数据，严禁包含任何 markdown 标记（如 ```json）。
2. JSON 结构：{{"action": "动作", "confidence": 85, "reasoning": "简短理由"}}
3. reasoning 字段必须是一语中的的“投研短评”，直接指出触发操作的【数据条件+核心逻辑】，绝对不能超过40个字。
"""
    user_content = (
        f"基金名称：{req.fund_name}\n"
        f"持有金额：{req.amount} 元\n"
        f"当日估算涨跌：{req.est_change}%\n"
        f"距高点回撤：{req.drawdown}%\n"
        f"RSI指标(14)：{req.rsi}\n"
        f"是否定投计划中：{'是' if req.is_auto_invest else '否'}\n"
    )
    
    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"}
    }
    headers = {
        "Authorization": f"Bearer {config.AI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            res = await client.post(url, json=payload, headers=headers)
            res.raise_for_status()
            result_json = res.json()
            ai_msg = result_json['choices'][0]['message']['content']
            
            import json
            if ai_msg.startswith("```"):
                ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
                
            final_dict = json.loads(ai_msg)
            return {'success': True, 'data': final_dict}
        except Exception as e:
            return {'success': False, 'error': str(e)}
