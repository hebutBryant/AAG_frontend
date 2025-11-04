// 等待DOM加载完成
document.addEventListener("DOMContentLoaded", () => {
    // 1. 获取DOM元素
    const chatContainer = document.getElementById("chat-container");  // 聊天记录容器
    const chatInput = document.getElementById("chat-input");          // 输入框
    const sendBtn = document.getElementById("send-btn");              // 发送按钮
    const modelRadios = document.querySelectorAll('input[name="language-model"]');  // 模型选择按钮

    // 2. 工具函数：创建用户/机器人消息DOM
    /**
     * 创建消息元素
     * @param {string} role - 角色：user/bot
     * @param {string} content - 消息内容
     * @returns {HTMLElement} 消息DOM元素
     */
    function createMessageElement(role, content) {
        const messageDiv = document.createElement("div");
        messageDiv.className = "flex flex-col py-2.5";  // 复用原样式

        // 头像+角色名
        const headerDiv = document.createElement("div");
        headerDiv.className = "flex items-center gap-x-2";
        
        const avatarDiv = document.createElement("div");
        avatarDiv.className = "inline-flex flex-shrink-0 h-8 w-8 rounded-full overflow-hidden border-2 border-white dark:border-slate-700";
        
        const avatarImg = document.createElement("img");
        avatarImg.src = role === "user" 
            ? "/static/images/avatar/a.jpg"  // 用户头像路径
            : "/static/images/avatar/bots/1.jpg";  // 机器人头像路径
        avatarImg.alt = role === "user" ? "You" : "Scribbler.Ai";
        
        const roleName = document.createElement("h6");
        roleName.className = "font-bold text-sm capitalize text-slate-600 dark:text-slate-100";
        roleName.textContent = role === "user" ? "you" : "Scribbler.Ai";

        // 消息内容
        const contentDiv = document.createElement("div");
        contentDiv.className = "ps-10 w-full";
        
        const contentInner = document.createElement("div");
        contentInner.className = "max-w-full text-slate-500 dark:text-slate-300 prose-strong:dark:text-white text-sm prose prose-code:![text-shadow:none] *:max-w-xl prose-pre:!max-w-full prose-pre:!w-full prose-pre:p-0";
        
        const contentPara = document.createElement("p");
        contentPara.textContent = content;  // 若需支持Markdown，可替换为DOMPurify.sanitize(marked.parse(content))

        // 组装DOM
        avatarDiv.appendChild(avatarImg);
        headerDiv.appendChild(avatarDiv);
        headerDiv.appendChild(roleName);
        
        contentInner.appendChild(contentPara);
        contentDiv.appendChild(contentInner);
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);

        return messageDiv;
    }

    // 3. 工具函数：获取选中的模型
    function getSelectedModel() {
        const checkedRadio = document.querySelector('input[name="language-model"]:checked');
        return checkedRadio ? checkedRadio.value : "GPT 4";  // 默认模型
    }

    // 4. 核心函数：发送消息并处理流式响应
    async function sendMessage() {
        // 获取输入内容（去除前后空格）
        const userInput = chatInput.textContent.trim();
        if (!userInput) return;  // 空消息不发送

        // 清空输入框
        chatInput.textContent = "";

        // 1. 先添加用户消息到聊天记录
        const userMessage = createMessageElement("user", userInput);
        chatContainer.appendChild(userMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;  // 滚动到底部

        // 2. 添加机器人消息容器（初始为空，后续流式填充）
        const botMessage = createMessageElement("bot", "");
        chatContainer.appendChild(botMessage);
        const botContentPara = botMessage.querySelector("p");  // 机器人消息内容的p标签
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // 3. 获取选中的模型
        const selectedModel = getSelectedModel();

        try {
            // 4. 发送POST请求到后端（流式接收）
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userInput,
                    model: selectedModel
                })
            });

            // 校验后端响应
            if (!response.ok) {
                throw new Error(`后端请求失败：${response.status}`);
            }

            // 5. 处理流式响应（SSE格式）
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let botResponse = "";  // 累计机器人响应内容

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;  // 流结束

                // 解析每块数据（SSE格式：data: {...}\n\n）
                const chunk = decoder.decode(value);
                const lines = chunk.split("\n\n").filter(line => line.startsWith("data: "));

                for (const line of lines) {
                    const dataStr = line.slice("data: ".length);  // 提取JSON字符串
                    const data = JSON.parse(dataStr);
                    
                    if (data.text) {
                        botResponse += data.text;  // 累计内容
                        botContentPara.textContent = botResponse;  // 实时更新DOM
                        chatContainer.scrollTop = chatContainer.scrollHeight;  // 滚动到底部
                    }
                }
            }

        } catch (error) {
            // 错误处理：更新机器人消息为错误提示
            botContentPara.textContent = `抱歉，请求失败：${error.message}`;
            botContentPara.style.color = "#ef4444";  // 红色错误提示
        }
    }

    // 5. 绑定事件：发送按钮点击
    sendBtn.addEventListener("click", sendMessage);

    // 6. 绑定事件：输入框按Enter发送（Shift+Enter换行）
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();  // 阻止默认换行
            sendMessage();
        }
    });
});