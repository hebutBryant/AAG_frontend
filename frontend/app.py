import os
import json
import logging
from flask import Flask, render_template, request, Response, stream_with_context
from flask import jsonify  
from flask_cors import CORS
from datetime import datetime
from typing import List, Dict

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
CORS(app)

# 知识库数据存储
knowledge_bases = [
    {
        "id": 1,
        "名称": "人工智能知识库",
        "文档个数": 128,
        "创建时间": datetime(2024, 9, 12, 10, 30).strftime("%Y-%m-%d %H:%M:%S"),
    },
    {
        "id": 2,
        "名称": "前端开发文档库",
        "文档个数": 86,
        "创建时间": datetime(2023, 6, 5, 14, 15).strftime("%Y-%m-%d %H:%M:%S"),
    },
    {
        "id": 3,
        "名称": "公司政策与规章",
        "文档个数": 54,
        "创建时间": datetime(2022, 11, 20, 9, 0).strftime("%Y-%m-%d %H:%M:%S"),
    },
]

########################页面路由#################################
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

########################API路由#################################
@app.route("/api/knowledge_bases", methods=["GET"])
def get_knowledge_bases():
    """获取知识库列表 - 简化版本"""
    try:
        logger.info("收到知识库查询请求")
        
        # 直接返回数据，不进行任何复杂处理
        return jsonify({
            "success": True,
            "data": knowledge_bases,
            "count": len(knowledge_bases)
        })
        
    except Exception as e:
        logger.error(f"获取知识库列表失败：{str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "获取知识库列表失败",
            "message": str(e)
        }), 500

@app.route("/api/knowledge_bases/<int:kb_id>", methods=["DELETE"])
def delete_knowledge_base(kb_id):
    """删除知识库"""
    try:
        global knowledge_bases
        logger.info(f"收到删除知识库请求，ID: {kb_id}")
        
        # 找到要删除的知识库索引
        original_count = len(knowledge_bases)
        knowledge_bases = [kb for kb in knowledge_bases if kb["id"] != kb_id]
        
        if len(knowledge_bases) < original_count:
            logger.info(f"成功删除知识库 ID: {kb_id}")
            return jsonify({
                "success": True,
                "message": f"成功删除知识库"
            })
        else:
            logger.warning(f"未找到指定的知识库 ID: {kb_id}")
            return jsonify({
                "success": False,
                "error": "未找到指定的知识库"
            }), 404
            
    except Exception as e:
        logger.error(f"删除知识库失败：{str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "删除知识库失败",
            "message": str(e)
        }), 500

@app.route("/api/knowledge_bases", methods=["POST"])
def create_knowledge_base():
    """创建知识库"""
    try:
        data = request.get_json()
        logger.info(f"收到创建知识库请求: {data}")
        
        if not data or not data.get("名称"):
            return jsonify({
                "success": False,
                "error": "知识库名称不能为空"
            }), 400
            
        # 生成新ID
        new_id = max([kb["id"] for kb in knowledge_bases]) + 1 if knowledge_bases else 1
        
        new_kb = {
            "id": new_id,
            "名称": data.get("名称"),
            "文档个数": 0,
            "创建时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        knowledge_bases.append(new_kb)
        
        logger.info(f"成功创建知识库: {new_kb['名称']}")
        return jsonify({
            "success": True,
            "data": new_kb
        })
        
    except Exception as e:
        logger.error(f"创建知识库失败：{str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "创建知识库失败",
            "message": str(e)
        }), 500

@app.route("/api/health", methods=["GET"])
def health_check():
    """健康检查接口"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0", 
        port=5000        
    )