from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests
import os

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "Pro/moonshotai/Kimi-k2.5"

def get_fund_names_str():
    try:
        config_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'config', 'funds.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            market_funds = [x for x in data if x.get("name") == "市场风向标"]
            if market_funds and "shortNames" in market_funds[0]:
                return ", ".join(market_funds[0]["shortNames"].values())
    except:
        pass
    return "沪深300, 恒生指数, 中概互联, 半导体, 电子, 消费电子, 通信设备, 人工智能, 游戏, 传媒, 计算机, 软件服务, 创新药, 医疗医药, 新能源汽车, 光伏产业, 白酒板块"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            req_body = json.loads(post_data)
            title = req_body.get('title', '')
            content = req_body.get('content', '')

            url = "https://api.siliconflow.cn/v1/chat/completions"
            fund_sectors = get_fund_names_str()
            
            system_prompt = f"""你是一个顶级的金融量化分析师。请分析用户发给你的财经快讯，并提供以下四个维度的结构化提取。
强制要求：严格只返回合法合规的 JSON 格式（不要包括 markdown 代码块如 ````json``），JSON 字段必须包含且仅包含如下：
1. "sentiment": 枚举值（"利好", "利空", "中性"），只能选其一。
2. "score": 整型数字 0 到 100（代表该情绪绝对热度/强度，0最弱，100最强。比如极大暴雷利空可给90，平淡中性可给10）。
3. "summary": 字符串，将繁杂信息极简浓缩成一句话重点的核心摘要。
4. "impact": 数组。必须从给定的[现有监控版块/基金池]里，挑出1-3个受此消息最直接影响的版块名称（如果没有相关度极高的，就返回空数组 `[]`）。不能胡编乱造版块名。

现有监控版块/基金池包括：[{fund_sectors}]
"""
            user_msg = f"快讯标题：{title}\n\n详细内容：{content}"

            payload = {
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg}
                ],
                "temperature": 0.2, 
                "response_format": {"type": "json_object"}
            }

            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            }

            # fetch upstream
            res = requests.post(url, json=payload, headers=headers, timeout=20)
            res.raise_for_status()
            ai_resp_json = res.json()
            
            ai_msg = ai_resp_json['choices'][0]['message']['content']
            if ai_msg.startswith("```"):
                ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
                
            final_data = json.loads(ai_msg)

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': True, 'data': final_data}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
