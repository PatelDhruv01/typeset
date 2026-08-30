const fs = require('fs');
const marked = require('marked');
const puppeteer = require('puppeteer');
const highlight = require('highlight.js');

// 1. Configure the Markdown Parser
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && highlight.getLanguage(lang)) {
      return highlight.highlight(code, { language: lang }).value;
    }
    return highlight.highlightAuto(code).value;
  },
  gfm: true, // GitHub Flavored Markdown (tables, task lists)
  breaks: true // Respect line breaks
});

async function convertMdToPdf(mdFilePath, pdfOutputPath) {
  // 2. Read the Markdown file
  const markdownText = fs.readFileSync(mdFilePath, 'utf8');
  const htmlContent = marked.parse(markdownText);

  // 3. The "Secret Sauce" Print CSS
  // This CSS forces the PDF to look like a professional document, not a printed web page.
  const template = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <!-- Using Atom One Light theme for code blocks - very clean for PDFs -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
      
      :root {
        --text-color: #1f2328;
        --bg-color: #ffffff;
        --border-color: #d0d7de;
        --link-color: #0969da;
        --code-bg: #f6f8fa;
        --quote-border: #d0d7de;
      }

      body {
        font-family: 'Inter', -apple-system, sans-serif;
        line-height: 1.65;
        color: var(--text-color);
        max-width: 100%;
        margin: 0;
        padding: 0;
        font-size: 11pt; /* Print-optimized base size */
      }

      @page {
        margin: 25mm 20mm; /* Added slightly more top/bottom breathing room */
      }

      /* Typography & Spacing */
      h1, h2, h3, h4, h5 {
        font-weight: 600;
        line-height: 1.25;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        page-break-after: avoid;
        break-after: avoid;
      }

      h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-color); }
      h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-color); }
      h3 { font-size: 1.25em; }

      p, ul, ol, pre, table, blockquote {
        margin-top: 0;
        margin-bottom: 16px;
      }

      a {
        color: var(--link-color);
        text-decoration: none;
      }

      /* Blockquotes */
      blockquote {
        padding: 0 1em;
        color: #57606a;
        border-left: 0.25em solid var(--quote-border);
        page-break-inside: avoid;
        break-inside: avoid;
        font-style: italic;
        background: #fafbfc;
        padding-top: 8px;
        padding-bottom: 8px;
      }

      /* Code Blocks */
      pre {
        background-color: var(--code-bg);
        border-radius: 6px;
        padding: 16px;
        font-family: 'Fira Code', monospace;
        font-size: 9pt;
        line-height: 1.45;
        white-space: pre-wrap; /* Forces code to wrap */
        word-wrap: break-word;
        page-break-inside: avoid;
        break-inside: avoid;
        border: 1px solid var(--border-color);
      }

      /* Inline Code */
      code {
        font-family: 'Fira Code', monospace;
        font-size: 90%;
        background-color: rgba(175, 184, 193, 0.2);
        padding: 0.2em 0.4em;
        border-radius: 4px;
      }
      
      /* Reset background for code inside pre blocks */
      pre > code {
        background-color: transparent;
        padding: 0;
      }

      /* Tables */
      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      table th, table td {
        padding: 8px 13px;
        border: 1px solid var(--border-color);
      }

      table tr {
        background-color: var(--bg-color);
        border-top: 1px solid var(--border-color);
      }

      table tr:nth-child(2n) {
        background-color: var(--code-bg); /* Zebra striping */
      }

      table th {
        font-weight: 600;
        background-color: #f1f3f5; /* Distinct header color */
      }

      table thead {
        display: table-header-group;
      }

      /* Images */
      img {
        max-width: 100%;
        height: auto;
        display: block; /* Centers the image */
        margin: 16px auto;
        border-radius: 6px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      /* Markdown Task Lists */
      input[type="checkbox"] {
        margin-right: 8px;
      }
      li.task-list-item {
        list-style-type: none;
      }
    </style>
  </head>
  <body>
    ${htmlContent}
  </body>
  </html>
  `;

  // 4. Spin up the Headless Browser
  console.log('Spinning up Chromium...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Load the HTML into the browser
  await page.setContent(template, { waitUntil: 'networkidle0' });

  // 5. Export to PDF
  console.log('Generating PDF...');
  await page.pdf({
    path: pdfOutputPath,
    format: 'A4',
    printBackground: true, // Ensures code block backgrounds render
    displayHeaderFooter: true,
    headerTemplate: '<div></div>', // Add custom headers later if needed
    footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: right; padding-right: 20mm;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });

  await browser.close();
  console.log(`Success! PDF saved to ${pdfOutputPath}`);
}

// Run it
convertMdToPdf('./test.md', './output.pdf').catch(console.error);