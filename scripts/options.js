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

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyEl = document.getElementById('apiKey')
  const baseUrlEl = document.getElementById('baseUrl')
  const modelEl = document.getElementById('model')
  const saveBtn = document.getElementById('saveBtn')

  const settings = await loadSettings()
  apiKeyEl.value = settings.deepseek_api_key || ''
  baseUrlEl.value = settings.deepseek_base_url || 'https://api.deepseek.com'
  modelEl.value = settings.deepseek_model || 'deepseek-chat'

  saveBtn.addEventListener('click', async () => {
    const values = {
      deepseek_api_key: apiKeyEl.value.trim(),
      deepseek_base_url: baseUrlEl.value.trim() || 'https://api.deepseek.com',
      deepseek_model: modelEl.value.trim() || 'deepseek-chat'
    }
    await saveSettings(values)
    saveBtn.textContent = '已保存'
    setTimeout(() => (saveBtn.textContent = '保存'), 1500)
  })
})
