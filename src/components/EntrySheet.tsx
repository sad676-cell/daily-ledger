import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keypad } from './Keypad';
import { KindSwitch } from './KindSwitch';
import { categoriesFor, Category, Kind, Entry } from '../types';
import { dateChip, daysAgo, evaluateExpr, formatAmount, hasOperator, prettyExpr, pushDigit, pushDot, pushOperator, shiftISO } from '../money';
import { palette, num, radius, space, type } from '../theme';

type Props = {
  visible: boolean;
  initial: Entry | null;
  defaultDate: string;
  onSave: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function EntrySheet({ visible, initial, defaultDate, onSave, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>('expense');
  const [expr, setExpr] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [noteFocused, setNoteFocused] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const categories = useMemo(() => categoriesFor(kind), [kind]);

  useEffect(() => {
    if (!visible) return;
    setNoteFocused(false);
    setConfirmingDelete(false);
    if (initial) {
      setKind(initial.kind);
      setExpr(String(initial.amount));
      setCategoryId(initial.categoryId);
      setNote(initial.note);
      setDate(initial.date);
    } else {
      setKind('expense');
      setExpr('');
      setCategoryId(categoriesFor('expense')[0].id);
      setNote('');
      setDate(defaultDate);
    }
  }, [visible, initial, defaultDate]);

  const amount = evaluateExpr(expr);
  const canSave = amount > 0;

  const handleKind = (next: Kind) => {
    setKind(next);
    const list = categoriesFor(next);
    if (!list.some((c) => c.id === categoryId)) setCategoryId(list[0].id);
  };

  const pressKey = (key: string) => {
    setExpr((prev) => {
      switch (key) {
        case 'backspace':
          return prev.slice(0, -1);
        case '+':
        case '-':
        case '×':
        case '÷':
          return pushOperator(prev, key);
        case '.':
          return pushDot(prev);
        default:
          return pushDigit(prev, key);
      }
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    Keyboard.dismiss();
    // 金额没改时保留原来的算式，只改备注不该丢掉当时的算法。
    const amountUnchanged = initial ? Math.abs(amount - initial.amount) < 0.005 : false;
    const savedExpr = hasOperator(expr)
      ? prettyExpr(expr)
      : amountUnchanged
        ? initial?.expr
        : undefined;
    const entry: Entry = {
      id: initial?.id ?? makeId(),
      kind,
      amount: Math.round(amount * 100) / 100,
      categoryId,
      note: note.trim(),
      date,
      createdAt: initial?.createdAt ?? Date.now(),
      expr: savedExpr,
    };
    onSave(entry);
    onClose();
  };

  const handleDelete = () => {
    if (!initial) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(initial.id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.headerSide} hitSlop={8}>
            <Text style={[type.body, styles.cancel]}>取消</Text>
          </Pressable>
          <Text style={[type.title, styles.headerTitle]}>{initial ? '改一笔' : '记一笔'}</Text>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.headerSide, styles.headerRight]}
            hitSlop={8}
          >
            <Text style={[type.body, styles.save, !canSave && styles.saveDisabled]}>保存</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <KindSwitch value={kind} onChange={handleKind} />

            <View style={styles.amountBlock}>
              <Text style={[type.small, styles.exprLine]} numberOfLines={1}>
                {hasOperator(expr) ? prettyExpr(expr) : ' '}
              </Text>
              <View style={styles.amountRow}>
                <Text style={[type.title, styles.yen]}>¥</Text>
                <Text
                  style={[
                    type.hero,
                    num,
                    expr ? styles.amount : styles.amountEmpty,
                    amount < 0 && styles.amountNegative,
                  ]}
                >
                  {formatAmount(amount)}
                </Text>
              </View>
            </View>

            <View style={styles.grid}>
              {categories.map((category: Category) => {
                const selected = category.id === categoryId;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={styles.cell}
                  >
                    <View style={[styles.cellIcon, selected && styles.cellIconActive]}>
                      <Ionicons
                        name={category.icon}
                        size={16}
                        color={selected ? palette.accent : palette.ink2}
                      />
                    </View>
                    <Text style={[type.caption, styles.cellLabel, selected && styles.cellLabelActive]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.field}>
              <Text style={[type.caption, styles.fieldLabel]}>备注</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                placeholder="买了什么？可选"
                placeholderTextColor={palette.ink3}
                style={[type.body, styles.input]}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                maxLength={40}
              />
            </View>

            <View style={styles.field}>
              <Text style={[type.caption, styles.fieldLabel]}>日期</Text>
              <View style={styles.dateRow}>
                <Pressable
                  onPress={() => setDate(shiftISO(date, -1))}
                  accessibilityRole="button"
                  accessibilityLabel="前一天"
                  style={styles.dateArrow}
                >
                  <Ionicons name="chevron-back" size={16} color={palette.ink2} />
                </Pressable>
                <Text style={[type.small, num, styles.dateText]}>{dateChip(date)}</Text>
                <Pressable
                  onPress={() => setDate(shiftISO(date, 1))}
                  disabled={daysAgo(date) <= 0}
                  accessibilityRole="button"
                  accessibilityLabel="后一天"
                  style={styles.dateArrow}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={daysAgo(date) <= 0 ? palette.hair : palette.ink2}
                  />
                </Pressable>
              </View>
            </View>

            {initial ? (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                style={styles.deleteButton}
              >
                <Text style={[type.small, styles.deleteText]}>
                  {confirmingDelete ? '再点一次，删除这笔记录' : '删除这笔记录'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {!noteFocused ? <Keypad onKey={pressKey} /> : null}
        </KeyboardAvoidingView>
        <View style={{ height: insets.bottom }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  headerSide: {
    minWidth: 56,
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: palette.ink,
  },
  cancel: {
    color: palette.ink3,
  },
  save: {
    color: palette.accent,
    fontWeight: '600',
  },
  saveDisabled: {
    color: palette.hair,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  amountBlock: {
    alignItems: 'center',
    gap: space.xs,
  },
  exprLine: {
    ...num,
    color: palette.ink3,
    minHeight: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  yen: {
    color: palette.ink3,
    marginRight: space.sm,
  },
  amount: {
    color: palette.ink,
  },
  amountEmpty: {
    color: palette.ink3,
  },
  amountNegative: {
    color: palette.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cell: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    gap: space.xs,
  },
  cellIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  cellIconActive: {
    backgroundColor: palette.accentWash,
    borderColor: palette.accent,
  },
  cellLabel: {
    color: palette.ink3,
  },
  cellLabelActive: {
    color: palette.ink,
  },
  field: {
    gap: space.sm,
  },
  fieldLabel: {
    color: palette.ink3,
  },
  input: {
    height: 48,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.surface,
    paddingHorizontal: space.lg,
    color: palette.ink,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.surface,
  },
  dateArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    ...num,
    color: palette.ink,
    fontWeight: '600',
    minWidth: 96,
    textAlign: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  deleteText: {
    color: palette.accent,
    fontWeight: '500',
  },
});
