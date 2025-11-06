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
// 在 chat.js 文件末尾添加以下代码

// 选项卡切换功能
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有active类
            tabButtons.forEach(btn => {
                btn.classList.remove('active', 'border-b-2', 'border-blue-600');
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
            });
            
            // 添加active类到当前选项卡
            this.classList.add('active', 'border-b-2', 'border-blue-600');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.remove('hidden');
        });
    });

    // 文件上传功能
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileList = document.getElementById('file-list');
    
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', function() {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function(e) {
            const files = e.target.files;
            handleFileSelection(files);
        });
        
        // 拖拽上传功能
        uploadBtn.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('border-blue-400', 'bg-blue-50');
            this.classList.add('dark:border-blue-500', 'dark:bg-blue-900/20');
        });
        
        uploadBtn.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('border-blue-400', 'bg-blue-50');
            this.classList.remove('dark:border-blue-500', 'dark:bg-blue-900/20');
        });
        
        uploadBtn.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('border-blue-400', 'bg-blue-50');
            this.classList.remove('dark:border-blue-500', 'dark:bg-blue-900/20');
            
            const files = e.dataTransfer.files;
            handleFileSelection(files);
        });
    }
    
    function handleFileSelection(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            addFileToList(file);
        }
    }
    
    function addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';
        
        fileItem.innerHTML = `
            <div class="flex items-center space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">${file.name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button class="text-slate-400 hover:text-red-500 transition-colors remove-file">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;
        
        fileList.appendChild(fileItem);
        
        // 添加删除文件事件
        fileItem.querySelector('.remove-file').addEventListener('click', function() {
            fileItem.remove();
        });
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});