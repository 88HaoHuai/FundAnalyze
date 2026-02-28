from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import requests
import os

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "Qwen/Qwen2.5-72B-Instruct"

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
强制要求：严格只返回合法合规的 JSON 格式（绝对不要包含 ```json 这样的 markdown 标记，也绝对不要包含任何 // 注释），结构严格如下：
{{
    "sentiment": "利好",
    "score": 85,
    "summary": "一句话摘要",
    "impact": ["版块名1", "版块名2"]
}}
注意：
1. sentiment 只能是 "利好", "利空", "中性" 之一。
2. score 是 0-100 的整数，表示情绪烈度。
3. 必须确保 "impact" 数组内的元素全部来自于[现有监控版块/基金池]，不能编造，若无影响返回 []。

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
            res = requests.post(url, json=payload, headers=headers, timeout=60)
            res.raise_for_status()
            ai_resp_json = res.json()
            
            ai_msg = ai_resp_json['choices'][0]['message']['content']
            if ai_msg.startswith("```"):
                ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
                
            final_data = json.loads(ai_msg)
            
            # 手动对不规矩的大模型返回结果进行容错（尤其是中文标点）
            valid_sentiments = ["利好", "利空", "中性"]
            if final_data.get("sentiment") not in valid_sentiments:
                if "利好" in ai_msg:
                    final_data["sentiment"] = "利好"
                elif "利空" in ai_msg:
                    final_data["sentiment"] = "利空"
                else:
                    final_data["sentiment"] = "中性"

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
