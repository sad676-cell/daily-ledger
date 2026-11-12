import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KindSwitch } from '../components/KindSwitch';
import { MonthStepper } from '../components/MonthStepper';
import { Entry, IconName, Kind, categoryOf } from '../types';
import { formatAmount } from '../money';
import { palette, num, radius, space, type } from '../theme';

type Row = {
  id: string;
  name: string;
  icon: IconName;
  amount: number;
  share: number;
};

type Props = {
  entries: Entry[];
  month: string;
  onMonthChange: (month: string) => void;
};

export function StatsScreen({ entries, month, onMonthChange }: Props) {
  const [kind, setKind] = useState<Kind>('expense');

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(month)),
    [entries, month],
  );

  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const e of monthEntries) {
      if (e.kind === 'expense') expense += e.amount;
      else income += e.amount;
    }
    return { expense, income };
  }, [monthEntries]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthEntries) {
      if (e.kind !== kind) continue;
      map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    const rows: Row[] = [...map.entries()].map(([id, amount]) => {
      const category = categoryOf(id);
      return {
        id,
        name: category.name,
        icon: category.icon,
        amount,
        share: total > 0 ? amount / total : 0,
      };
    });
    rows.sort((a, b) => b.amount - a.amount);
    return { total, rows };
  }, [monthEntries, kind]);

  const tone = kind === 'expense' ? palette.accent : palette.income;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={[type.caption, styles.eyebrow]}>统计</Text>
        <MonthStepper month={month} onChange={onMonthChange} />
      </View>

      <View style={styles.hero}>
        <Text style={[type.caption, styles.heroLabel]}>本月支出</Text>
        <View style={styles.heroAmountRow}>
          <Text style={[type.title, styles.heroYen]}>¥</Text>
          <Text style={[type.display, num, styles.heroAmount]}>{formatAmount(totals.expense)}</Text>
        </View>
        <View style={styles.heroFoot}>
          <Text style={[type.small, num, styles.heroFootText]}>
            收入 {formatAmount(totals.income)}
          </Text>
          <View style={styles.dot} />
          <Text style={[type.small, num, styles.heroFootText]}>
            结余 {formatAmount(totals.income - totals.expense)}
          </Text>
        </View>
      </View>

      <View style={styles.switchWrap}>
        <KindSwitch value={kind} onChange={setKind} />
      </View>

      {breakdown.rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={32} color={palette.ink3} />
          <Text style={[type.title, styles.emptyTitle]}>
            这个月还没有{kind === 'expense' ? '支出' : '收入'}
          </Text>
          <Text style={[type.small, styles.emptyBody]}>记几笔之后，这里会按分类画出来。</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <View style={styles.listHead}>
            <Text style={[type.caption, styles.eyebrow]}>
              {kind === 'expense' ? '支出构成' : '收入构成'}
            </Text>
            <Text style={[type.caption, num, styles.eyebrow]}>
              共 {breakdown.rows.length} 类 · 合计 {formatAmount(breakdown.total)}
            </Text>
          </View>

          {breakdown.rows.map((row) => (
            <View key={row.id} style={styles.statRow}>
              <View style={styles.statHead}>
                <Ionicons name={row.icon} size={16} color={palette.ink2} />
                <Text style={[type.small, styles.statName]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[type.small, num, styles.statAmount]}>{formatAmount(row.amount)}</Text>
                <Text style={[type.caption, num, styles.statShare]}>
                  {Math.round(row.share * 100)}%
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.max(row.share * 100, 1.5)}%`, backgroundColor: tone },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  eyebrow: {
    color: palette.ink3,
  },
  hero: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  heroLabel: {
    color: palette.ink3,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xs,
  },
  heroYen: {
    color: palette.ink3,
    marginRight: space.sm,
  },
  heroAmount: {
    color: palette.ink,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  heroFootText: {
    ...num,
    color: palette.ink2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.hair,
  },
  switchWrap: {
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  list: {
    gap: space.lg,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statRow: {
    gap: space.sm,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  statName: {
    flex: 1,
    color: palette.ink,
  },
  statAmount: {
    ...num,
    color: palette.ink,
    fontWeight: '500',
  },
  statShare: {
    ...num,
    color: palette.ink3,
    width: 40,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.hairSoft,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  empty: {
    alignItems: 'center',
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  emptyTitle: {
    color: palette.ink,
    marginTop: space.xs,
  },
  emptyBody: {
    color: palette.ink3,
    textAlign: 'center',
    maxWidth: 260,
  },
});
