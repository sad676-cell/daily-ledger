import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TabBar, Tab } from './src/components/TabBar';
import { EntrySheet } from './src/components/EntrySheet';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { loadEntries, saveEntries } from './src/storage';
import { Entry, categoryOf } from './src/types';
import { formatAmount, monthOf, todayISO } from './src/money';
import { palette, num, radius, space, type } from './src/theme';

/** 删掉的那笔 + 它原来的位置，用于撤销 */
type PendingUndo = { entry: Entry; index: number };

function LedgerApp() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('ledger');
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadEntries().then((list) => {
      if (!alive) return;
      setEntries(list);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void saveEntries(entries);
  }, [entries, ready]);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setSheetOpen(true);
  };

  const handleSave = (entry: Entry) => {
    setEntries((prev) => {
      const index = prev.findIndex((e) => e.id === entry.id);
      if (index === -1) return [...prev, entry];
      const next = [...prev];
      next[index] = entry;
      return next;
    });
    // 记到别的月份时，自动跳到那个月，避免「保存了却看不见」。
    setMonth((current) => (entry.date.startsWith(current) ? current : monthOf(entry.date)));
  };

  const handleDelete = (id: string) => {
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));

    // 删错了还能在 5 秒内撤回；记账数据宁可多一步「撤销」，不要一步「永久」。
    setPendingUndo({ entry: entries[index], index });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setPendingUndo(null);
    }, 5000);
  };

  const undoDelete = () => {
    if (!pendingUndo) return;
    const { entry, index } = pendingUndo;
    setEntries((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, entry);
      return next;
    });
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setPendingUndo(null);
  };

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {ready ? (
          tab === 'ledger' ? (
            <LedgerScreen
              entries={entries}
              month={month}
              onMonthChange={setMonth}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ) : (
            <StatsScreen entries={entries} month={month} onMonthChange={setMonth} />
          )
        ) : (
          <View style={styles.body} />
        )}
      </View>

      <TabBar tab={tab} onChange={setTab} onAdd={openNew} bottomInset={insets.bottom} />

      {pendingUndo ? (
        <View style={[styles.toast, { bottom: 72 + insets.bottom }]}>
          <Text style={[type.small, styles.toastText]} numberOfLines={1}>
            已删除 {categoryOf(pendingUndo.entry.categoryId).name}
            {pendingUndo.entry.kind === 'income' ? ' +' : ' −'}
            {formatAmount(pendingUndo.entry.amount)}
          </Text>
          <Pressable onPress={undoDelete} accessibilityRole="button" hitSlop={10}>
            <Text style={[type.small, styles.toastAction]}>撤销</Text>
          </Pressable>
        </View>
      ) : null}

      <EntrySheet
        visible={sheetOpen}
        initial={editing}
        defaultDate={todayISO()}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LedgerApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  body: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.ink,
  },
  toastText: {
    flex: 1,
    ...num,
    color: palette.hairSoft,
  },
  toastAction: {
    color: palette.accentInk,
    fontWeight: '700',
  },
});
