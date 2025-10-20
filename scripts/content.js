// 内容脚本：在 GitHub issue 和 PR Files 页面添加 Chat 按钮，打开侧边栏聊天

(() => {
  console.log('[DeepSeek] 内容脚本初始化')

  let uiMounted = false

  // 判断是否为 GitHub 首页
  function isGitHubHomePage() {
    const p = location.pathname
    return p === '/' || p === ''
  }

  // 判断是否为 issue 页面（列表或详情）或 PR Files 页面
  function isIssuePage() {
    const p = location.pathname
    return p.includes('/issues') || (p.includes('/pull/') && p.includes('/files'))
  }

  // 创建内联 Chat 按钮（用于 issue action bar）
  function createInlineChatButton() {
    const btn = document.createElement('button')
    btn.className = 'ghds-inline-chat-btn btn-sm btn'
    btn.type = 'button'
    btn.title = 'Open DeepSeek Chat in Sidebar'
    btn.textContent = 'Codeagent Chat'
    btn.addEventListener('click', openBrowserSidePanel)
    return btn
  }

  // 创建 Files 页面专用的 Chat 按钮（更小的尺寸）
  function createFilesPageChatButton() {
    const btn = document.createElement('button')
    btn.className = 'ghds-inline-chat-btn-files'
    btn.type = 'button'
    btn.title = 'Open DeepSeek Chat in Sidebar'
    btn.textContent = 'Codeagent Chat'
    btn.addEventListener('click', openBrowserSidePanel)
    return btn
  }

  // 在 issue 页面的 action bar 中插入 Chat 按钮
  function insertIssueActionButton() {
    const actionBar = document.querySelector('[data-component="PH_Actions"]')
    if (!actionBar) return false

    // 检查是否已插入
    if (actionBar.querySelector('.ghds-inline-chat-btn')) return true

    // 查找内部的菜单容器
    const menuContainer = actionBar.querySelector('[class*="menuActionsContainer"]')
    if (!menuContainer) return false

    const chatBtn = createInlineChatButton()
    // 插入到菜单容器的第一个位置（Edit 按钮之前）
    menuContainer.insertBefore(chatBtn, menuContainer.firstChild)
    console.log('[DeepSeek] ✅ 已在 issue action bar 中插入 Chat 按钮')
    return true
  }

  // 在 PR Files 页面的 review tools 中插入 Chat 按钮
  function insertPRFilesButton() {
    const reviewTools = document.querySelector('.pr-review-tools')
    if (!reviewTools) return false

    // 检查是否已插入
    if (reviewTools.querySelector('.ghds-inline-chat-btn-files')) return true

    // 查找 "Review changes" 按钮容器
    const reviewChangesContainer = reviewTools.querySelector('.js-reviews-container')
    if (!reviewChangesContainer) return false

    // 使用 Files 页面专用按钮
    const chatBtn = createFilesPageChatButton()

    // 插入到 "Review changes" 按钮之后
    reviewChangesContainer.parentNode.insertBefore(chatBtn, reviewChangesContainer.nextSibling)
    console.log('[DeepSeek] ✅ 已在 PR Files review tools 中插入 Chat 按钮')
    return true
  }

  // 在 GitHub 首页的全局导航栏中插入 Codeagent 按钮
  function insertHomePageButton() {
    const globalBar = document.querySelector('.AppHeader-globalBar-end')
    if (!globalBar) return false

    // 检查是否已插入
    if (globalBar.querySelector('.ghds-homepage-btn')) return true

    const chatBtn = document.createElement('a')
    chatBtn.className = 'ghds-homepage-btn'
    chatBtn.href = chrome.runtime.getURL('chat.html')
    chatBtn.target = '_blank'
    chatBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v9.5A1.75 1.75 0 0 1 14.25 14H8.061l-2.574 2.573A1.457 1.457 0 0 1 3 15.543V14H1.75A1.75 1.75 0 0 1 0 12.25v-9.5C0 1.784.784 1 1.75 1ZM1.5 2.75v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z"></path>
      </svg>
      <span>Codeagent</span>
    `

    // 插入到导航栏最前面
    globalBar.insertBefore(chatBtn, globalBar.firstChild)
    console.log('[DeepSeek] ✅ 已在首页导航栏中插入 Codeagent 按钮')
    return true
  }


  // 打开浏览器原生侧边栏（需 MV3 side_panel 支持）
  async function openBrowserSidePanel() {
    try {
      console.log('[DeepSeek] 尝试打开侧边栏')

      // 通过消息发送到后台脚本，使用回调方式保持用户手势上下文
      const response = await chrome.runtime.sendMessage({
        type: 'open_side_panel'
      })

      if (response && response.ok) {
        console.log('[DeepSeek] ✅ 侧边栏打开成功！')
      } else {
        console.warn('[DeepSeek] ❌ 侧边栏打开失败：', response?.error || '未知错误')
        // 如果失败，显示提示
        showNotification('⚠️ 打开失败，请点击浏览器工具栏中的扩展图标')
      }
    } catch (e) {
      console.error('[DeepSeek] 打开侧边栏异常：', e)
      showNotification('⚠️ 打开失败，请点击浏览器工具栏中的扩展图标')
    }
  }

  // 显示页面通知
  function showNotification(message) {
    // 移除旧通知（如果存在）
    const oldNotification = document.querySelector('.deepseek-notification')
    if (oldNotification) {
      oldNotification.remove()
    }

    const notification = document.createElement('div')
    notification.className = 'deepseek-notification'
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
      z-index: 100000;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 350px;
      line-height: 1.5;
      cursor: pointer;
      transition: transform 0.2s ease;
      animation: deepseekSlideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">💡</div>
        <div style="flex: 1;">${message}</div>
        <div style="font-size: 20px; opacity: 0.8;">→</div>
      </div>
    `

    // 添加动画样式
    if (!document.getElementById('deepseek-notification-styles')) {
      const style = document.createElement('style')
      style.id = 'deepseek-notification-styles'
      style.textContent = `
        @keyframes deepseekSlideIn {
          from {
            transform: translateX(400px) scale(0.8);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes deepseekSlideOut {
          from {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
          to {
            transform: translateX(400px) scale(0.8);
            opacity: 0;
          }
        }
        .deepseek-notification:hover {
          transform: scale(1.02) !important;
        }
      `
      document.head.appendChild(style)
    }

    // 点击通知时高亮扩展图标区域（视觉提示）
    notification.addEventListener('click', () => {
      notification.style.animation = 'deepseekSlideOut 0.3s ease-out forwards'
      setTimeout(() => notification.remove(), 300)
    })

    document.body.appendChild(notification)

    // 5秒后自动移除
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'deepseekSlideOut 0.3s ease-out forwards'
        setTimeout(() => notification.remove(), 300)
      }
    }, 5000)
  }

  // 挂载 UI（防重复）
  function mountUI() {
    if (uiMounted) return // 已挂载

    const isHome = isGitHubHomePage()
    const isIssue = isIssuePage()

    if (!isHome && !isIssue) {
      if (uiMounted) {
        console.log('[DeepSeek] 离开目标页面，卸载 UI')
        unmountUI()
      }
      return
    }

    console.log('[DeepSeek] 识别到目标页面，挂载 UI')

    let inserted = false

    // GitHub 首页：插入导航栏按钮
    if (isHome) {
      inserted = insertHomePageButton() || inserted
    }

    // Issue/PR Files 页面：插入内联按钮
    if (isIssue) {
      inserted = insertIssueActionButton() || inserted
      inserted = insertPRFilesButton() || inserted
    }

    if (inserted) {
      uiMounted = true
      console.log('[DeepSeek] ✅ UI 挂载完成')
    } else {
      console.log('[DeepSeek] ⚠️ 未找到插入位置')
    }
  }

  // 卸载 UI（在离开 issue/PR Files 页面时）
  function unmountUI() {
    if (!uiMounted) return

    // 移除所有内联按钮（包括两种样式）
    document.querySelectorAll('.ghds-inline-chat-btn').forEach(btn => btn.remove())
    document.querySelectorAll('.ghds-inline-chat-btn-files').forEach(btn => btn.remove())

    uiMounted = false
  }

  // 适配 GitHub 的动态导航
  function setupNavigationHooks() {
    // Turbo/PJAX 事件
    document.addEventListener('turbo:load', mountUI)
    document.addEventListener('pjax:end', mountUI)
    // History API hook
    const origPushState = history.pushState
    const origReplaceState = history.replaceState
    history.pushState = function (...args) {
      const ret = origPushState.apply(this, args)
      setTimeout(mountUI, 0)
      return ret
    }
    history.replaceState = function (...args) {
      const ret = origReplaceState.apply(this, args)
      setTimeout(mountUI, 0)
      return ret
    }
    window.addEventListener('popstate', () => setTimeout(mountUI, 0))

    // 兜底：轮询 URL 变化（避免遗漏）
    let lastPath = location.pathname
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname
        mountUI()
      }
    }, 1000)
  }

  // 初始化
  function init() {
    mountUI()
    setupNavigationHooks()
  }

  // 文档就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
