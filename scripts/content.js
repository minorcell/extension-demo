// 内容脚本：在 GitHub issue 页面添加右下角浮点按钮，打开侧边栏聊天

(() => {
  console.log('[DeepSeek] 内容脚本初始化')

  let uiMounted = false
  let floatingBtn = null

  // 判断是否为 issue 页面（列表或详情）
  function isIssuePage() {
    const p = location.pathname
    return p.includes('/issues')
  }

  // 创建浮动按钮
  function createFloatingButton() {
    const btn = document.createElement('button')
    btn.className = 'ghds-floating-btn'
    btn.title = 'DeepSeek Chat'
    btn.textContent = 'AI'
    // 直接打开浏览器原生侧边栏
    btn.addEventListener('click', openBrowserSidePanel)
    document.body.appendChild(btn)
    return btn
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
  function mountUIIfIssue() {
    if (!isIssuePage()) {
      if (uiMounted) {
        console.log('[DeepSeek] 离开 issue 页面，卸载 UI')
        unmountUI()
      }
      return
    }
    if (uiMounted) return // 已挂载
    console.log('[DeepSeek] 识别到 issue 页面，挂载 UI')
    floatingBtn = createFloatingButton()
    uiMounted = true
  }

  // 卸载 UI（在离开 issue 页面时）
  function unmountUI() {
    if (!uiMounted) return
    floatingBtn?.remove()
    floatingBtn = null
    uiMounted = false
  }

  // 适配 GitHub 的动态导航
  function setupNavigationHooks() {
    // Turbo/PJAX 事件
    document.addEventListener('turbo:load', mountUIIfIssue)
    document.addEventListener('pjax:end', mountUIIfIssue)
    // History API hook
    const origPushState = history.pushState
    const origReplaceState = history.replaceState
    history.pushState = function (...args) {
      const ret = origPushState.apply(this, args)
      setTimeout(mountUIIfIssue, 0)
      return ret
    }
    history.replaceState = function (...args) {
      const ret = origReplaceState.apply(this, args)
      setTimeout(mountUIIfIssue, 0)
      return ret
    }
    window.addEventListener('popstate', () => setTimeout(mountUIIfIssue, 0))

    // 兜底：轮询 URL 变化（避免遗漏）
    let lastPath = location.pathname
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname
        mountUIIfIssue()
      }
    }, 1000)
  }

  // 初始化
  function init() {
    mountUIIfIssue()
    setupNavigationHooks()
  }

  // 文档就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
