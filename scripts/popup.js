// Popup quick menu: open side panel, chat page, and options

function openSidePanel() {
  // Prefer opening side panel directly from popup to keep user gesture context
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab) return

      chrome.sidePanel.setOptions({
        tabId: tab.id,
        enabled: true,
        path: 'panel.html'
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Popup] setOptions failed:', chrome.runtime.lastError)
          // Fallback to background message
          chrome.runtime.sendMessage({ type: 'open_side_panel' }, (resp) => {
            if (resp && resp.ok) {
              window.close()
            } else {
              console.warn('[Popup] open_side_panel failed:', resp?.error)
            }
          })
          return
        }

        chrome.sidePanel.open({ tabId: tab.id }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Popup] sidePanel.open failed:', chrome.runtime.lastError)
            // Fallback to background message
            chrome.runtime.sendMessage({ type: 'open_side_panel' }, (resp) => {
              if (resp && resp.ok) {
                window.close()
              } else {
                console.warn('[Popup] open_side_panel failed:', resp?.error)
              }
            })
          } else {
            window.close()
          }
        })
      })
    })
    return
  }

  // Fallback: use background handler
  chrome.runtime.sendMessage({ type: 'open_side_panel' }, (resp) => {
    if (resp && resp.ok) {
      window.close()
    } else {
      console.warn('[Popup] open_side_panel failed:', resp?.error)
    }
  })
}

function openChatPage() {
  const url = chrome.runtime.getURL('chat.html')
  chrome.tabs.create({ url })
  window.close()
}

function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  } else {
    const url = chrome.runtime.getURL('options.html')
    chrome.tabs.create({ url })
  }
  window.close()
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('openSidePanelBtn')?.addEventListener('click', openSidePanel)
  document.getElementById('openChatBtn')?.addEventListener('click', openChatPage)
  document.getElementById('openOptionsBtn')?.addEventListener('click', openOptionsPage)
})
