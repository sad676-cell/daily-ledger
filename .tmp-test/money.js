"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAmount = formatAmount;
exports.todayISO = todayISO;
exports.parseISO = parseISO;
exports.shiftISO = shiftISO;
exports.monthOf = monthOf;
exports.monthLabel = monthLabel;
exports.shiftMonth = shiftMonth;
exports.daysAgo = daysAgo;
exports.dayLabel = dayLabel;
exports.dateChip = dateChip;
exports.formatTyping = formatTyping;
exports.hasOperator = hasOperator;
exports.evaluateExpr = evaluateExpr;
exports.pushDigit = pushDigit;
exports.pushDot = pushDot;
exports.pushOperator = pushOperator;
exports.prettyExpr = prettyExpr;
const pad = (n) => String(n).padStart(2, '0');
/** 1234.5 -> "1,234.50"，不依赖 Intl，Hermes 上行为一致。 */
function formatAmount(n) {
    const abs = Math.abs(n);
    const [int, dec] = abs.toFixed(2).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n < 0 ? '-' : ''}${grouped}.${dec}`;
}
function todayISO(now = new Date()) {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function shiftISO(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return todayISO(d);
}
function monthOf(iso) {
    return iso.slice(0, 7);
}
function monthLabel(month) {
    const [y, m] = month.split('-');
    return `${y}年${Number(m)}月`;
}
function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
/** 相对今天的天数差，用 UTC 计算避免夏令时误差。 */
function daysAgo(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const [ty, tm, td] = todayISO().split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
}
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function dayLabel(iso) {
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
function dateChip(iso) {
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
function formatTyping(raw) {
    if (!raw)
        return '0.00';
    const [int, dec] = raw.split('.');
    const grouped = (int === '' ? '0' : int).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return raw.includes('.') ? `${grouped}.${dec ?? ''}` : grouped;
}
/* ---------- 金额算式：允许 12.5+3-2 这种写法 ---------- */
function hasOperator(expr) {
    return expr.includes('+') || expr.includes('-');
}
/** 当前正在输入的那一项（最后一个运算符之后的部分）。 */
function lastTerm(expr) {
    const cut = Math.max(expr.lastIndexOf('+'), expr.lastIndexOf('-'));
    return { head: expr.slice(0, cut + 1), term: expr.slice(cut + 1) };
}
/** 把算式算成一个数，只做加减，最后一步四舍五入到分。 */
function evaluateExpr(expr) {
    if (!expr)
        return 0;
    const tokens = expr.match(/[+-]?[^+-]+/g) ?? [];
    let total = 0;
    for (const token of tokens) {
        const value = Number(token);
        if (Number.isFinite(value))
            total += value;
    }
    return Math.round(total * 100) / 100;
}
function pushDigit(expr, digits) {
    const { head, term } = lastTerm(expr);
    if (term.includes('.')) {
        const dec = term.split('.')[1] ?? '';
        const room = 2 - dec.length;
        if (room <= 0)
            return expr;
        return head + term + digits.slice(0, room);
    }
    if (term === '' || term === '0') {
        const trimmed = digits.replace(/^0+/, '');
        return head + (trimmed === '' ? '0' : trimmed);
    }
    const room = 8 - term.length;
    if (room <= 0)
        return expr;
    return head + term + digits.slice(0, room);
}
function pushDot(expr) {
    const { head, term } = lastTerm(expr);
    if (term.includes('.'))
        return expr;
    return head + (term === '' ? '0.' : `${term}.`);
}
function pushOperator(expr, op) {
    if (!expr)
        return '';
    const last = expr[expr.length - 1];
    if (last === '+' || last === '-')
        return expr.slice(0, -1) + op;
    if (last === '.')
        return expr.slice(0, -1) + op;
    return expr + op;
}
/** 给界面看的算式：运算符两侧加空格，减号用排版减号。 */
function prettyExpr(expr) {
    return expr.replace(/\+/g, ' + ').replace(/-/g, ' − ');
}
