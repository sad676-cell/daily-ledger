import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Entry, categoryOf } from './types';
import { dayLabel, formatAmount, monthLabel, todayISO } from './money';
import { palette } from './theme';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Row = { name: string; amount: number; share: number };

function categoryRows(entries: Entry[]): { total: number; rows: Row[] } {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== 'expense') continue;
    map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  const rows = [...map.entries()]
    .map(([id, amount]) => ({
      name: categoryOf(id).name,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { total, rows };
}

/** 生成一个和 App 同款「纸质账簿」风格的 A4 页面。 */
export function buildMonthHtml(all: Entry[], month: string): string {
  const monthEntries = all.filter((e) => e.date.startsWith(month));
  const expenses = monthEntries.filter((e) => e.kind === 'expense');
  const incomes = monthEntries.filter((e) => e.kind === 'income');
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const incomeTotal = incomes.reduce((s, e) => s + e.amount, 0);
  const balance = incomeTotal - expenseTotal;
  const { rows } = categoryRows(monthEntries);

  const byDay = new Map<string, Entry[]>();
  for (const e of monthEntries) {
    const list = byDay.get(e.date);
    if (list) list.push(e);
    else byDay.set(e.date, [e]);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const categoriesHtml = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td class="cat">${esc(r.name)}</td>
        <td class="num">${formatAmount(r.amount)}</td>
        <td class="pct">${Math.max(1, Math.round(r.share * 100))}%</td>
        <td class="barcell"><div class="bar"><i style="width:${Math.max(r.share * 100, 1.5)}%"></i></div></td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">本月没有支出记录</td></tr>`;

  const detailHtml = days.length
    ? days
        .map(([date, list]) => {
          const dayExpense = list.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
          const rowsHtml = list
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((e) => {
              const cat = categoryOf(e.categoryId);
              const note = [e.note, e.expr].filter(Boolean).join(' · ');
              return `
          <tr>
            <td class="cat">${esc(cat.name)}${note ? `<span class="note">${esc(note)}</span>` : ''}</td>
            <td class="num ${e.kind === 'income' ? 'income' : ''}">${e.kind === 'income' ? '+' : '−'}${formatAmount(e.amount)}</td>
          </tr>`;
            })
            .join('');
          return `
        <tr class="dayhead">
          <td>${esc(dayLabel(date))}</td>
          <td class="num">支出 ${formatAmount(dayExpense)}</td>
        </tr>
        ${rowsHtml}`;
        })
        .join('')
    : `<tr><td colspan="2" class="empty">本月还没有记账</td></tr>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    color: ${palette.ink};
    background: ${palette.paper};
    font-size: 12px;
    line-height: 1.5;
  }
  .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
  .brand { font-size: 11px; letter-spacing: 1px; color: ${palette.ink3}; }
  .month { font-size: 20px; font-weight: 600; }
  .summary { display: flex; gap: 24px; padding: 16px 18px; border: 0.5px solid ${palette.hair}; border-radius: 14px; background: ${palette.surface}; margin-bottom: 26px; }
  .summary div { flex: 1; }
  .label { font-size: 10px; letter-spacing: 0.6px; color: ${palette.ink3}; margin-bottom: 4px; }
  .big { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .mid { font-size: 15px; font-variant-numeric: tabular-nums; }
  h2 { font-size: 11px; letter-spacing: 1px; color: ${palette.ink3}; font-weight: 600; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { padding: 7px 0; vertical-align: bottom; border-bottom: 0.5px solid ${palette.hair}; overflow: hidden; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .note { color: ${palette.ink3}; margin-left: 8px; }
  .cats .cat { width: 34%; }
  .cats .num { width: 26%; }
  .cats .pct { width: 12%; text-align: right; color: ${palette.ink3}; }
  .cats .barcell { width: 28%; padding-left: 12px; }
  .detail .cat { width: 68%; }
  .detail .num { width: 32%; }
  .bar { height: 5px; border-radius: 3px; background: ${palette.hairSoft}; overflow: hidden; }
  .bar i { display: block; height: 100%; background: ${palette.accent}; }
  .dayhead td { padding-top: 18px; border-bottom: 0.5px solid ${palette.hair}; color: ${palette.ink2}; font-size: 11px; }
  .income { color: ${palette.income}; }
  .empty { color: ${palette.ink3}; text-align: center; padding: 22px 0; }
  .foot { margin-top: 26px; font-size: 9px; color: ${palette.ink3}; display: flex; justify-content: space-between; }
  .section { margin-bottom: 26px; }
  /* 浏览器预览时模拟 A4 版心，和真实打印一致 */
  @media screen {
    html { background: #e6e2d8; }
    body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 16mm; }
  }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">账 本</div>
      <div class="month">${esc(monthLabel(month))}</div>
    </div>
    <div class="brand">共 ${monthEntries.length} 笔</div>
  </div>

  <div class="summary">
    <div>
      <div class="label">支出</div>
      <div class="big">¥ ${formatAmount(expenseTotal)}</div>
    </div>
    <div>
      <div class="label">收入</div>
      <div class="big">¥ ${formatAmount(incomeTotal)}</div>
    </div>
    <div>
      <div class="label">结余</div>
      <div class="big">¥ ${formatAmount(balance)}</div>
    </div>
  </div>

  <div class="section">
    <h2>支出构成</h2>
    <table class="cats">${categoriesHtml}</table>
  </div>

  <div class="section">
    <h2>明细</h2>
    <table class="detail">${detailHtml}</table>
  </div>

  <div class="foot">
    <span>账本 · 本地记账</span>
    <span>导出时间 ${todayISO()}</span>
  </div>
</body>
</html>`;
}

export type ExportResult = 'shared' | 'unsupported' | 'failed';

/** 生成 PDF 并调起系统分享（存到「文件」、发微信、打印都行）。 */
export async function exportMonthPdf(all: Entry[], month: string): Promise<ExportResult> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const html = buildMonthHtml(all, month);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: '导出账本 PDF',
        UTI: 'com.adobe.pdf',
      });
      return 'shared';
    }
    return 'shared';
  } catch {
    return 'failed';
  }
}
