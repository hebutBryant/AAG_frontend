import os
import json
import logging
from flask import Flask, render_template, request, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 初始化Flask应用
app = Flask(
    __name__,
    template_folder="app",  
    static_folder="static",
)
CORS(app)  # 解决跨域问题

# 初始化OpenAI客户端
client = OpenAI(
    api_key="DASHSCOPE_API_KEY",  
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"  
)

MODEL_MAPPING = {
    "GPT 4": "qwen3-max",    
    "Qwen 14B": "qwen3-max",  
    "Qwen Plus": "qwen3-max"          
}

########################这一部分集中渲染页面#################################
@app.route("/")
def index():
    """根路由：返回聊天页面"""
    return render_template("template-chatbot-s2-convo.html")  

@app.route('/overview')
def overview():
    return render_template('overview.html')

@app.route('/documents')
def documents():
    return render_template('documents.html')

@app.route('/manage_dataset')
def manage_dataset():
    return render_template('manage_dataset.html')


############################################################################

@app.route("/api/chat", methods=["POST"])
def chat():
    """聊天接口：接收用户消息，调用Qwen模型，流式返回结果"""
    # 1. 获取前端传递的参数
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()  
        selected_model = data.get("model", "")           
    except Exception as e:
        logger.error(f"解析请求参数失败：{str(e)}")
        return Response(
            json.dumps({"error": "请求格式错误，请检查参数"}),
            mimetype="application/json",
            status=400
        )

    # 2. 验证参数合法性
    if not user_message:
        return Response(
            json.dumps({"error": "消息内容不能为空"}),
            mimetype="application/json",
            status=400
        )
    if selected_model not in MODEL_MAPPING:
        return Response(
            json.dumps({"error": "所选模型不支持，请重新选择"}),
            mimetype="application/json",
            status=400
        )

    # 3. 映射到Qwen实际模型ID
    qwen_model = MODEL_MAPPING[selected_model]
    logger.info(f"开始处理请求：模型={qwen_model}，消息={user_message[:20]}...") 

    # 4. 定义流式响应生成函数
    @stream_with_context
    def generate_stream():
        try:
            completion = client.chat.completions.create(
                model=qwen_model,
                messages=[
                    {"role": "system", "content": "你是一个乐于助人的智能助手，用简洁明了的语言回答用户问题。"},
                    {"role": "user", "content": user_message}
                ],
                stream=True,  
                temperature=0.7  
            )

            # 迭代处理流式返回的每一块内容
            for chunk in completion:
                # 提取增量文本
                if chunk.choices and chunk.choices[0].delta.content:
                    bot_text = chunk.choices[0].delta.content  
                    # 以SSE（Server-Sent Events）格式返回给前端
                    yield f"data: {json.dumps({'text': bot_text})}\n\n"
                    logger.debug(f"返回流式数据：{bot_text}")  # 调试日志

            logger.info("流式响应完成")

        except Exception as e:
            # 捕获所有异常并返回给前端
            error_msg = f"模型调用失败：{str(e)}"
            logger.error(error_msg)
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    # 5. 返回流式响应（指定SSE格式）
    return Response(generate_stream(), mimetype="text/event-stream")

def test_qwen_api():
    try:
        completion = client.chat.completions.create(
            model="qwen3-max",  
            messages=[{"role": "user", "content": "你好"}],
            stream=False  
        )
        print("模型响应：", completion.choices[0].message.content)
    except Exception as e:
        print("测试失败：", str(e))


if __name__ == "__main__":
    test_qwen_api()
    app.run(
        debug=False,
        host="0.0.0.0", 
        port=5000        
    )