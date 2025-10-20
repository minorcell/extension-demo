// 选项页脚本：保存与读取 DeepSeek 设置

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        deepseek_api_key: '',
        deepseek_base_url: 'https://api.deepseek.com',
        deepseek_model: 'deepseek-chat'
      },
      (items) => resolve(items)
    )
  })
}

function saveSettings(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, () => resolve(true))
  })
}

// 显示通知
function showNotification(message, type = 'success') {
  // 移除旧通知
  const oldAlert = document.querySelector('.alert-dynamic')
  if (oldAlert) {
    oldAlert.remove()
  }

  const alert = document.createElement('div')
  alert.className = `alert alert-${type} alert-dynamic`
  alert.style.animation = 'slideDown 0.3s ease'

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  alert.innerHTML = `
    <span class="alert-icon">${icons[type] || icons.info}</span>
    <div class="alert-content">${message}</div>
  `

  const container = document.querySelector('.container')
  const settingsCard = document.querySelector('.settings-card')
  container.insertBefore(alert, settingsCard.nextSibling)

  // 3秒后自动移除
  setTimeout(() => {
    if (alert.parentNode) {
      alert.style.animation = 'slideUp 0.3s ease'
      setTimeout(() => alert.remove(), 300)
    }
  }, 3000)
}

// 测试 API 连接
async function testConnection(apiKey, baseUrl, model) {
  if (!apiKey) {
    throw new Error('请先输入 API Key')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`连接失败 (${response.status}): ${text}`)
  }

  return true
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyEl = document.getElementById('apiKey')
  const baseUrlEl = document.getElementById('baseUrl')
  const modelEl = document.getElementById('model')
  const saveBtn = document.getElementById('saveBtn')
  const testBtn = document.getElementById('testBtn')

  // 加载已保存的设置
  const settings = await loadSettings()
  apiKeyEl.value = settings.deepseek_api_key || ''
  baseUrlEl.value = settings.deepseek_base_url || 'https://api.deepseek.com'
  modelEl.value = settings.deepseek_model || 'deepseek-chat'

  // 保存设置
  saveBtn.addEventListener('click', async () => {
    const values = {
      deepseek_api_key: apiKeyEl.value.trim(),
      deepseek_base_url: baseUrlEl.value.trim() || 'https://api.deepseek.com',
      deepseek_model: modelEl.value.trim() || 'deepseek-chat'
    }

    try {
      await saveSettings(values)
      saveBtn.textContent = '✓ 已保存'
      saveBtn.classList.add('btn-success')
      showNotification('设置已保存成功！', 'success')

      setTimeout(() => {
        saveBtn.textContent = '保存设置'
        saveBtn.classList.remove('btn-success')
      }, 2000)
    } catch (error) {
      showNotification('保存失败: ' + error.message, 'error')
    }
  })

  // 测试连接
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim()
    const baseUrl = baseUrlEl.value.trim() || 'https://api.deepseek.com'
    const model = modelEl.value.trim() || 'deepseek-chat'

    testBtn.textContent = '测试中...'
    testBtn.disabled = true

    try {
      await testConnection(apiKey, baseUrl, model)
      showNotification('✅ 连接成功！API 配置正常工作。', 'success')
      testBtn.textContent = '✓ 连接成功'
      setTimeout(() => {
        testBtn.textContent = '测试连接'
      }, 2000)
    } catch (error) {
      showNotification('连接失败: ' + error.message, 'error')
      testBtn.textContent = '测试连接'
    } finally {
      testBtn.disabled = false
    }
  })

  // 添加动画样式
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-20px);
      }
    }
  `
  document.head.appendChild(style)
})
