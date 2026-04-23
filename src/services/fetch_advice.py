import sys
import json
import requests
import os

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "Pro/Qwen/Qwen2.5-7B-Instruct"

def generate_advice(fund_name, amount, est_change, drawdown, rsi, is_auto_invest):
    try:
        url = "https://api.siliconflow.cn/v1/chat/completions"
        
        system_prompt = f"""你是一位专业的公募基金量化分析师和理财顾问。
请根据用户提供的基金数据（包含名称、持仓金额、当日估算涨跌幅、最大回撤距高点、RSI指标以及是否定投），给出操作建议和信心指数。
要求：
1. 必须返回合法的 JSON 格式数据。不要包含任何 markdown 标记。
2. JSON 结构必须严格如下：
{{
    "action": "操作动作", 
    "confidence": 85,
    "reasoning": "由于 RSI 指标低于 30，且该基金属于您的定投计划，在经历了较大回撤后，建议继续逢低定投以摊平核心成本..."
}}
3. action 请在 ["持仓待涨", "逢低补仓", "止盈止损", "暂停定投", "分批建仓", "保持定投"] 中选择。
4. 结合 `is_auto_invest` 状态给出合理建议。如果是定投，下跌多为机会；如果是单笔重仓（amount 较高且不是定投），请注意控制回撤风险。
"""

        user_content = (
            f"基金名称：{fund_name}\n"
            f"持有金额：{amount} 元\n"
            f"当日估算涨跌：{est_change}%\n"
            f"距高点回撤：{drawdown}%\n"
            f"RSI指标(14)：{rsi}\n"
            f"是否定投计划中：{'是' if is_auto_invest else '否'}\n"
        )

        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"}
        }

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        
        result_json = response.json()
        ai_msg = result_json['choices'][0]['message']['content']
        
        # 尝试清理可能存在的 json markdown 包裹
        if ai_msg.startswith("```"):
            ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
            
        final_dict = json.loads(ai_msg)
        print(json.dumps({'success': True, 'data': final_dict}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    # args: fund_name amount est_change drawdown rsi is_auto_invest
    fund_name = sys.argv[1] if len(sys.argv) > 1 else ""
    amount = sys.argv[2] if len(sys.argv) > 2 else "0"
    est_change = sys.argv[3] if len(sys.argv) > 3 else "0"
    drawdown = sys.argv[4] if len(sys.argv) > 4 else "0"
    rsi = sys.argv[5] if len(sys.argv) > 5 else "50"
    is_auto_invest = (sys.argv[6].lower() == 'true') if len(sys.argv) > 6 else False
    
    generate_advice(fund_name, amount, est_change, drawdown, rsi, is_auto_invest)
