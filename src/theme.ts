import { TextStyle } from 'react-native';

/**
 * 一个方向：纸质账簿。
 * 暖白纸面 + 近黑油墨 + 单一朱砂红（只给「记一笔」和当前选中态）。
 * 结构层次靠间距和字重，不靠阴影和边框堆叠。
 */
export const palette = {
  paper: '#F5F1E8',
  surface: '#FFFCF6',
  ink: '#1B1714',
  ink2: '#574E45',
  ink3: '#6F6659',
  hair: '#E2D9C9',
  hairSoft: '#EDE6D8',
  accent: '#B4472F',
  accentInk: '#FFF7F3',
  accentWash: '#F2E1D9',
  /** 朱砂红的浅一档，只用于墨色底上的危险操作（选中条里的「删除」） */
  accentOnInk: '#E28873',
  income: '#3F6B52',
  incomeWash: '#E4EDE6',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/** 只用两个圆角：卡片 16，药丸 999。 */
export const radius = {
  card: 16,
  pill: 999,
};

/** 六个字号：12 / 14 / 16 / 20 / 32 / 44，比例约 1.3。 */
export const type: Record<'hero' | 'display' | 'title' | 'body' | 'small' | 'caption', TextStyle> = {
  hero: { fontSize: 44, lineHeight: 50, fontWeight: '600', letterSpacing: -0.8 },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.36, fontWeight: '500' },
};

/** 金额一律等宽，位数不会跳动。 */
export const num: TextStyle = { fontVariant: ['tabular-nums'] };
