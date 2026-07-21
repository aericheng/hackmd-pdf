# HackMD PDF Exporter

A free Chrome extension for exporting HackMD notes to PDF.

## Features

- Free, no subscription required
- Simple, one-click interface
- Preserves document formatting and styling
- **Automatically waits for LaTeX/MathJax math to finish rendering** (tested with 844+ formulas in one document)
- **Optimized font size** for a better reading experience
- Fully preserves link text and styling
- Supports syntax-highlighted code blocks, tables, and images
- Chinese (and other) text in the exported PDF stays selectable and copyable

## Installation

### Load unpacked (developer mode)

1. Download or clone this repository locally.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked".
5. Select this repository's folder.
6. The extension is installed.

**Note**: this extension doesn't ship a custom icon, so Chrome shows its default puzzle-piece icon — that doesn't affect functionality.

## Project structure

```
manifest.json    Manifest V3 config: popup entry point, content script injected on hackmd.io/*.hackmd.io
content.js        injected into the HackMD page: scrolls to trigger lazy-loaded content, detects
                   MathJax v2/v3 & KaTeX render completion, applies @media print CSS, triggers
                   window.print()
popup.html/js      toolbar popup UI; sends the "export" message to content.js
popup.css          popup styling
```

## Usage

1. Open any HackMD note page in Chrome.
2. Click the extension icon in the toolbar.
3. Click the "Export to PDF" button.
4. The browser's print dialog opens.
5. Choose "Save as PDF" or your PDF printer.
6. Click "Save" to download the PDF.

## Tips

- Export from **view mode** (not edit mode) for best results.
- You can preview the print layout before exporting.
- Long documents are paginated automatically.
- Code blocks and tables try to avoid breaking across a page boundary.

## Supported sites

- hackmd.io
- *.hackmd.io (all HackMD subdomains)

## How it works

- Built as a Chrome Extension Manifest V3.
- Generates the PDF via the browser's native `window.print()` API.
- Uses `@media print` CSS to optimize the print layout.
- Auto-scrolls the page to trigger lazy-loading and ensure all LaTeX/MathJax formulas render.
- Detects math-rendering completion for both MathJax (v2/v3) and KaTeX.
- The content script and popup communicate via message passing.

## FAQ

### Q: Nothing happens when I click the button?
A: Make sure you're on an actual HackMD note page, not the HackMD homepage or another page.

### Q: The exported PDF doesn't look right?
A: Try exporting from view mode and make sure the page has fully loaded. You can also adjust margins etc. in the print dialog.

### Q: Are the hyperlinks in the PDF clickable?
A: No — since this relies on the browser's native print function, links in the PDF aren't clickable. They're shown as blue underlined text so you can still see the link text and copy it manually. This is the best trade-off while guaranteeing correct LaTeX rendering and selectable text.

## License

MIT License

## Contributing

Issues and pull requests are welcome!

## Disclaimer

This extension is for learning and personal use only. Please respect HackMD's terms of service and copyright.
