import sys
import json
import requests
import os

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "Pro/moonshotai/Kimi-k2.5"

def get_fund_names_str():
    # 尝试读取本地的 funds.json 获取版块列表提供给大模型
    try:
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'funds.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            market_funds = [x for x in data if x.get("name") == "市场风向标"]
            if market_funds and "shortNames" in market_funds[0]:
                return ", ".join(market_funds[0]["shortNames"].values())
    except:
        pass
    # 跌落保底短名
    return "沪深300, 恒生指数, 中概互联, 半导体, 电子, 消费电子, 通信设备, 人工智能, 游戏, 传媒, 计算机, 软件服务, 创新药, 医疗医药, 新能源汽车, 光伏产业, 白酒板块"

def analyze_news(title, content):
    try:
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

        user_content = f"快讯标题：{title}\n\n详细内容：{content}"

        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.2, # 低温确保 json 返回的严谨度
            "response_format": {"type": "json_object"}
        }

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=payload, headers=headers, timeout=15)
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
    # 传参逻辑：python fetch_ai.py "title" "content"
    t = sys.argv[1] if len(sys.argv) > 1 else ""
    c = sys.argv[2] if len(sys.argv) > 2 else ""
    analyze_news(t, c)
