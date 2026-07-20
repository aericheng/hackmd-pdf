document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('exportBtn');
  const statusDiv = document.getElementById('status');

  // 檢查目前頁面是否是 HackMD
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;

    if (!url.includes('hackmd.io')) {
      statusDiv.textContent = '請在 HackMD 頁面上使用此擴充功能';
      statusDiv.className = 'status error';
      exportBtn.disabled = true;
      return;
    }

    statusDiv.textContent = '準備就緒';
    statusDiv.className = 'status ready';
  });

  // 匯出按鈕點擊事件
  exportBtn.addEventListener('click', async function() {
    exportBtn.disabled = true;
    statusDiv.textContent = '正在準備匯出...';
    statusDiv.className = 'status processing';

    try {
      // 取得目前活動分頁
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 先嘗試注入 content script（如果還沒載入的話）
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // 等待一下讓 content script 初始化
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // content script 可能已經載入，忽略錯誤
      }

      // 向 content script 發送訊息
      chrome.tabs.sendMessage(tab.id, { action: 'exportPDF' }, function(response) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = '匯出失敗：' + chrome.runtime.lastError.message;
          statusDiv.className = 'status error';
          exportBtn.disabled = false;
          return;
        }

        if (response && response.success) {
          statusDiv.textContent = '匯出成功！';
          statusDiv.className = 'status success';

          // 3 秒後恢復按鈕狀態
          setTimeout(() => {
            exportBtn.disabled = false;
            statusDiv.textContent = '準備就緒';
            statusDiv.className = 'status ready';
          }, 3000);
        } else {
          statusDiv.textContent = '匯出失敗：' + (response ? response.error : '未知錯誤');
          statusDiv.className = 'status error';
          exportBtn.disabled = false;
        }
      });
    } catch (error) {
      statusDiv.textContent = '匯出失敗：' + error.message;
      statusDiv.className = 'status error';
      exportBtn.disabled = false;
    }
  });
});
