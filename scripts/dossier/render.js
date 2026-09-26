// html -> pdf через Chromium: номера страниц, закладки по заголовкам.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const [src, out] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: undefined });
  const page = await browser.newPage();
  await page.goto('file://' + src, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
    outline: true, tagged: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-family:DejaVu Sans,sans-serif;font-size:7.5pt;color:#888;' +
      'padding:0 19mm;display:flex;justify-content:space-between;">' +
      '<span>Когнитивная система: схемы, функции, инструменты · ред. 6</span>' +
      '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  await browser.close();
})();
