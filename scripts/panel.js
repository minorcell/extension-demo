// 面板脚本：与背景页通信，调用 DeepSeek，渲染聊天
// 支持上下文记忆和历史持久化

// 全局聊天历史数组
let chatHistory = [];
const STORAGE_KEY = 'deepseek_chat_history';
const MAX_HISTORY_LENGTH = 50; // 最多保存 50 条消息
const CONTEXT_WINDOW = 10; // 发送给 AI 的上下文消息数量（最近 10 条）

// 加载聊天历史
async function loadChatHistory() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
      chatHistory = result[STORAGE_KEY];
      console.log('[DeepSeek] 加载了', chatHistory.length, '条历史消息');
      return chatHistory;
    }
  } catch (e) {
    console.warn('[DeepSeek] 加载历史失败：', e);
  }
  return [];
}

// 保存聊天历史
async function saveChatHistory() {
  try {
    // 只保留最近的消息
    const historyToSave = chatHistory.slice(-MAX_HISTORY_LENGTH);
    await chrome.storage.local.set({ [STORAGE_KEY]: historyToSave });
    console.log('[DeepSeek] 已保存', historyToSave.length, '条消息');
  } catch (e) {
    console.warn('[DeepSeek] 保存历史失败：', e);
  }
}

// 添加消息到历史
function addMessageToHistory(msg) {
  chatHistory.push(msg);
  saveChatHistory(); // 异步保存，不阻塞
}

// 渲染消息到 UI
function appendMessage(chatEl, msg) {
  const wrap = document.createElement('div');
  wrap.className = 'ghds-message ' + (msg.role === 'assistant' ? 'assistant' : 'user');
  const role = document.createElement('div');
  role.className = 'role';
  role.textContent = msg.role === 'assistant' ? 'Assistant' : 'You';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.content;
  wrap.appendChild(role);
  wrap.appendChild(bubble);
  chatEl.appendChild(wrap);
}

// 请求 LLM 流式回复（携带上下文）
function requestLLMReplyStream(userMessage, onChunk, onDone, onError) {
  // 获取最近的上下文消息
  const recentContext = chatHistory.slice(-CONTEXT_WINDOW);

  // 建立长连接
  const port = chrome.runtime.connect({ name: 'deepseek_stream' });

  let fullContent = '';

  port.onMessage.addListener((msg) => {
    if (msg.type === 'chunk') {
      // 接收到增量内容
      fullContent += msg.content;
      onChunk(msg.content, fullContent);
    } else if (msg.type === 'done') {
      // 流式响应结束
      port.disconnect();
      onDone(fullContent);
    } else if (msg.type === 'error') {
      // 发生错误
      port.disconnect();
      onError(msg.error || '未知错误');
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('[DeepSeek] 端口断开');
  });

  // 发送请求开始流式生成
  port.postMessage({
    type: 'start_stream',
    prompt: userMessage,
    context: recentContext
  });

  // 返回端口以便可以手动断开
  return port;
}

// 渲染所有历史消息
function renderHistory(chatEl) {
  chatEl.innerHTML = ''; // 清空
  chatHistory.forEach(msg => {
    appendMessage(chatEl, msg);
  });
  chatEl.scrollTop = chatEl.scrollHeight;
}

document.addEventListener('DOMContentLoaded', async () => {
  const chat = document.getElementById('chat');
  const form = document.getElementById('form');
  const promptEl = document.getElementById('prompt');
  const clearBtn = document.getElementById('clearBtn');

  // 加载并渲染历史消息
  await loadChatHistory();
  renderHistory(chat);

  // 清除历史按钮
  clearBtn.addEventListener('click', async () => {
    if (confirm('确定要清除所有对话历史吗？')) {
      chatHistory = [];
      await chrome.storage.local.remove([STORAGE_KEY]);
      chat.innerHTML = '';
      console.log('[DeepSeek] 已清除对话历史');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = promptEl.value.trim();
    if (!content) return;
    promptEl.value = '';

    // 用户消息
    const userMsg = { role: 'user', content };
    addMessageToHistory(userMsg);
    appendMessage(chat, userMsg);
    chat.scrollTop = chat.scrollHeight;

    // 创建 AI 回复消息容器
    const assistantWrap = document.createElement('div');
    assistantWrap.className = 'ghds-message assistant';
    const roleDiv = document.createElement('div');
    roleDiv.className = 'role';
    roleDiv.textContent = 'Codeagent';
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble streaming';
    bubbleDiv.textContent = ''; // 初始为空
    assistantWrap.appendChild(roleDiv);
    assistantWrap.appendChild(bubbleDiv);
    chat.appendChild(assistantWrap);
    chat.scrollTop = chat.scrollHeight;

    // 添加流式输出光标效果
    bubbleDiv.innerHTML = '<span class="cursor">▊</span>';

    // 开始流式请求
    requestLLMReplyStream(
      content,
      // onChunk - 接收到增量内容
      (chunk, fullContent) => {
        bubbleDiv.textContent = fullContent;
        // 添加光标
        bubbleDiv.innerHTML = fullContent + '<span class="cursor">▊</span>';
        chat.scrollTop = chat.scrollHeight;
      },
      // onDone - 流式响应结束
      (fullContent) => {
        bubbleDiv.textContent = fullContent || '（无回复）';
        bubbleDiv.classList.remove('streaming');
        // 保存到历史
        const assistantMsg = { role: 'assistant', content: fullContent || '（无回复）' };
        addMessageToHistory(assistantMsg);
        chat.scrollTop = chat.scrollHeight;
      },
      // onError - 发生错误
      (error) => {
        bubbleDiv.textContent = `错误：${error}`;
        bubbleDiv.classList.remove('streaming');
        bubbleDiv.classList.add('error');
        // 保存错误消息到历史
        const assistantMsg = { role: 'assistant', content: `错误：${error}` };
        addMessageToHistory(assistantMsg);
      }
    );
  });
});
