// 背景服务：接收内容脚本消息，调用 DeepSeek API
// 注意：网络访问需在扩展权限和用户配置下进行

// 读取存储配置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        deepseek_api_key: '',
        deepseek_base_url: 'https://api.deepseek.com',
        deepseek_model: 'deepseek-chat'
      },
      (items) => resolve(items)
    );
  });
}

// 调用 DeepSeek 流式文本生成（支持上下文对话）
async function callDeepSeekGenerateStream({ prompt, context = [], port }) {
  const { deepseek_api_key, deepseek_base_url, deepseek_model } = await getSettings();
  if (!deepseek_api_key) {
    port.postMessage({ type: 'error', error: '未配置 DeepSeek API Key，请在扩展设置页填写。' });
    return;
  }

  try {
    const url = `${deepseek_base_url.replace(/\/$/, '')}/v1/chat/completions`;

    // 构建消息数组：系统提示 + 历史上下文 + 当前用户消息
    const messages = [
      {
        role: 'system',
        content: `你是一位务实、资深的大模型Agent，你叫Codeagent，正在通过侧边栏与同事交流技术问题。

核心原则：
1. 直接用纯文本回答，不要使用 Markdown 格式（不要用 **, ##, \`\`\`, 等符号）
2. 用自然的对话语气，像老司机聊天一样务实、直接
3. 代码直接写出来，不加任何修饰符号
4. 重要信息可以用空行分隔，或用数字 1. 2. 3. 列举
5. 专注于解决实际问题，少说废话，多给干货

回答风格示例：
- 不要说："您可以使用以下代码..."，而是："直接这样写就行："
- 不要用代码块，直接写代码
- 用简洁、实用的语言，像在工位上给同事解释代码一样`
      }
    ];

    // 添加历史上下文（如果有）
    if (context && Array.isArray(context) && context.length > 0) {
      console.log('[DeepSeek] 携带', context.length, '条上下文消息');
      messages.push(...context);
    }

    // 添加当前用户消息（如果 context 中还没有）
    const lastMessage = context[context.length - 1];
    if (!lastMessage || lastMessage.content !== prompt) {
      messages.push({ role: 'user', content: prompt });
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseek_api_key}`
      },
      body: JSON.stringify({
        model: deepseek_model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true // 启用流式输出
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      port.postMessage({ type: 'error', error: `HTTP ${resp.status}: ${text}` });
      return;
    }

    // 读取流式响应
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const jsonStr = trimmed.slice(6); // 移除 "data: " 前缀
          const data = JSON.parse(jsonStr);
          const delta = data?.choices?.[0]?.delta?.content;

          if (delta) {
            // 发送增量内容到前端
            port.postMessage({ type: 'chunk', content: delta });
          }
        } catch (e) {
          console.warn('[DeepSeek] 解析流式数据失败：', e, trimmed);
        }
      }
    }

    // 流式响应结束
    port.postMessage({ type: 'done' });
  } catch (err) {
    console.error('[DeepSeek] 流式请求失败：', err);
    port.postMessage({ type: 'error', error: err?.message || String(err) });
  }
}

// 长连接监听（用于流式响应）
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'deepseek_stream') {
    console.log('[DeepSeek] 建立流式连接');

    port.onMessage.addListener((msg) => {
      if (msg.type === 'start_stream') {
        // 开始流式生成
        callDeepSeekGenerateStream({
          prompt: msg.prompt,
          context: msg.context || [],
          port: port
        });
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[DeepSeek] 流式连接断开');
    });
  }
});

// 消息监听（保留用于非流式请求）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // 处理打开侧边栏请求 - 使用回调方式保持用户手势上下文
  if (msg?.type === 'open_side_panel') {
    console.log('[DeepSeek] 收到打开侧边栏请求，sender.tab.id =', sender?.tab?.id);

    // 检查 API 支持
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
      sendResponse({ ok: false, error: '浏览器不支持 sidePanel API，请使用 Chrome 114+ 或 Edge 115+' });
      return false;
    }

    // 获取 tabId（必须同步获取，不能用 await）
    // 如果来自 popup，sender.tab 可能为空，需查询当前激活标签页
    let tabId = sender?.tab?.id;
    if (!tabId) {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs && tabs[0];
          if (!activeTab) {
            sendResponse({ ok: false, error: '无法获取激活标签页' });
            return;
          }
          tabId = activeTab.id;

          chrome.sidePanel.setOptions({
            tabId: tabId,
            enabled: true,
            path: 'panel.html'
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('[DeepSeek] 设置侧边栏选项失败：', chrome.runtime.lastError);
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            chrome.sidePanel.open({ tabId: tabId }, () => {
              if (chrome.runtime.lastError) {
                console.error('[DeepSeek] 打开侧边栏失败：', chrome.runtime.lastError);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                console.log('[DeepSeek] 侧边栏成功打开！（popup 请求）');
                sendResponse({ ok: true });
              }
            });
          });
        });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return true; // 异步响应
    }
    if (!tabId) {
      sendResponse({ ok: false, error: '无法获取标签页 ID' });
      return false;
    }

    // 使用回调方式设置选项并打开侧边栏（保持用户手势上下文）
    chrome.sidePanel.setOptions({
      tabId: tabId,
      enabled: true,
      path: 'panel.html'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DeepSeek] 设置侧边栏选项失败：', chrome.runtime.lastError);
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      // 立即在回调中打开侧边栏（保持用户手势上下文）
      chrome.sidePanel.open({ tabId: tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error('[DeepSeek] 打开侧边栏失败：', chrome.runtime.lastError);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[DeepSeek] 侧边栏成功打开！');
          sendResponse({ ok: true });
        }
      });
    });

    return true; // 保持消息通道开启以进行异步响应
  }
});

// 当 manifest 定义了 default_popup 时，点击图标应打开 popup，而不是侧边栏
// 只有在未定义 popup 的情况下，才注册点击监听以打开侧边栏
(() => {
  const manifest = chrome.runtime.getManifest();
  const hasPopup = !!(manifest && manifest.action && manifest.action.default_popup);
  // 某些环境下如果之前设置过 openPanelOnActionClick = true，会导致点击扩展图标直接打开侧边栏
  // 为避免与 popup 冲突，这里根据是否定义了 default_popup 主动设置行为
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !hasPopup });
      console.log('[DeepSeek] 已设置 sidePanel 行为：openPanelOnActionClick =', !hasPopup);
    }
  } catch (e) {
    console.warn('[DeepSeek] 设置 sidePanel 行为失败：', e);
  }
  if (!hasPopup) {
    chrome.action.onClicked.addListener(async (tab) => {
      try {
        console.log('[DeepSeek] 扩展图标被点击，tab.id =', tab.id);

        if (!chrome.sidePanel || !chrome.sidePanel.open) {
          console.error('[DeepSeek] 浏览器不支持 sidePanel API');
          return;
        }

        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          enabled: true,
          path: 'panel.html'
        });

        await chrome.sidePanel.open({ tabId: tab.id });
        console.log('[DeepSeek] 侧边栏已通过 action 图标打开');
      } catch (e) {
        console.error('[DeepSeek] 打开侧边栏失败：', e);
      }
    });
  } else {
    console.log('[DeepSeek] 检测到 default_popup，未注册 action.onClicked，以避免与 popup 冲突');
  }
})();
