// 独立聊天页面脚本

(() => {
  console.log('[Codeagent Chat] 页面初始化')

  // Mock 仓库数据
  const mockRepositories = [
    {
      id: 1,
      name: 'anthropics/claude-code',
      description: 'Claude Code Extension',
      language: 'TypeScript'
    },
    {
      id: 2,
      name: 'microsoft/vscode',
      description: 'Visual Studio Code',
      language: 'TypeScript'
    },
    {
      id: 3,
      name: 'facebook/react',
      description: 'A declarative JavaScript library',
      language: 'JavaScript'
    },
    {
      id: 4,
      name: 'vercel/next.js',
      description: 'The React Framework',
      language: 'JavaScript'
    },
    {
      id: 5,
      name: 'golang/go',
      description: 'The Go programming language',
      language: 'Go'
    },
    {
      id: 6,
      name: 'python/cpython',
      description: 'The Python programming language',
      language: 'Python'
    },
    {
      id: 7,
      name: 'rust-lang/rust',
      description: 'Rust programming language',
      language: 'Rust'
    },
    {
      id: 8,
      name: 'nodejs/node',
      description: 'Node.js JavaScript runtime',
      language: 'JavaScript'
    }
  ]

  let selectedRepo = null
  let messageHistory = []

  // 初始化仓库列表
  function initRepositories() {
    const repoList = document.getElementById('repoList')
    repoList.innerHTML = ''

    mockRepositories.forEach(repo => {
      const repoItem = document.createElement('div')
      repoItem.className = 'repo-item'
      repoItem.dataset.repoId = repo.id
      repoItem.innerHTML = `
        <span class="repo-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
          </svg>
        </span>
        <div class="repo-info">
          <div class="repo-name">${repo.name}</div>
          <div class="repo-desc">${repo.description}</div>
        </div>
      `

      repoItem.addEventListener('click', () => selectRepository(repo, repoItem))
      repoList.appendChild(repoItem)
    })
  }

  // 选择仓库
  function selectRepository(repo, element) {
    selectedRepo = repo

    // 更新选中状态
    document.querySelectorAll('.repo-item').forEach(item => {
      item.classList.remove('active')
    })
    element.classList.add('active')

    // 更新顶部显示
    document.getElementById('repoName').textContent = repo.name

    // 清空聊天历史
    messageHistory = []
    renderMessages()

    console.log('[Codeagent] 已选择仓库:', repo.name)
  }

  // 仓库搜索
  function setupSearch() {
    const searchInput = document.getElementById('repoSearch')
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase()
      const repoItems = document.querySelectorAll('.repo-item')

      repoItems.forEach(item => {
        const repoName = item.querySelector('.repo-name').textContent.toLowerCase()
        const repoDesc = item.querySelector('.repo-desc').textContent.toLowerCase()

        if (repoName.includes(query) || repoDesc.includes(query)) {
          item.style.display = 'flex'
        } else {
          item.style.display = 'none'
        }
      })
    })
  }

  // 渲染消息
  function renderMessages() {
    const chatDiv = document.getElementById('chat')

    if (messageHistory.length === 0) {
      chatDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">开始对话</div>
          <div class="empty-state-desc">
            ${selectedRepo
              ? `你已选择 <strong>${selectedRepo.name}</strong> 仓库。输入你的问题开始对话。`
              : '请先从左侧选择一个仓库，然后开始对话。'}
          </div>
        </div>
      `
      return
    }

    chatDiv.innerHTML = ''
    messageHistory.forEach(msg => {
      const msgDiv = document.createElement('div')
      msgDiv.className = `message ${msg.role}`

      const roleText = msg.role === 'user' ? 'You' : 'Codeagent'

      msgDiv.innerHTML = `
        <div class="role">${roleText}</div>
        <div class="bubble ${msg.error ? 'error' : ''}">${msg.content}</div>
      `

      chatDiv.appendChild(msgDiv)
    })

    // 滚动到底部
    chatDiv.scrollTop = chatDiv.scrollHeight
  }

  // 添加消息
  function addMessage(role, content, error = false) {
    messageHistory.push({ role, content, error })
    renderMessages()
  }

  // 发送消息
  async function sendMessage(userInput) {
    if (!selectedRepo) {
      addMessage('assistant', '⚠️ 请先选择一个仓库', true)
      return
    }

    if (!userInput.trim()) return

    // 添加用户消息
    addMessage('user', userInput)

    // 创建流式连接
    const port = chrome.runtime.connect({ name: 'deepseek_stream' })

    // 添加 AI 消息占位符
    const aiMessageIndex = messageHistory.length
    addMessage('assistant', '')

    let aiResponse = ''

    port.onMessage.addListener((msg) => {
      if (msg.type === 'chunk') {
        aiResponse += msg.content
        messageHistory[aiMessageIndex].content = aiResponse
        renderMessages()
      } else if (msg.type === 'done') {
        console.log('[Codeagent] 流式响应完成')
        port.disconnect()
      } else if (msg.type === 'error') {
        messageHistory[aiMessageIndex].content = `❌ ${msg.error}`
        messageHistory[aiMessageIndex].error = true
        renderMessages()
        port.disconnect()
      }
    })

    // 构建上下文消息（包含仓库信息）
    const contextMessages = [
      {
        role: 'system',
        content: `当前正在讨论的仓库是：${selectedRepo.name}\n描述：${selectedRepo.description}\n语言：${selectedRepo.language}`
      },
      ...messageHistory.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }))
    ]

    // 发送流式请求
    port.postMessage({
      type: 'start_stream',
      prompt: userInput,
      context: contextMessages
    })
  }

  // 表单提交
  function setupForm() {
    const form = document.getElementById('form')
    const promptEl = document.getElementById('prompt')

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const userInput = promptEl.value.trim()
      if (!userInput) return

      promptEl.value = ''
      promptEl.style.height = 'auto'

      await sendMessage(userInput)
    })

    // 自动调整 textarea 高度
    promptEl.addEventListener('input', () => {
      promptEl.style.height = 'auto'
      promptEl.style.height = promptEl.scrollHeight + 'px'
    })

    // 回车发送，Shift+回车换行
    promptEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        form.dispatchEvent(new Event('submit'))
      }
    })
  }

  // 清除对话
  function setupClearButton() {
    const clearBtn = document.getElementById('clearBtn')
    clearBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有对话历史吗？')) {
        messageHistory = []
        renderMessages()
        console.log('[Codeagent] 对话已清除')
      }
    })
  }

  // 设置按钮
  function setupSettingsButton() {
    const settingsBtn = document.getElementById('settingsBtn')
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })
  }

  // 初始化
  function init() {
    initRepositories()
    setupSearch()
    setupForm()
    setupClearButton()
    setupSettingsButton()
    renderMessages()

    console.log('[Codeagent Chat] 初始化完成')
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
