import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MonthStepper } from '../components/MonthStepper';
import { SwipeRow } from '../components/SwipeRow';
import { Entry, categoryOf } from '../types';
import { dayLabel, formatAmount } from '../money';
import { palette, num, radius, space, type } from '../theme';

type DaySection = {
  date: string;
  expense: number;
  income: number;
  data: Entry[];
};

type Props = {
  entries: Entry[];
  month: string;
  onMonthChange: (month: string) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
};

export function LedgerScreen({ entries, month, onMonthChange, onEdit, onDelete }: Props) {
  /** 当前左滑打开的那一行；同时只能有一行开着 */
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setOpenId(null);
  }, [month]);

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

  const sections = useMemo<DaySection[]>(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of monthEntries) {
      const list = byDay.get(entry.date);
      if (list) list.push(entry);
      else byDay.set(entry.date, [entry]);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => {
        let expense = 0;
        let income = 0;
        for (const e of list) {
          if (e.kind === 'expense') expense += e.amount;
          else income += e.amount;
        }
        return {
          date,
          expense,
          income,
          data: [...list].sort((a, b) => b.createdAt - a.createdAt),
        };
      });
  }, [monthEntries]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <View style={styles.topBar}>
            <Text style={[type.caption, styles.eyebrow]}>账本</Text>
            <MonthStepper month={month} onChange={onMonthChange} />
          </View>

          <View style={styles.hero}>
            <Text style={[type.caption, styles.heroLabel]}>本月支出</Text>
            <View style={styles.heroAmountRow}>
              <Text style={[type.title, styles.heroYen]}>¥</Text>
              <Text style={[type.hero, num, styles.heroAmount]}>{formatAmount(totals.expense)}</Text>
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
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.dayBar}>
          <Text style={[type.small, styles.dayLabel]}>{dayLabel(section.date)}</Text>
          <Text style={[type.caption, num, styles.dayTotal]}>
            支出 {formatAmount(section.expense)}
            {section.income > 0 ? ` · 收入 ${formatAmount(section.income)}` : ''}
          </Text>
        </View>
      )}
      onScrollBeginDrag={() => setOpenId(null)}
      renderItem={({ item }) => {
        const category = categoryOf(item.categoryId);
        const isIncome = item.kind === 'income';
        const sub = [item.note, item.expr].filter(Boolean).join('  ·  ');
        return (
          <SwipeRow
            open={openId === item.id}
            onOpen={() => setOpenId(item.id)}
            onClose={() => setOpenId((cur) => (cur === item.id ? null : cur))}
            onDelete={() => {
              setOpenId(null);
              onDelete(item.id);
            }}
          >
            <Pressable
              onPress={() => {
                setOpenId(null);
                onEdit(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${category.name} ${formatAmount(item.amount)} 元`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={category.icon} size={16} color={palette.ink2} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[type.body, styles.rowTitle]} numberOfLines={1}>
                  {category.name}
                </Text>
                {sub && (
                  <Text style={[type.small, styles.rowNote]} numberOfLines={1}>
                    {sub}
                  </Text>
                )}
              </View>
              <Text style={[type.body, num, styles.rowAmount, isIncome && styles.rowAmountIncome]}>
                {isIncome ? '+' : '−'}
                {formatAmount(item.amount)}
              </Text>
            </Pressable>
          </SwipeRow>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={32} color={palette.ink3} />
          <Text style={[type.title, styles.emptyTitle]}>这个月还没有记账</Text>
          <Text style={[type.small, styles.emptyBody]}>
            {'点下面的「记一笔」开始。\n数据只存在这台手机上，不联网。'}
          </Text>
        </View>
      }
    />
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
  dayBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  dayLabel: {
    color: palette.ink2,
  },
  dayTotal: {
    ...num,
    color: palette.ink3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  rowPressed: {
    backgroundColor: palette.hairSoft,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.hairSoft,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: palette.ink,
  },
  rowNote: {
    color: palette.ink3,
  },
  rowAmount: {
    ...num,
    color: palette.ink,
    fontWeight: '500',
  },
  rowAmountIncome: {
    color: palette.income,
  },
  empty: {
    alignItems: 'center',
    paddingTop: space.xxxl,
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
    maxWidth: 300,
  },
});
