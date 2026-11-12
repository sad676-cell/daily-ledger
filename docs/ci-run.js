const { chromium } = require('C:/Users/\u674e\u5bb6\u5f3a/.dsh/profiles/desktop/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto('https://github.com/sad676-cell/daily-ledger/actions/runs/43168466511', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(6000);

  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => /^Summary$/.test(l));
  console.log(lines.slice(Math.max(0, start)).slice(0, 45).join('\n'));
  console.log('--- annotations ---');
  const ai = lines.findIndex((l) => /Annotations/i.test(l));
  if (ai >= 0) console.log(lines.slice(ai, ai + 12).join('\n'));
  await browser.close();
})();
