import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TabBar, Tab } from './src/components/TabBar';
import { EntrySheet } from './src/components/EntrySheet';
import { ImportSheet } from './src/components/ImportSheet';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { loadEntries, saveEntries } from './src/storage';
import { Entry, categoryOf } from './src/types';
import type { ParsedEntry } from './src/import/parse';
import { makeId } from './src/id';
import { formatAmount, monthOf, todayISO } from './src/money';
import { palette, num, radius, space, type } from './src/theme';

/** 删掉的几笔 + 它们原来的位置，用于撤销。单笔删除就是长度为 1 的特例 */
type PendingUndo = { items: Array<{ entry: Entry; index: number }> };

/** 从 ledger://import?text=... 里取文字；顺便把 + 还原成空格。 */
function readTextParam(url: string): string | null {
  const q = url.indexOf('?');
  if (q === -1) return null;
  for (const pair of url.slice(q + 1).split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === 'text' || key === 't') {
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    }
  }
  return null;
}

function LedgerApp() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('ledger');
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
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

  /**
   * 删除一笔或多笔。撤销时按原索引升序插回去，
   * 所以「恢复后的顺序」和删除前完全一致。
   */
  const handleDeleteMany = (ids: string[]) => {
    if (!ids.length) return;
    const wanted = new Set(ids);
    const items = entries
      .map((entry, index) => ({ entry, index }))
      .filter((item) => wanted.has(item.entry.id));
    if (!items.length) return;

    setEntries((prev) => prev.filter((e) => !wanted.has(e.id)));

    // 记账数据宁可多一步「撤销」，不要一步「永久」
    setPendingUndo({ items });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(
      () => {
        undoTimer.current = null;
        setPendingUndo(null);
      },
      // 一次删好几笔时多给几秒反悔
      items.length > 1 ? 8000 : 5000,
    );
  };

  const handleDelete = (id: string) => handleDeleteMany([id]);

  const undoDelete = () => {
    if (!pendingUndo) return;
    const items = [...pendingUndo.items].sort((a, b) => a.index - b.index);
    setEntries((prev) => {
      const next = [...prev];
      for (const item of items) {
        next.splice(Math.min(item.index, next.length), 0, item.entry);
      }
      return next;
    });
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setPendingUndo(null);
  };

  const undoLabel = pendingUndo
    ? pendingUndo.items.length === 1
      ? `已删除 ${categoryOf(pendingUndo.items[0].entry.categoryId).name}${
          pendingUndo.items[0].entry.kind === 'income' ? ' +' : ' −'
        }${formatAmount(pendingUndo.items[0].entry.amount)}`
      : `已删除 ${pendingUndo.items.length} 笔`
    : '';

  // 快捷指令或其他 App 通过 ledger://import?text=... 把识别出的文字送进来
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (!url || !/^ledger:\/\//i.test(url)) return;
      if (!/(import|add)/i.test(url)) return;
      setImportText(readTextParam(url) ?? '');
      setImportOpen(true);
    };
    void Linking.getInitialURL().then(open);
    const subscription = Linking.addEventListener('url', (event) => open(event.url));
    return () => subscription.remove();
  }, []);

  const handleImport = (list: ParsedEntry[]) => {
    if (!list.length) return;
    const base = Date.now();
    const added: Entry[] = list.map((item, index) => ({
      id: `${makeId()}-${index}`,
      kind: item.kind,
      amount: item.amount,
      categoryId: item.categoryId,
      note: item.note,
      date: item.date,
      createdAt: base + index,
    }));
    setEntries((prev) => [...prev, ...added]);

    // 跳到最早那笔所在的月份，否则「导入成功却看不见」
    const earliest = added.reduce((min, e) => (e.date < min ? e.date : min), added[0].date);
    setMonth(monthOf(earliest));
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
              onDeleteMany={handleDeleteMany}
              onOpenImport={() => {
                setImportText('');
                setImportOpen(true);
              }}
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
            {undoLabel}
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

      <ImportSheet
        visible={importOpen}
        initialText={importText}
        existing={entries}
        onImport={handleImport}
        onClose={() => setImportOpen(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LedgerApp />
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
