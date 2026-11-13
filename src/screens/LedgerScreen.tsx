import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
  onDeleteMany: (ids: string[]) => void;
  onOpenImport: () => void;
};

export function LedgerScreen({
  entries,
  month,
  onMonthChange,
  onEdit,
  onDelete,
  onDeleteMany,
  onOpenImport,
}: Props) {
  /** 当前左滑打开的那一行；同时只能有一行开着 */
  const [openId, setOpenId] = useState<string | null>(null);
  /** 批量选择模式：长按任意一行，或点顶部的「选择」进入 */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setOpenId(null);
    setSelecting(false);
    setSelected(new Set());
  }, [month]);

  // 用 useCallback 稳住引用，配合 memo 的行组件，开合时只重渲染受影响的行
  const handleOpen = useCallback((id: string) => setOpenId(id), []);
  const handleClose = useCallback(
    (id: string) => setOpenId((cur) => (cur === id ? null : cur)),
    [],
  );
  const handleDelete = useCallback(
    (id: string) => {
      setOpenId(null);
      onDelete(id);
    },
    [onDelete],
  );

  const toggleSelecting = useCallback(() => {
    setOpenId(null);
    if (selecting) {
      setSelecting(false);
      setSelected(new Set());
    } else {
      setSelecting(true);
    }
  }, [selecting]);

  const startSelecting = useCallback((id: string) => {
    setOpenId(null);
    setSelecting(true);
    setSelected(new Set([id]));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const visibleIds = useMemo(() => monthEntries.map((e) => e.id), [monthEntries]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    const ids = [...selected];
    setSelected(new Set());
    setSelecting(false);
    onDeleteMany(ids);
  };

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, selecting && styles.contentSelecting]}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <Text style={[type.caption, styles.eyebrow]}>账本</Text>
              <View style={styles.topBarRight}>
                <Pressable
                  onPress={toggleSelecting}
                  accessibilityRole="button"
                  accessibilityLabel={selecting ? '退出批量选择' : '批量选择'}
                  hitSlop={10}
                  style={({ pressed }) => [styles.selectButton, pressed && styles.importButtonPressed]}
                >
                  <Text style={[type.caption, styles.selectButtonText]}>
                    {selecting ? '取消' : '选择'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onOpenImport}
                  accessibilityRole="button"
                  accessibilityLabel="导入账单文字"
                  hitSlop={10}
                  style={({ pressed }) => [styles.importButton, pressed && styles.importButtonPressed]}
                >
                  <Ionicons name="scan-outline" size={18} color={palette.ink3} />
                </Pressable>
                <MonthStepper month={month} onChange={onMonthChange} />
              </View>
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
        renderItem={({ item }) => (
          <LedgerRow
            entry={item}
            open={openId === item.id}
            selecting={selecting}
            selected={selected.has(item.id)}
            onOpen={handleOpen}
            onClose={handleClose}
            onEdit={onEdit}
            onDelete={handleDelete}
            onToggle={toggleSelected}
            onStartSelecting={startSelecting}
          />
        )}
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

      {selecting && (
        <View style={styles.selectionBar}>
          <Pressable onPress={toggleAll} accessibilityRole="button" hitSlop={10}>
            <Text style={[type.caption, styles.selectionAction]}>
              {allSelected ? '全不选' : '全选'}
            </Text>
          </Pressable>
          <Text style={[type.small, num, styles.selectionCount]}>
            {selected.size ? `已选 ${selected.size} 笔` : '选几笔一起删'}
          </Text>
          <Pressable
            onPress={deleteSelected}
            disabled={!selected.size}
            accessibilityRole="button"
            accessibilityLabel={`删除选中的 ${selected.size} 笔`}
            accessibilityState={{ disabled: !selected.size }}
            hitSlop={10}
          >
            <Text
              style={[
                type.caption,
                styles.selectionDelete,
                !selected.size && styles.selectionDeleteOff,
              ]}
            >
              删除
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

type RowProps = {
  entry: Entry;
  open: boolean;
  selecting: boolean;
  selected: boolean;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onStartSelecting: (id: string) => void;
};

/** 单行单独 memo：滑开/收起/勾选时不会牵动整张列表重渲染 */
const LedgerRow = memo(function LedgerRow({
  entry,
  open,
  selecting,
  selected,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onStartSelecting,
}: RowProps) {
  const category = categoryOf(entry.categoryId);
  const isIncome = entry.kind === 'income';
  const sub = [entry.note, entry.expr].filter(Boolean).join('  ·  ');

  const amount = (
    <Text style={[type.body, num, styles.rowAmount, isIncome && styles.rowAmountIncome]}>
      {isIncome ? '+' : '−'}
      {formatAmount(entry.amount)}
    </Text>
  );

  // 批量选择时不做左滑：点一下就是勾选，避免两种手势打架
  if (selecting) {
    return (
      <Pressable
        onPress={() => onToggle(entry.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${category.name} ${formatAmount(entry.amount)} 元`}
        style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
      >
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? palette.accent : palette.hair}
        />
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
        {amount}
      </Pressable>
    );
  }

  return (
    <SwipeRow
      open={open}
      onOpen={() => onOpen(entry.id)}
      onClose={() => onClose(entry.id)}
      onDelete={() => onDelete(entry.id)}
    >
      <Pressable
        onPress={() => {
          // 已经滑开时，点一下只收起，不跳编辑页
          if (open) {
            onClose(entry.id);
            return;
          }
          onEdit(entry);
        }}
        onLongPress={() => onStartSelecting(entry.id)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${category.name} ${formatAmount(entry.amount)} 元，长按可批量选择`}
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
        {amount}
      </Pressable>
    </SwipeRow>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  contentSelecting: {
    paddingBottom: 120,
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
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  importButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  importButtonPressed: {
    backgroundColor: palette.hairSoft,
  },
  selectButton: {
    height: 32,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  selectButtonText: {
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
  rowSelected: {
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
  selectionBar: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: space.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
  },
  selectionAction: {
    color: palette.accentInk,
    fontWeight: '600',
  },
  selectionCount: {
    ...num,
    flex: 1,
    textAlign: 'center',
    color: palette.hairSoft,
  },
  selectionDelete: {
    color: palette.accentOnInk,
    fontWeight: '700',
  },
  selectionDeleteOff: {
    color: palette.ink3,
  },
});
