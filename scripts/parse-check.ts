/**
 * 解析层的离线自检。
 *
 * 输入是「假的光学识别结果」——把三张真实截图里的文字按视觉行打出来，
 * 包括Vision 可能输出的两种排版（名称/金额同行、被拆成两行）。
 * 跑法：npm run check:parse
 */
import { parseBill } from '../src/import/parse';
import { boxesToLines } from '../src/ocr/lines';

const TODAY = '2026-11-13';

const CART_MERGED = [
  '美团点餐 提供服务 >',
  '已选5件商品',
  '清空',
  '精品羊肉卷 ¥26 − 1 +',
  '手切鲜羊肉 ¥26 − 1 +',
  '重庆番茄鸳鸯锅 ¥38 − 1 +',
  '调料 ¥10 − 2 +',
  '已点5件菜品',
  '扫码结账',
];

const CART_SPLIT = [
  '已选5件商品',
  '精品羊肉卷',
  '¥26',
  '− 1 +',
  '手切鲜羊肉',
  '¥26',
  '− 1 +',
  '重庆番茄鸳鸯锅',
  '¥38',
  '− 1 +',
  '调料',
  '¥10',
  '− 2 +',
];

const LEDGER = [
  '11月11日 星期三 支出: 45',
  '购物 -30',
  '餐饮 -15',
  '11月10日 星期二 支出: 40',
  '餐饮 -11',
  '餐饮 -14',
  '餐饮 -15',
  '11月09日 星期一 支出: 31',
  '餐饮 -31',
  '11月08日 星期日 支出: 30',
  '餐饮 -30',
];

const PAYMENT = [
  '支付成功',
  '付款给 星巴克',
  '¥36.00',
  '实付 ¥36.00',
  '2026年11月11日 09:12:33',
];

let failed = 0;

function check(name: string, ok: boolean, detail: string) {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} → ${detail}`);
  }
}

function sum(result: { entries: Array<{ amount: number }> }): number {
  return Math.round(result.entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

console.log('\n[1] 点餐车（名称与金额同一行）');
{
  const r = parseBill(CART_MERGED, { today: TODAY });
  check('识别为 cart', r.source === 'cart', r.source);
  check('只要 1 笔', r.entries.length === 1, `${r.entries.length} 笔`);
  check('金额 110', sum(r) === 110, String(sum(r)));
  check('归到餐饮', r.entries[0]?.categoryId === 'food', r.entries[0]?.categoryId ?? 'none');
  check('推荐区的 ¥28 没被算进去', sum(r) !== 194, String(sum(r)));
  console.log('     warnings:', r.warnings);
}

console.log('\n[2] 点餐车（名称/单价/数量被拆成三行）');
{
  const r = parseBill(CART_SPLIT, { today: TODAY });
  check('金额仍是 110', sum(r) === 110, String(sum(r)));
  check('1 笔', r.entries.length === 1, `${r.entries.length} 笔`);
}

console.log('\n[3] 账本流水（日期是分组标题，向下继承）');
{
  const r = parseBill(LEDGER, { today: TODAY });
  check('识别为 ledger', r.source === 'ledger', r.source);
  check('7 笔', r.entries.length === 7, `${r.entries.length} 笔`);
  check('合计 146', sum(r) === 146, String(sum(r)));

  const byDate = new Map<string, number>();
  for (const e of r.entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + 1);
  check('11/11 两笔', byDate.get('2026-11-11') === 2, String(byDate.get('2026-11-11')));
  check('11/10 三笔', byDate.get('2026-11-10') === 3, String(byDate.get('2026-11-10')));
  check('11/09 一笔', byDate.get('2026-11-09') === 1, String(byDate.get('2026-11-09')));
  check('11/08 一笔', byDate.get('2026-11-08') === 1, String(byDate.get('2026-11-08')));
  check('购物分类正确', r.entries[0]?.categoryId === 'shopping', r.entries[0]?.categoryId ?? 'none');
  check('没有出现汇总对不上的告警', !r.warnings.some((w) => w.includes('明细合计')), r.warnings.join(' | '));
  console.log('     warnings:', r.warnings);
}

console.log('\n[4] 账本流水（汇总故意写错，应该被抓出来）');
{
  const broken = LEDGER.map((l) => l.replace('支出: 45', '支出: 55'));
  const r = parseBill(broken, { today: TODAY });
  check('能发现明细与汇总不一致', r.warnings.some((w) => w.includes('明细合计')), r.warnings.join(' | '));
}

console.log('\n[5] 支付成功页（直接抄实付）');
{
  const r = parseBill(PAYMENT, { today: TODAY });
  check('识别为 payment', r.source === 'payment', r.source);
  check('1 笔 36 元', r.entries.length === 1 && sum(r) === 36, String(sum(r)));
  check('日期取图里的 2026-11-11', r.entries[0]?.date === '2026-11-11', r.entries[0]?.date ?? 'none');
  check('星巴克 → 餐饮', r.entries[0]?.categoryId === 'food', r.entries[0]?.categoryId ?? 'none');
}

console.log('\n[6] 无年份的日期（靠星期几校验年份）');
{
  const r = parseBill(['11月11日 星期三', '餐饮 -15'], { today: TODAY });
  check('推成 2026-11-11', r.entries[0]?.date === '2026-11-11', r.entries[0]?.date ?? 'none');
  const wrongWeekday = parseBill(['11月11日 星期五', '餐饮 -15'], { today: TODAY });
  check('星期对不上时给告警', wrongWeekday.warnings.some((w) => w.includes('星期')), wrongWeekday.warnings.join(' | '));
}

console.log('\n[7] 空输入 / 无关文字');
{
  const r = parseBill(['今天天气不错', '没有金额也没有日期']);
  check('识别为 unknown', r.source === 'unknown', r.source);
  check('0 笔', r.entries.length === 0, `${r.entries.length} 笔`);
}

console.log('\n[8] 认不出分类时默认「餐饮」');
{
  const r = parseBill(['11月11日 星期三', '老王 -22'], { today: TODAY });
  check('默认落到餐饮', r.entries[0]?.categoryId === 'food', r.entries[0]?.categoryId ?? 'none');
  check('给一句提示', r.warnings.some((w) => w.includes('餐饮')), r.warnings.join(' | '));

  const inc = parseBill(['11月11日 星期三', '退款 +50'], { today: TODAY });
  check('收入仍然落到「其他」', inc.entries[0]?.categoryId === 'other-in', inc.entries[0]?.categoryId ?? 'none');
  check('收入类型没被判错', inc.entries[0]?.kind === 'income', inc.entries[0]?.kind ?? 'none');
}

console.log('\n[9] 把 Vision 的零散识别结果拼回行（原生 OCR 的出口）');
{
  const H = 26;
  const box = (text: string, x: number, y: number, width: number) => ({
    text,
    x,
    y,
    width,
    height: H,
    confidence: 0.9,
  });
  // Vision 不保证返回阅读顺序，这里故意打乱
  const boxes = [
    box('-30', 660, 360, 50),
    box('支出: 45', 620, 300, 100),
    box('餐饮', 100, 410, 48),
    box('星期三', 180, 300, 70),
    box('11月11日', 40, 300, 120),
    box('购物', 100, 360, 48),
    box('-15', 660, 410, 50),
  ];
  const lines = boxesToLines(boxes);
  console.log('     lines:', lines);
  check('日期与星期拼成一行', lines[0] === '11月11日 星期三 支出: 45', JSON.stringify(lines[0]));
  check('分类与金额拼成一行', lines[1] === '购物 -30', JSON.stringify(lines[1]));
  check('一共 3 行', lines.length === 3, String(lines.length));

  const r = parseBill(lines, { today: TODAY });
  check('拼出的行能直接解析', r.source === 'ledger', r.source);
  check('2 笔', r.entries.length === 2, `${r.entries.length} 笔`);
  check('合计 45，与图上的日汇总一致', sum(r) === 45, String(sum(r)));
  check('没有汇总不符的告警', !r.warnings.some((w) => w.includes('明细合计')), r.warnings.join(' | '));

  const tight = boxesToLines([box('-', 660, 500, 10), box('30', 670, 500, 24)]);
  check('紧邻的两段不补空格', tight[0] === '-30', JSON.stringify(tight[0]));
}

console.log(failed === 0 ? '\n全部通过\n' : `\n${failed} 项未通过\n`);
