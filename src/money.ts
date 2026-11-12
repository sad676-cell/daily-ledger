const pad = (n: number) => String(n).padStart(2, '0');

/** 1234.5 -> "1,234.50"，不依赖 Intl，Hermes 上行为一致。 */
export function formatAmount(n: number): string {
  const abs = Math.abs(n);
  const [int, dec] = abs.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped}.${dec}`;
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 相对今天的天数差，用 UTC 计算避免夏令时误差。 */
export function daysAgo(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function dayLabel(iso: string): string {
  const d = parseISO(iso);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  switch (daysAgo(iso)) {
    case 0:
      return `今天 · ${md}`;
    case 1:
      return `昨天 · ${md}`;
    case 2:
      return `前天 · ${md}`;
    default:
      return `${md} · ${WEEKDAYS[d.getDay()]}`;
  }
}

/** 记账页日期条上的短标签。 */
export function dateChip(iso: string): string {
  const d = parseISO(iso);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  switch (daysAgo(iso)) {
    case 0:
      return '今天';
    case 1:
      return '昨天';
    case 2:
      return '前天';
    default:
      return `${md} ${WEEKDAYS[d.getDay()]}`;
  }
}

/** 输入中的金额保留千分位，末尾的小数点不吞掉。 */
export function formatTyping(raw: string): string {
  if (!raw) return '0.00';
  const [int, dec] = raw.split('.');
  const grouped = (int === '' ? '0' : int).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return raw.includes('.') ? `${grouped}.${dec ?? ''}` : grouped;
}

/* ---------- 金额算式：允许 12.5+3-2 这种写法 ---------- */

export function hasOperator(expr: string): boolean {
  return expr.includes('+') || expr.includes('-');
}

/** 当前正在输入的那一项（最后一个运算符之后的部分）。 */
function lastTerm(expr: string): { head: string; term: string } {
  const cut = Math.max(expr.lastIndexOf('+'), expr.lastIndexOf('-'));
  return { head: expr.slice(0, cut + 1), term: expr.slice(cut + 1) };
}

/** 把算式算成一个数，只做加减，最后一步四舍五入到分。 */
export function evaluateExpr(expr: string): number {
  if (!expr) return 0;
  const tokens = expr.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  for (const token of tokens) {
    const value = Number(token);
    if (Number.isFinite(value)) total += value;
  }
  return Math.round(total * 100) / 100;
}

export function pushDigit(expr: string, digits: string): string {
  const { head, term } = lastTerm(expr);
  if (term.includes('.')) {
    const dec = term.split('.')[1] ?? '';
    const room = 2 - dec.length;
    if (room <= 0) return expr;
    return head + term + digits.slice(0, room);
  }
  if (term === '' || term === '0') {
    const trimmed = digits.replace(/^0+/, '');
    return head + (trimmed === '' ? '0' : trimmed);
  }
  const room = 8 - term.length;
  if (room <= 0) return expr;
  return head + term + digits.slice(0, room);
}

export function pushDot(expr: string): string {
  const { head, term } = lastTerm(expr);
  if (term.includes('.')) return expr;
  return head + (term === '' ? '0.' : `${term}.`);
}

export function pushOperator(expr: string, op: '+' | '-'): string {
  if (!expr) return '';
  const last = expr[expr.length - 1];
  if (last === '+' || last === '-') return expr.slice(0, -1) + op;
  if (last === '.') return expr.slice(0, -1) + op;
  return expr + op;
}

/** 给界面看的算式：运算符两侧加空格，减号用排版减号。 */
export function prettyExpr(expr: string): string {
  return expr.replace(/\+/g, ' + ').replace(/-/g, ' − ');
}

