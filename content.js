// 防止 content script 重複載入
if (window.hackmdPdfExporterLoaded) {
  // 跳過重複載入
} else {
  window.hackmdPdfExporterLoaded = true;

// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'exportPDF') {
    exportToPDF()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('PDF 匯出錯誤:', error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回 true 表示會非同步發送回應
    return true;
  }
});

// 匯出 PDF 的主函式
async function exportToPDF() {
  try {
    // 取得 HackMD 的渲染內容區域
    let contentElement = document.querySelector('.ui-view-area') ||
                        document.querySelector('.markdown-body') ||
                        document.querySelector('#doc') ||
                        document.querySelector('.CodeMirror-scroll');

    if (!contentElement) {
      // 如果是在編輯模式，嘗試切換到預覽模式
      const viewModeBtn = document.querySelector('.ui-view-btn') ||
                          document.querySelector('[data-mode="view"]');
      if (viewModeBtn) {
        viewModeBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        contentElement = document.querySelector('.ui-view-area') ||
                        document.querySelector('.markdown-body');
      }
    }

    if (!contentElement) {
      throw new Error('無法找到 HackMD 內容區域，請確保在檢視模式下');
    }

    // 等待 LaTeX/MathJax 渲染完成
    await waitForMathRender();

    // 禁用頁面上所有可能干擾的列印樣式
    disableInterferingStyles();

    // 使用瀏覽器的列印功能來產生 PDF
    window.print();

    // 列印後恢復樣式
    setTimeout(() => {
      enableInterferingStyles();
    }, 1000);

    return true;
  } catch (error) {
    console.error('匯出 PDF 失敗:', error);
    throw error;
  }
}

// 禁用可能干擾的頁面樣式
let disabledStyles = [];

function disableInterferingStyles() {
  disabledStyles = [];
  const allStyles = document.querySelectorAll('style');

  allStyles.forEach(style => {
    if (style.id === 'hackmd-pdf-exporter-styles') {
      return;
    }

    const styleText = style.textContent || '';
    if (styleText.includes('@media print') || styleText.includes('a[href]')) {
      disabledStyles.push(style);
      style.disabled = true;
      style.setAttribute('data-hackmd-exporter-disabled', 'true');
    }
  });
}

function enableInterferingStyles() {
  disabledStyles.forEach(style => {
    style.disabled = false;
    style.removeAttribute('data-hackmd-exporter-disabled');
  });
  disabledStyles = [];
}

// 等待數學公式渲染完成
async function waitForMathRender() {
  // 先滾動整個頁面以觸發所有懶加載的數學公式渲染
  await scrollToTriggerLazyLoad();

  // 給予初始等待時間讓 MathJax/KaTeX 開始工作
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 等待 MathJax 渲染
  if (window.MathJax) {
    // MathJax v3
    if (window.MathJax.typesetPromise) {
      try {
        await window.MathJax.typesetPromise();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // 忽略錯誤
      }
    }

    // MathJax v2
    if (window.MathJax.Hub && window.MathJax.Hub.Queue) {
      await new Promise(resolve => {
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
        window.MathJax.Hub.Queue(resolve);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 檢查直到已渲染數量穩定（最多等待 5 秒）
  const maxWaitTime = 5000;
  const checkInterval = 500;
  const startTime = Date.now();
  let lastRenderedCount = 0;
  let stableCount = 0;

  while (Date.now() - startTime < maxWaitTime) {
    const renderedMath = document.querySelectorAll(
      '.MathJax, .MathJax_Display, .MathJax_SVG, .MathJax_CHTML, ' +
      '.katex, .katex-display, ' +
      'mjx-container, mjx-math'
    );

    const currentCount = renderedMath.length;

    if (currentCount === lastRenderedCount) {
      stableCount++;
      if (stableCount >= 2) {
        break;
      }
    } else {
      stableCount = 0;
    }

    lastRenderedCount = currentCount;
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // 最後等待一點時間確保完全載入
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 滾動頁面以觸發懶加載的內容
async function scrollToTriggerLazyLoad() {
  const originalScrollY = window.scrollY || window.pageYOffset;

  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  const viewportHeight = window.innerHeight;

  if (documentHeight <= viewportHeight) {
    return;
  }

  // 快速滾動到底部
  const steps = 10;
  const stepSize = documentHeight / steps;

  for (let i = 1; i <= steps; i++) {
    window.scrollTo({ top: stepSize * i, behavior: 'auto' });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await new Promise(resolve => setTimeout(resolve, 300));

  // 滾動回頂部
  window.scrollTo({ top: 0, behavior: 'auto' });
  await new Promise(resolve => setTimeout(resolve, 200));

  // 再次滾動到底部
  for (let i = 1; i <= steps; i++) {
    window.scrollTo({ top: stepSize * i, behavior: 'auto' });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await new Promise(resolve => setTimeout(resolve, 300));

  // 恢復原始滾動位置
  window.scrollTo({ top: originalScrollY, behavior: 'auto' });
}

// 新增列印樣式最佳化
(function() {
  const oldStyle = document.getElementById('hackmd-pdf-exporter-styles');
  if (oldStyle) {
    oldStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'hackmd-pdf-exporter-styles';
  style.textContent = `
  @media print {
    /* 確保所有文字可以被選取 */
    * {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }

    /* 隱藏不需要列印的元素 */
    .ui-edit-area,
    .ui-toolbar,
    .navbar,
    nav,
    header,
    footer,
    .ui-toc,
    .ui-toc-dropdown,
    button,
    .ui-status-bar,
    .ui-resizable-handle,
    .ui-resizable-e,
    .ui-resizable-w,
    .gutter,
    .split-line,
    ::-webkit-scrollbar {
      display: none !important;
    }

    /* 移除所有邊框和右側藍線 */
    body,
    html,
    .ui-view-area,
    .markdown-body,
    #doc,
    .container,
    .container-fluid,
    main,
    article,
    section,
    div {
      border: none !important;
      border-right: none !important;
      border-left: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    /* 移除可能的分隔線 */
    .ui-view-area::before,
    .ui-view-area::after,
    .markdown-body::before,
    .markdown-body::after,
    body::before,
    body::after {
      display: none !important;
      content: none !important;
    }

    /* 最佳化列印區域 */
    .ui-view-area,
    .markdown-body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 20px !important;
    }

    /* 連結樣式 - 藍色並加底線 */
    a,
    a:link,
    a:visited,
    a:hover,
    a:active,
    * a,
    * a:link,
    * a:visited,
    .ui-view-area a,
    .ui-view-area a:link,
    .ui-view-area a:visited,
    .markdown-body a,
    .markdown-body a:link,
    .markdown-body a:visited,
    #doc a,
    p a,
    li a,
    div a,
    span a {
      color: #0000FF !important;
      text-decoration: underline !important;
      text-decoration-color: #0000FF !important;
      -webkit-text-fill-color: #0000FF !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* 移除所有可能的 :after 偽元素 */
    * a:after,
    * a::after,
    * a[href]:after,
    * a[href]::after,
    .ui-view-area a:after,
    .ui-view-area a::after,
    .markdown-body a:after,
    .markdown-body a::after,
    p a:after,
    p a::after,
    li a:after,
    li a::after,
    div a:after,
    div a::after {
      content: none !important;
      content: "" !important;
      display: none !important;
      visibility: hidden !important;
    }

    /* 確保程式碼區塊不會被截斷，並保留高亮顏色 */
    pre, code {
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* 強制保留程式碼區塊背景色 */
    pre,
    pre code,
    .hljs,
    code[class*="language-"],
    pre[class*="language-"] {
      background: #f6f8fa !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* 保留所有程式碼高亮顏色 - highlight.js */
    .hljs-keyword { color: #d73a49 !important; }

    /* Prism.js 語法高亮 */
    .token.keyword { color: #d73a49 !important; }
    .token.builtin { color: #6f42c1 !important; }
    .token.class-name { color: #6f42c1 !important; }
    .token.function { color: #6f42c1 !important; }
    .token.boolean { color: #005cc5 !important; }
    .token.number { color: #005cc5 !important; }
    .token.string { color: #032f62 !important; }
    .token.char { color: #032f62 !important; }
    .token.operator { color: #d73a49 !important; }
    .token.punctuation { color: #24292e !important; }
    .token.comment { color: #6a737d !important; }
    .token.prolog { color: #6a737d !important; }
    .token.doctype { color: #6a737d !important; }
    .token.cdata { color: #6a737d !important; }
    .token.property { color: #005cc5 !important; }
    .token.tag { color: #22863a !important; }
    .token.attr-name { color: #6f42c1 !important; }
    .token.attr-value { color: #032f62 !important; }
    .token.namespace { color: #6f42c1 !important; }
    .token.constant { color: #005cc5 !important; }
    .token.symbol { color: #005cc5 !important; }
    .token.selector { color: #22863a !important; }
    .token.regex { color: #032f62 !important; }
    .token.atrule { color: #d73a49 !important; }
    .token.url { color: #032f62 !important; }
    .token.variable { color: #e36209 !important; }
    .token.annotation { color: #6f42c1 !important; }
    .hljs-built_in { color: #6f42c1 !important; }
    .hljs-type { color: #6f42c1 !important; }
    .hljs-literal { color: #005cc5 !important; }
    .hljs-number { color: #005cc5 !important; }
    .hljs-operator { color: #d73a49 !important; }
    .hljs-punctuation { color: #24292e !important; }
    .hljs-property { color: #005cc5 !important; }
    .hljs-regexp { color: #032f62 !important; }
    .hljs-string { color: #032f62 !important; }
    .hljs-char { color: #032f62 !important; }
    .hljs-subst { color: #24292e !important; }
    .hljs-symbol { color: #005cc5 !important; }
    .hljs-class { color: #6f42c1 !important; }
    .hljs-function { color: #6f42c1 !important; }
    .hljs-variable { color: #e36209 !important; }
    .hljs-title { color: #6f42c1 !important; }
    .hljs-title.function_ { color: #6f42c1 !important; }
    .hljs-title.class_ { color: #6f42c1 !important; }
    .hljs-params { color: #24292e !important; }
    .hljs-comment { color: #6a737d !important; }
    .hljs-doctag { color: #d73a49 !important; }
    .hljs-meta { color: #6a737d !important; }
    .hljs-section { color: #005cc5 !important; }
    .hljs-tag { color: #22863a !important; }
    .hljs-name { color: #22863a !important; }
    .hljs-attr { color: #6f42c1 !important; }
    .hljs-attribute { color: #005cc5 !important; }
    .hljs-selector-tag { color: #22863a !important; }
    .hljs-selector-id { color: #6f42c1 !important; }
    .hljs-selector-class { color: #6f42c1 !important; }
    .hljs-selector-attr { color: #6f42c1 !important; }
    .hljs-selector-pseudo { color: #6f42c1 !important; }
    .hljs-addition { color: #22863a !important; background-color: #f0fff4 !important; }
    .hljs-deletion { color: #b31d28 !important; background-color: #ffeef0 !important; }
    .hljs-link { color: #032f62 !important; }
    .hljs-formula { color: #6f42c1 !important; }

    /* 確保所有 hljs 和 token 子元素保留顏色 */
    pre code *,
    .hljs *,
    span[class^="hljs-"],
    span[class*=" hljs-"],
    span[class*="token"],
    .token {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* 最佳化表格列印 */
    table {
      page-break-inside: avoid;
    }

    /* 避免標題在頁面底部斷開 */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }

    /* 確保圖片不會溢出 */
    img {
      max-width: 100% !important;
      page-break-inside: avoid;
    }

    /* 確保 MathJax/KaTeX 數學公式正常顯示 */
    .MathJax,
    .MathJax_Display,
    .MathJax_SVG,
    .MathJax_SVG_Display,
    .katex,
    .katex-display,
    .katex-html,
    mjx-container,
    mjx-math {
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
      page-break-inside: avoid;
    }

    /* 確保行內數學公式正確對齊 */
    .MathJax,
    .katex {
      vertical-align: middle !important;
    }

    /* 確保區塊數學公式置中顯示 */
    .MathJax_Display,
    .katex-display,
    mjx-container[display="true"] {
      display: block !important;
      text-align: center !important;
      margin: 1em 0 !important;
    }

    /* 確保 SVG 數學公式正確顯示 */
    .MathJax_SVG svg,
    .katex svg {
      display: inline-block !important;
      max-width: 100% !important;
    }
  }
`;
  document.head.appendChild(style);
})();

} // 結束防止重複載入的檢查
