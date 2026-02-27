import sys
import json
import requests
import os

API_KEY = "sk-deoeqqlzkxpwclsbcibwgaljzmfxhhsncaebnswqyytzbghj"
MODEL = "Pro/moonshotai/moonshot-v1-8k" # just in case Kimi-k2.5 is not the exact tag name, but user asked for "Pro/moonshotai/Kimi-K2.5" ... wait, let's keep it as user requested but with correct capitalization
MODEL = "Pro/moonshotai/Kimi-K2.5"

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

        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        
        result_json = response.json()
        ai_msg = result_json['choices'][0]['message']['content']
        
        # 尝试清理可能存在的 json markdown 包裹
        if ai_msg.startswith("```"):
            ai_msg = ai_msg.strip("`").replace("json\n", "", 1)
            
        final_dict = json.loads(ai_msg)
        
        # 确保 sentiment 是三个枚举值之一，否则走兜底
        valid_sentiments = ["利好", "利空", "中性"]
        if final_dict.get("sentiment") not in valid_sentiments:
            # 尝试在文本中直接搜索
            if "利好" in ai_msg:
                final_dict["sentiment"] = "利好"
            elif "利空" in ai_msg:
                final_dict["sentiment"] = "利空"
            else:
                final_dict["sentiment"] = "中性"
                
        print(json.dumps({'success': True, 'data': final_dict}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))

if __name__ == '__main__':
    # 传参逻辑：python fetch_ai.py "title" "content"
    t = sys.argv[1] if len(sys.argv) > 1 else ""
    c = sys.argv[2] if len(sys.argv) > 2 else ""
    analyze_news(t, c)
