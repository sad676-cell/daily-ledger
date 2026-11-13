import { INCOME_CATEGORIES } from '../types';
import type { Kind } from '../types';
import { todayISO, parseISO } from '../money';

/**
 * 把「从截图里读出来的文字」解析成可以直接入账的条目。
 *
 * 这一层刻意不依赖任何图片/原生能力：输入永远是「一行一段文字」，
 * 这样纯 JS 就能测，将来换成 Vision 或剪贴板，只换输入源，不动这里。
 *
 * 能处理的三类图：
 *   payment —— 支付成功页 / 账单详情：直接抄「实付」
 *   cart    —— 点餐车 / 购物车：单价 × 数量求和
 *   ledger  —— 账本流水截图：日期是分组标题，向下继承，多笔
 */

export type ParsedEntry = {
  date: string;
  kind: Kind;
  amount: number;
  categoryId: string;
  note: string;
};

export type BillSource = 'payment' | 'cart' | 'ledger' | 'unknown';

export type ParseResult = {
  source: BillSource;
  entries: ParsedEntry[];
  warnings: string[];
};

type MoneyToken = { value: number; negative: boolean; explicitSign: boolean };

/* ---------------- 规范化 ---------------- */

const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'];

/** 全角数字/标点、各种减号、千分位空格，统一成半角；这一步不做，后面正则全是窟窿。 */
export function normalizeLine(raw: string): string {
  return raw
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[¥￥]/g, '¥')
    .replace(/[－−–—﹣]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[：]/g, ':')
    .replace(/[．。]/g, '.')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toLines(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/\r?\n/);
  return raw.map(normalizeLine).filter((line) => line.length > 0);
}

/* ---------------- 日期 ---------------- */

type DateHit = { month: number; day: number; year?: number; weekday?: number };

const WEEKDAY_RE = /(?:星期|周)([一二三四五六日天])/;

function weekdayOf(line: string): number | undefined {
  const m = line.match(WEEKDAY_RE);
  if (!m) return undefined;
  const ch = m[1] === '天' ? '日' : m[1];
  const idx = WEEKDAY_CHARS.indexOf(ch);
  return idx === -1 ? undefined : idx;
}

/** 日期可能是 `11月11日`、`2026-11-11`、`11/11`，也可能带星期。 */
function matchDate(line: string): DateHit | null {
  let m = line.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/);
  if (m) {
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year: Number(m[1]), month, day, weekday: weekdayOf(line) };
    }
  }
  m = line.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day, weekday: weekdayOf(line) };
    }
  }
  m = line.match(/^(\d{1,2})\/(\d{1,2})(?:\s|$)/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day, weekday: weekdayOf(line) };
    }
  }
  return null;
}

/**
 * 推断年份。图里通常只有「11月11日」，没有年。
 * 规则：默认今年；算出来是未来日期就往回退一年；图里有星期几就用它当校验位再修正一次。
 */
function resolveDate(hit: DateHit, today: string, warnings: string[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const build = (year: number) => `${year}-${pad(hit.month)}-${pad(hit.day)}`;

  if (hit.year) {
    const iso = build(hit.year);
    if (hit.weekday !== undefined && parseISO(iso).getDay() !== hit.weekday) {
      warnings.push(`${hit.month}月${hit.day}日 与图上「星期${WEEKDAY_CHARS[hit.weekday]}」对不上，日期可能有误`);
    }
    return iso;
  }

  const thisYear = Number(today.slice(0, 4));
  let year = thisYear;
  if (build(year) > today) year -= 1;

  if (hit.weekday !== undefined && parseISO(build(year)).getDay() !== hit.weekday) {
    // 星期对不上，多半是跨年了；再退一年试试
    if (parseISO(build(year - 1)).getDay() === hit.weekday) year -= 1;
    else warnings.push(`${hit.month}月${hit.day}日 的星期几对不上，年份按 ${year} 处理`);
  }
  return build(year);
}

/* ---------------- 金额 ---------------- */

/** 先抹掉日期/时间，否则 `2026-11-11` 里的 `-11` 会被当成金额。 */
const DATE_NOISE_RE =
  /(\d{4}\s*[年\-/.]\s*\d{1,2}\s*[月\-/.]\s*\d{1,2}\s*日?)|(\d{1,2}\s*月\s*\d{1,2}\s*日)|(星期[一二三四五六日天])|(周[一二三四五六日天])|(\d{1,2}:\d{2}(?::\d{2})?)/g;

/**
 * 只认「像金额」的数字：带 ¥、带正负号、或带两位小数。
 * 这样「已选5件」「10:02」「93%」「星期三」都不会被误当成钱。
 */
function moneyTokens(line: string): MoneyToken[] {
  const cleaned = line.replace(DATE_NOISE_RE, ' ');
  const out: MoneyToken[] = [];
  const re = /(¥\s*)?([+\-]\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const yen = Boolean(m[1]);
    const sign = m[2] ? m[2].replace(/\s/g, '') : '';
    const digits = m[3];
    const hasCents = /\.\d{2}$/.test(digits);
    if (!yen && !sign && !hasCents) continue;
    const value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value) || value === 0) continue;
    out.push({ value, negative: sign === '-', explicitSign: sign.length > 0 });
  }
  return out;
}

/* ---------------- 分类 ---------------- */

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/餐饮|外卖|美团|饿了么|饭店|火锅|咖啡|星巴克|瑞幸|奶茶|麦当劳|肯德基|烧烤|食堂|面馆|快餐/, 'food'],
  [/买菜|超市|菜市场|生鲜|水果|菜场/, 'market'],
  [/交通|地铁|公交|打车|滴滴|高铁|火车|加油|停车|出租车/, 'transport'],
  [/购物|淘宝|京东|拼多多|商场|服饰|数码|天猫/, 'shopping'],
  [/居住|房租|水电|物业|燃气|宽带/, 'home'],
  [/娱乐|电影|游戏|演出|门票|健身/, 'fun'],
  [/医疗|医院|药店|挂号|体检/, 'health'],
  [/学习|书店|课程|学费|培训|文具/, 'study'],
  [/人情|礼物|礼金|请客/, 'social'],
];

const INCOME_IDS = new Set(INCOME_CATEGORIES.map((c) => c.id));

/** 认不出分类时落到「餐饮」：截图导入的场景绝大多数是吃喝，落到「其他」还得逐笔改 */
const FALLBACK_EXPENSE_ID = 'food';

/** 图上直接印着分类名时优先取它（账本截图最准），否则退回关键词表。 */
function guessCategory(text: string, kind: Kind, warnings: { unknown: number }): string {
  const pool = kind === 'income' ? INCOME_CATEGORIES : null;
  for (const category of pool ?? []) {
    if (text.includes(category.name)) return category.id;
  }
  for (const [re, id] of CATEGORY_KEYWORDS) {
    if (re.test(text)) return id;
  }
  if (/工资|薪|奖金|兼职|报销|入账/.test(text)) return 'salary';
  warnings.unknown += 1;
  return kind === 'income' ? 'other-in' : FALLBACK_EXPENSE_ID;
}

/* ---------------- 结构识别 ---------------- */

const PAYMENT_HINT = /实付|实收|付款成功|支付成功|交易成功|交易金额/;
const CART_HINT = /已选\s*\d+\s*件|购物车|去结算|加入购物车/;
const SUMMARY_RE = /(支出|收入|合计|总计|小计|共计)\s*:?\s*¥?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

function detectSource(lines: string[]): BillSource {
  if (lines.some((l) => PAYMENT_HINT.test(l))) return 'payment';
  if (lines.some((l) => CART_HINT.test(l))) return 'cart';
  if (lines.some((l) => matchDate(l))) return 'ledger';
  return lines.some((l) => moneyTokens(l).length > 0) ? 'ledger' : 'unknown';
}

function stripLine(line: string): string {
  return line
    .replace(DATE_NOISE_RE, ' ')
    .replace(/¥/g, ' ')
    .replace(/[+\-]?\d[\d,]*(?:\.\d{1,2})?/g, ' ')
    .replace(/[·•|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------------- 三类解析 ---------------- */

function parsePayment(lines: string[], today: string, warnings: string[]): ParseResult {
  let date = today;
  let paid: number | null = null;
  let merchant = '';

  for (const line of lines) {
    const hit = matchDate(line);
    if (hit) {
      date = resolveDate(hit, today, warnings);
      continue;
    }
    if (paid === null && /实付|实收|交易金额|付款金额/.test(line)) {
      const tokens = moneyTokens(line);
      if (tokens.length) {
        paid = tokens[tokens.length - 1].value;
        continue;
      }
    }
    if (/付款给|收款方|商户|商家|收款人/.test(line)) {
      merchant = line.replace(/^(付款给|收款方|商户|商家|收款人)\s*:?\s*/, '').trim();
      continue;
    }
    if (!merchant && !PAYMENT_HINT.test(line) && /[\u4e00-\u9fa5]{2,}/.test(line)) {
      merchant = line;
    }
  }

  if (paid === null) {
    // 没有「实付」字样，退而求其次：取全图最大的那个金额（支付页通常只有它）
    const all = lines.flatMap((l) => moneyTokens(l));
    if (all.length) {
      paid = Math.max(...all.map((t) => t.value));
      warnings.push('没找到「实付」字样，按金额最大的一项估算');
    }
  }
  if (paid === null) return { source: 'payment', entries: [], warnings: ['没识别到金额'] };

  const unknown = { unknown: 0 };
  const categoryId = guessCategory(`${merchant} ${lines.join(' ')}`, 'expense', unknown);
  if (unknown.unknown) warnings.push('分类没认出来，已归入「餐饮」');

  const entries: ParsedEntry[] = [
    {
      date,
      kind: 'expense',
      amount: Math.round(paid * 100) / 100,
      categoryId,
      note: stripLine(merchant).slice(0, 20),
    },
  ];
  return { source: 'payment', entries, warnings };
}

function parseCart(lines: string[], today: string, warnings: string[]): ParseResult {
  // 「已选 5 件商品」是弹层标题，它上面是推荐区商品（那几个 ¥28），不能算进账单
  const startAt = lines.findIndex((l) => /已选\s*(\d+)\s*件/.test(l));
  const scope = startAt >= 0 ? lines.slice(startAt + 1) : lines;
  const declaredCount = startAt >= 0 ? Number(lines[startAt].match(/已选\s*(\d+)\s*件/)![1]) : null;

  let date = today;
  const rows: Array<{ text: string; price: number; qty?: number }> = [];
  const steppers: number[] = [];

  for (const line of scope) {
    const hit = matchDate(line);
    if (hit) {
      date = resolveDate(hit, today, warnings);
      continue;
    }
    if (/合计|总计|小计|共计|优惠|折扣|配送费|打包费|餐盒费|清空|扫码/.test(line)) continue;

    const stepper = line.match(/[-]\s*(\d{1,2})\s*\+/);
    if (stepper) steppers.push(Number(stepper[1]));

    // 步进器里的「1」不是价格，先从行里摘掉再找金额
    const tokens = moneyTokens(line.replace(/[-]\s*\d{1,2}\s*\+/g, ' '));
    if (!tokens.length) continue;

    const times = line.match(/[×xX*]\s*(\d{1,2})/);
    const qty = stepper ? Number(stepper[1]) : times ? Number(times[1]) : undefined;
    rows.push({ text: line, price: tokens[0].value, qty });
  }

  if (!rows.length) return { source: 'cart', entries: [], warnings: ['没识别到商品行'] };

  // 步进器和商品拆成两行时（光学识别常见），按出现顺序一一对应
  const useSteppers =
    rows.every((r) => r.qty === undefined) && steppers.length === rows.length;

  let count = 0;
  const items = rows.map((row, i) => {
    const qty = row.qty ?? (useSteppers ? steppers[i] : 1);
    count += qty;
    return {
      name: stripLine(row.text).slice(0, 12),
      qty,
      amount: Math.round(row.price * qty * 100) / 100,
    };
  });

  if (declaredCount !== null && count !== declaredCount) {
    warnings.push(`图上写「${declaredCount} 件」，按数量算出来 ${count} 件，请核对`);
  }

  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const unknown = { unknown: 0 };
  const firstName = items[0]?.name ?? '';

  // 一张点餐单就是一笔支出，不拆成四行去污染账本
  const entries: ParsedEntry[] = [
    {
      date,
      kind: 'expense',
      amount: total,
      // 分类看整段文字（含顶部「美团点餐」这类信息，商品名本身往往不含分类词）
      categoryId: guessCategory(lines.join(' '), 'expense', unknown),
      note: (items.length === 1 ? firstName : `${firstName}等${items.length}项`).slice(0, 20),
    },
  ];

  warnings.push(
    `图上没有合计，按 ${items.length} 项 ${count} 件求和得 ${total.toFixed(2)} 元，付款前请核对`,
  );
  return { source: 'cart', entries, warnings };
}

function parseLedger(lines: string[], today: string, warnings: string[]): ParseResult {
  const entries: ParsedEntry[] = [];
  const unknown = { unknown: 0 };
  /** 日期头 → 图上自报的当日支出，用来校验明细有没有漏读 */
  const declaredByDate = new Map<string, { expense?: number; income?: number }>();

  let currentDate: string | null = null;
  let dateMissing = 0;

  for (const line of lines) {
    const hit = matchDate(line);
    if (hit) {
      currentDate = resolveDate(hit, today, warnings);
      for (const m of line.matchAll(SUMMARY_RE)) {
        const label = m[1];
        const value = Number(m[2].replace(/,/g, ''));
        if (!Number.isFinite(value)) continue;
        const slot = declaredByDate.get(currentDate) ?? {};
        if (label === '收入') slot.income = (slot.income ?? 0) + value;
        else slot.expense = (slot.expense ?? 0) + value;
        declaredByDate.set(currentDate, slot);
      }
      continue;
    }

    const tokens = moneyTokens(line);
    if (!tokens.length) continue;
    // 「支出: 45」这种只有汇总，不是一笔记录
    if (/^(支出|收入|合计|总计|小计|共计)/.test(stripLine(line))) continue;

    const token = tokens[tokens.length - 1];
    if (!currentDate) dateMissing += 1;

    const text = stripLine(line);
    const incomeHint = /收入|入账|收到|退款/.test(line);
    const kind: Kind = token.negative ? 'expense' : incomeHint ? 'income' : 'expense';

    entries.push({
      date: currentDate ?? today,
      kind,
      amount: Math.round(token.value * 100) / 100,
      categoryId: guessCategory(text || line, kind, unknown),
      note: text.slice(0, 20),
    });
  }

  if (dateMissing) {
    warnings.push(`${dateMissing} 笔没找到所属日期，已记到今天`);
  }

  // 用图上自报的日汇总校验，对不上说明有漏读/误读，必须让用户过一眼
  for (const [date, declared] of declaredByDate) {
    const mine = entries.filter((e) => e.date === date);
    const expense = mine.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
    const income = mine.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
    if (declared.expense !== undefined && Math.abs(expense - declared.expense) > 0.01) {
      warnings.push(`${date} 明细合计 ${expense.toFixed(2)}，图上写支出 ${declared.expense.toFixed(2)}`);
    }
    if (declared.income !== undefined && Math.abs(income - declared.income) > 0.01) {
      warnings.push(`${date} 明细合计 ${income.toFixed(2)}，图上写收入 ${declared.income.toFixed(2)}`);
    }
  }

  if (unknown.unknown) {
    warnings.push(`${unknown.unknown} 笔没认出分类，支出已归入「餐饮」、收入已归入「其他」`);
  }
  if (!entries.length) warnings.push('没识别到任何一笔');

  return { source: 'ledger', entries, warnings };
}

/* ---------------- 入口 ---------------- */

/**
 * 光学识别经常把「分类名」和「-30」拆成两行（中间隔得远）。
 * 把「整行只有金额」的合并回上一行，后面所有解析都按「一行一笔」处理。
 */
function mergeRows(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const bare =
      moneyTokens(line).length > 0 &&
      stripLine(line).replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').length === 0;
    if (bare && prev && moneyTokens(prev).length === 0 && !matchDate(prev)) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

export function parseBill(input: string | string[], opts: { today?: string } = {}): ParseResult {
  const today = opts.today ?? todayISO();
  const lines = mergeRows(toLines(input));
  if (!lines.length) return { source: 'unknown', entries: [], warnings: ['没有可识别的文字'] };

  const warnings: string[] = [];
  const source = detectSource(lines);

  if (source === 'unknown') {
    return { source, entries: [], warnings: ['这段文字里没有金额，也没有日期'] };
  }
  const result =
    source === 'payment'
      ? parsePayment(lines, today, warnings)
      : source === 'cart'
        ? parseCart(lines, today, warnings)
        : parseLedger(lines, today, warnings);

  return { ...result, warnings };
}

/** 给界面用的一句话摘要。 */
export function describeResult(result: ParseResult): string {
  if (!result.entries.length) return '没识别到可入账的记录';
  const total = result.entries.reduce(
    (sum, e) => sum + (e.kind === 'expense' ? e.amount : -e.amount),
    0,
  );
  const dates = [...new Set(result.entries.map((e) => e.date))].sort();
  const range = dates.length === 1 ? dates[0] : `${dates[0]} 至 ${dates[dates.length - 1]}`;
  return `${result.entries.length} 笔 · 净支出 ${total.toFixed(2)} 元 · ${range}`;
}

export { INCOME_IDS };
