import sys
import json
import requests
import os
from http.server import BaseHTTPRequestHandler

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "deepseek-ai/DeepSeek-V3"

def generate_advice(fund_name, amount, est_change, drawdown, rsi, is_auto_invest):
    try:
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
3. reasoning 字段必须是一语中的的“投研短评”，直接指出触发操作的【数据条件+核心逻辑】，绝对不能超过40个字。示例：“RSI跌破30且属定投，左侧极寒期正是攒份额良机，建议加码补仓。”

### 输入数据：
- 基金名称：{fund_name}
- 持仓金额：{amount}
- 当日估算涨跌幅：{daily_change}
- 最大回撤距高点：{max_drawdown}
- RSI指标：{rsi}
- 是否定投：{is_auto_invest}
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
        
        if ai_msg.startswith("```"):
            ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
            
        final_dict = json.loads(ai_msg)
        return {'success': True, 'data': final_dict}

    except Exception as e:
        return {'success': False, 'error': str(e)}

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            payload = json.loads(post_data.decode('utf-8'))
            fund_name = payload.get('fund_name', '')
            amount = payload.get('amount', 0)
            est_change = payload.get('est_change', 0)
            drawdown = payload.get('drawdown', 0)
            rsi = payload.get('rsi', 50)
            is_auto_invest = payload.get('is_auto_invest', False)
            
            result = generate_advice(fund_name, amount, est_change, drawdown, rsi, is_auto_invest)
            self._send(200, result)
        except Exception as e:
            self._send(500, {'success': False, 'error': str(e)})

    def do_GET(self):
        self._send(200, {'message': 'Ready'})
        
    def _send(self, status, body):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    fund_name = sys.argv[1] if len(sys.argv) > 1 else ""
    amount = sys.argv[2] if len(sys.argv) > 2 else "0"
    est_change = sys.argv[3] if len(sys.argv) > 3 else "0"
    drawdown = sys.argv[4] if len(sys.argv) > 4 else "0"
    rsi = sys.argv[5] if len(sys.argv) > 5 else "50"
    is_auto_invest = (sys.argv[6].lower() == 'true') if len(sys.argv) > 6 else False
    
    result = generate_advice(fund_name, amount, est_change, drawdown, rsi, is_auto_invest)
    print(json.dumps(result, ensure_ascii=False))
