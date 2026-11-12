import AsyncStorage from '@react-native-async-storage/async-storage';
import { Entry } from './types';

const KEY = 'daily-ledger/entries/v1';

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<Entry>;
  return (
    typeof e.id === 'string' &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    (e.kind === 'expense' || e.kind === 'income')
  );
}

export async function loadEntries(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).map((e) => ({ ...e, note: e.note ?? '' }));
  } catch {
    return [];
  }
}

export async function saveEntries(entries: Entry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 写入失败不该让界面崩掉；下次改动会再试一次。
  }
}
