import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TabBar, Tab } from './src/components/TabBar';
import { EntrySheet } from './src/components/EntrySheet';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { loadEntries, saveEntries } from './src/storage';
import { Entry } from './src/types';
import { monthOf, todayISO } from './src/money';
import { palette } from './src/theme';

function LedgerApp() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('ledger');
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

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
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

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
            />
          ) : (
            <StatsScreen entries={entries} month={month} onMonthChange={setMonth} />
          )
        ) : (
          <View style={styles.body} />
        )}
      </View>

      <TabBar tab={tab} onChange={setTab} onAdd={openNew} bottomInset={insets.bottom} />

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
});
