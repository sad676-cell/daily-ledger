const { chromium } = require('C:/Users/\u674e\u5bb6\u5f3a/.dsh/profiles/desktop/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('https://github.com/sad676-cell/daily-ledger/actions', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(6000);

  // 逐条读出 run 行：标题、分支、耗时、状态
  const rows = await page.evaluate(() => {
    const out = [];
    const links = [...document.querySelectorAll('a[href*="/actions/runs/"]')];
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const row = a.closest('li') || a.parentElement?.parentElement;
      const txt = (row?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim();
      if (txt) out.push(href + ' :: ' + txt.slice(0, 200));
    }
    return [...new Set(out)];
  });
  console.log(rows.slice(0, 6).join('\n---\n'));
  await browser.close();
})();
