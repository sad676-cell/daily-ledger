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
