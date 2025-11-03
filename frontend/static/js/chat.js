const chatSections = {
    today: document.getElementById('todaySection'),
    yesterday: document.getElementById('yesterdaySection'),
    pastWeek: document.getElementById('pastWeekSection'),
    pastMonth: document.getElementById('pastMonthSection'),
    pastYear: document.getElementById('pastYearSection'),
};

// 模拟数据存储，存储所有对话内容
const chats = {};

const profile = document.querySelector('.profile');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutBtn = document.getElementById('logoutBtn');

// 标记是否是第一次发送消息
let isFirstMessage = true;

// 禁用发送按钮
const sendButton = document.querySelector('button[onclick="sendMessage()"]');
const chatTypeSelect = document.getElementById('chatType');

// 监听选择器的变化
chatTypeSelect.addEventListener('change', () => {
    if (chatTypeSelect.value) {
        sendButton.disabled = false; // 启用发送按钮
    } else {
        sendButton.disabled = true; // 禁用发送按钮
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/api/logout', { method: 'POST' })
        .then(response => {
            if (response.ok) {
                alert('已注销');
                // localStorage.removeItem('username'); // 清除本地存储（如果有）
                displayLoginButton(); // 恢复登录按钮
            } else {
                alert('注销失败');
            }
        })
        .catch(error => console.error('注销失败:', error));
});

// 页面初始化时显示初始消息，不创建任何对话
document.addEventListener('DOMContentLoaded', async () => {
    initializeChat();
    const username = await getUsername(); // 从后端获取用户名
    if (username) {
        displayUser(username); // 如果用户已登录，显示用户名
    } else {
        displayLoginButton(); // 如果未登录，显示登录按钮
    }
});

function initializeChat() {
    const chatArea = document.getElementById('chatArea');
    const initialMessage = document.createElement('div');
    initialMessage.className = 'message-output';
    initialMessage.innerHTML = `
        <div class="avatar"></div>
        <div class="text">我今天能帮你做什么？</div>
    `;
    chatArea.appendChild(initialMessage);

    document.getElementById('mainContent').classList.add('centered');
    document.getElementById('chatBox').classList.add('centered');
}

// 排序对话列表
function sortChats() {
    const chatList = document.querySelectorAll('.new-chat');
    const chatArray = Array.from(chatList);

    chatArray.sort((a, b) => {
        const chatIdA = a.getAttribute('data-chat-id');
        const chatIdB = b.getAttribute('data-chat-id');
        const lastMessageTimeA = chats[chatIdA]?.slice(-1)?.[0]?.timestamp || 0;
        const lastMessageTimeB = chats[chatIdB]?.slice(-1)?.[0]?.timestamp || 0;
        return lastMessageTimeB - lastMessageTimeA; // 时间从新到旧排序
    });

    const parentElement = document.getElementById('todaySection');
    chatArray.forEach(chat => parentElement.appendChild(chat));
}

// 创建新对话并分配到相应的时间分组
function createNewChat(timestamp) {
    const newChat = document.createElement('li');
    newChat.className = 'new-chat';
    newChat.textContent = "新对话";

    document.querySelectorAll('.new-chat').forEach(chat => chat.classList.remove('active'));
    newChat.classList.add('active');

    const chatId = `chat${Object.keys(chats).length + 1}`;
    newChat.setAttribute('data-chat-id', chatId);

    // 初始化对话存储但不显示
    chats[chatId] = [];
    
    // 绑定切换对话功能
    newChat.onclick = () => switchToChat(newChat);

    // 激活但暂不插入到左边栏
    switchToChat(newChat);

    // 延迟插入逻辑：只有在实际发送消息后才显示
    return { chatId, chatElement: newChat };
}


// 切换到指定对话，并设置初始布局
function switchToChat(chatElement) {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = '';

    document.querySelectorAll('.new-chat').forEach(chat => chat.classList.remove('active'));
    chatElement.classList.add('active');

    const chatId = chatElement.getAttribute('data-chat-id');
    const messages = chats[chatId];

    const mainContent = document.getElementById('mainContent');
    const chatBox = document.getElementById('chatBox');
    
    if (messages && messages.length > 0) {
        mainContent.classList.remove('centered');
        chatBox.classList.remove('centered');
        mainContent.classList.add('expanded');
        chatBox.classList.add('expanded');
    } else {
        mainContent.classList.add('centered');
        chatBox.classList.add('centered');
        mainContent.classList.remove('expanded');
        chatBox.classList.remove('expanded');

        const initialMessage = document.createElement('div');
        initialMessage.className = 'message-output';
        initialMessage.innerHTML = `
            <div class="avatar"></div>
            <div class="text">我今天能帮你做什么？</div>
        `;
        chatArea.appendChild(initialMessage);
    }

    if (messages) {
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = message.isAI ? 'message-output' : 'message-input';
            messageElement.textContent = message.text;
            chatArea.appendChild(messageElement);
        });
    }

    chatArea.scrollTop = chatArea.scrollHeight;

    isFirstMessage = messages && messages.length === 0;
}

// 根据时间戳返回对应的时间分组
function getTimeSection(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);

    const diffTime = now - date;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 1 && now.getDate() === date.getDate()) {
        return 'today';
    } else if (diffDays < 2) {
        return 'yesterday';
    } else if (diffDays <= 7) {
        return 'pastWeek';
    } else if (diffDays <= 30) {
        return 'pastMonth';
    } else {
        return 'pastYear';
    }
}

function sendMessage() {
    // 判断用户是否选择了对话类型
    const chatTypeSelect = document.getElementById('chatType');
    if (!chatTypeSelect.value) {
        alert('请先选择对话类型！');
        return;
    }

    // 获取聊天相关的 DOM 元素
    const chatBox = document.getElementById('chatBox');
    const mainContent = document.getElementById('mainContent');
    const chatArea = document.getElementById('chatArea');
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value;
    const modelSelector = document.getElementById('modelSelector');
    const selectedModel = modelSelector.value; // 获取用户选择的模型

    // 如果输入框不为空
    if (messageText.trim() !== '') {
        let activeChatElement = document.querySelector('.new-chat.active');
        let chatId;

        // 如果没有活跃对话，创建新对话
        if (!activeChatElement) {
            const newChat = createNewChat(new Date().getTime());
            activeChatElement = newChat.chatElement;
            chatId = newChat.chatId;
        } else {
            chatId = activeChatElement.getAttribute('data-chat-id');
        }

        // 设置新对话标题为用户的第一条消息
        if (isFirstMessage && activeChatElement) {
            activeChatElement.textContent = messageText;

            // 插入到左边栏对应分组
            const section = getTimeSection(Date.now());
            chatSections[section].style.display = 'block';
            chatSections[section].appendChild(activeChatElement);
        }

        // 创建用户消息并展示在聊天框中
        const userMessage = document.createElement('div');
        userMessage.className = 'message-input';
        userMessage.textContent = messageText;
        chatArea.appendChild(userMessage);

        // **为当前请求新建一个独立的 div 用于展示 AI 的回复**
        const aiResponseContainer = document.createElement('div');
        aiResponseContainer.className = 'message-output';
        aiResponseContainer.innerHTML = `
            <div class="avatar"></div>
            <div class="text" id="aiResponse-${chatId}-${Date.now()}"></div>
        `;
        chatArea.appendChild(aiResponseContainer);

        // 存储消息
        chats[chatId] = chats[chatId] || [];
        chats[chatId].push({ isAI: false, text: messageText, timestamp: Date.now() });

        chatInput.value = '';  // 清空输入框

        // 调整布局，确保消息框显示并滚动到底部
        mainContent.classList.remove('centered');
        chatBox.classList.remove('centered');

        if (isFirstMessage) {
            chatBox.classList.add('expanded');
            mainContent.classList.add('expanded');
            isFirstMessage = false;
        }

        // 滚动到聊天区的底部
        chatArea.scrollTop = chatArea.scrollHeight;

        // 将用户消息发送到后端并处理流式响应
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_input: messageText,
                model: selectedModel,
                mode:chatTypeSelect.value
            }), // 发送用户输入到后端
        })
        .then(response => {
            if (!response.body) {
                throw new Error('ReadableStream not supported by your browser.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let aiResponseText = '';
            const responseTextElement = aiResponseContainer.querySelector('.text'); // 当前请求的回复容器

            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        return;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    let boundary = '\n\n';
                    let parts = buffer.split(boundary);

                    buffer = parts.pop(); // The last part may be incomplete

                    parts.forEach(part => {
                        if (part.startsWith('data: ')) {
                            const jsonStr = part.substring(6).trim();  // Remove 'data: ' prefix

                            if (jsonStr === '[END]') {
                                console.log('流式消息接收结束');
                                reader.cancel();
                                return;
                            }

                            try {
                                const data = JSON.parse(jsonStr);
                                console.log('收到的流式数据:', data);

                                // 更新当前 AI 回复容器的内容
                                aiResponseText += data.message + ' ';
                                responseTextElement.textContent = aiResponseText.trim();

                                chatArea.scrollTop = chatArea.scrollHeight;
                            } catch (e) {
                                console.error('解析 JSON 失败:', e);
                            }
                        }
                    });

                    read(); // Continue reading
                }).catch(error => {
                    console.error('读取流失败:', error);
                });
            }

            read(); // Start reading
        })
        .catch(error => {
            console.error('消息发送失败:', error);
        });
    }
}



// 监听 Enter 键发送消息
document.getElementById('chatInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 添加新对话的按钮监听器
document.getElementById('createNewChatBtn').addEventListener('click', function() {
    createNewChat(new Date().getTime());
});

// 点击头像和用户名显示或隐藏菜单
profile.addEventListener('click', () => {
    dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
});

// 点击页面其他位置时隐藏菜单
document.addEventListener('click', (event) => {
    if (!profile.contains(event.target)) {
        dropdownMenu.style.display = 'none';
    }
});

// 注销按钮功能
logoutBtn.addEventListener('click', () => {
    alert("已注销");
});
// 显示搜索弹窗
document.getElementById('searchButton').addEventListener('click', () => {
    document.getElementById('searchPopup').style.display = 'block';
    document.getElementById('searchOverlay').style.display = 'block';
});

// 隐藏搜索弹窗
document.getElementById('searchOverlay').addEventListener('click', () => {
    document.getElementById('searchPopup').style.display = 'none';
    document.getElementById('searchOverlay').style.display = 'none';
});

// 执行搜索功能
document.getElementById('searchSubmitButton').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const results = [];

    // 遍历对话记录
    for (const [chatId, messages] of Object.entries(chats)) {
        messages.forEach(message => {
            if (message.text.toLowerCase().includes(searchTerm)) {
                results.push({ chatId, text: message.text });
            }
        });
    }

    // 显示搜索结果
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (results.length > 0) {
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.textContent = `对话 ID: ${result.chatId} - 内容: ${result.text}`;
            resultItem.className = 'search-result-item';
            resultItem.dataset.chatId = result.chatId; // 存储对话 ID
            resultsContainer.appendChild(resultItem);

            // 绑定点击事件，跳转到对应对话
            resultItem.addEventListener('click', () => {
                const chatElement = document.querySelector(`.new-chat[data-chat-id="${result.chatId}"]`);
                if (chatElement) {
                    switchToChat(chatElement); // 切换到对应对话
                }
                // 关闭搜索弹窗
                document.getElementById('searchPopup').style.display = 'none';
                document.getElementById('searchOverlay').style.display = 'none';
            });
        });
    } else {
        resultsContainer.textContent = '未找到相关内容';
    }
});

// 获取 DOM 元素
const loginButton = document.getElementById('loginBtn');
const userInfo = document.querySelector('.user-info');
const usernameSpan = document.getElementById('username');
const logoutButton = document.getElementById('logoutBtn');

// 初始化：根据登录状态显示界面
document.addEventListener('DOMContentLoaded', async () => {
    const username = await getUsername();
    if (username) {
        const userInfo = document.querySelector('.user-info');
        const usernameSpan = document.getElementById('username');

        // 显示用户名
        usernameSpan.textContent = username;
        userInfo.style.display = 'flex'; // 显示用户信息区域
    } else {
        displayLoginButton(); // 如果未登录，显示登录按钮
    }
});

// 恢复登录按钮（注销后）
function displayLoginButton() {
    const loginButton = document.getElementById('loginBtn');
    const userInfo = document.querySelector('.user-info');

    loginButton.style.display = 'block'; // 显示登录按钮
    userInfo.style.display = 'none'; // 隐藏用户信息
    loginButton.addEventListener('click', () => {
        // 跳转到登录页面（替换为实际登录页面的 URL）
        window.location.href = '/login';
    });
}

// 显示用户信息（登录后）
function displayUser(username) {
    loginButton.style.display = 'none'; // 隐藏登录按钮
    userInfo.style.display = 'flex'; // 显示用户信息
    usernameSpan.textContent = username; // 设置用户名

    // 点击用户名显示或隐藏下拉菜单
    usernameSpan.addEventListener('click', () => {
        dropdownMenu.style.display =
            dropdownMenu.style.display === 'none' ? 'block' : 'none';
    });

    // // 点击注销按钮
    // logoutButton.addEventListener('click', () => {
    //     localStorage.removeItem('username'); // 清除登录状态
    //     alert('已注销');
    //     displayLoginButton(); // 重新显示登录按钮
    // });

    // 点击页面其他区域时隐藏下拉菜单
    document.addEventListener('click', (event) => {
        if (!userInfo.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });

    // 绑定注销按钮的点击事件
    logoutButton.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    alert('已注销');
                    displayLoginButton(); // 恢复登录按钮
                } else {
                    alert('注销失败');
                }
            })
            .catch(error => console.error('注销失败:', error));
    });
}

// 显示用户信息（登录后）
// function displayUser(username) {
//     const loginButton = document.getElementById('loginBtn');
//     const userInfo = document.querySelector('.user-info');
//     const usernameSpan = document.getElementById('username');

//     loginButton.style.display = 'none'; // 隐藏登录按钮
//     userInfo.style.display = 'flex'; // 显示用户信息
//     usernameSpan.textContent = username; // 设置用户名
// }

// 模拟登录成功后的逻辑（实际登录页面会处理此部分）
function simulateLogin(username) {
    localStorage.setItem('username', username); // 将用户名存储到 localStorage
    displayUser(username); // 更新界面
}

// 示例：模拟登录操作
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('username')) {
        const username = urlParams.get('username');
        simulateLogin(username);
    }
});
function getUsername() {
    return fetch('/api/get-username', { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.username) {
                return data.username; // 返回用户名
            } else {
                throw new Error('用户未登录');
            }
        })
        .catch(error => {
            console.error('获取用户名失败:', error);
            return null;
        });
}