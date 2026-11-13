import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as ImagePicker from 'expo-image-picker';
import { boxesToLines, ocrAvailable, recognizeImage } from '../ocr';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeResult, parseBill, ParseResult, ParsedEntry } from '../import/parse';
import { Entry, categoryOf } from '../types';
import { dateChip, formatAmount } from '../money';
import { palette, num, radius, space, type } from '../theme';

type Props = {
  visible: boolean;
  /** 从 ledger://import?text=... 带进来的文字 */
  initialText: string;
  existing: Entry[];
  onImport: (entries: ParsedEntry[]) => void;
  onClose: () => void;
};

/** 同一天、同一分类、同一金额视为「可能已经记过」，默认不勾选，避免二次导入。 */
function fingerprint(e: { date: string; kind: string; amount: number; categoryId: string }): string {
  return `${e.date}|${e.kind}|${e.amount.toFixed(2)}|${e.categoryId}`;
}

export function ImportSheet({ visible, initialText, existing, onImport, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState('');

  const known = useMemo(() => new Set(existing.map(fingerprint)), [existing]);

  const duplicates = useMemo(() => {
    if (!result) return new Set<number>();
    const seen = new Set<number>();
    result.entries.forEach((e, i) => {
      if (known.has(fingerprint(e))) seen.add(i);
    });
    return seen;
  }, [result, known]);

  useEffect(() => {
    if (!visible) return;
    setText(initialText);
    setResult(null);
    setExcluded(new Set());
    setOcrError('');
    setOcrBusy(false);
    if (initialText.trim()) {
      run(initialText);
    }
    // 只在打开时重置，run 不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText]);

  function run(raw: string) {
    const parsed = parseBill(raw);
    setResult(parsed);
    const dup = new Set<number>();
    parsed.entries.forEach((e, i) => {
      if (known.has(fingerprint(e))) dup.add(i);
    });
    setExcluded(dup);
  }

  /**
   * 选一张截图 → 本机 Vision 识别 → 拼回文字行 → 直接进预览。
   * 识别失败或包里没有原生模块时，退回「粘贴文字」，不阻断流程。
   */
  async function pickImage() {
    setOcrError('');
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      });
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : '打不开相册');
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;

    if (!ocrAvailable) {
      setOcrError('这个安装包还不含本地识别，先粘贴文字；重新构建后就能直接选图');
      return;
    }

    setOcrBusy(true);
    try {
      const boxes = await recognizeImage(picked.assets[0].uri);
      const lines = boxesToLines(boxes);
      if (!lines.length) {
        setOcrError('这张图没认出文字，换一张清晰的截图试试');
        return;
      }
      const joined = lines.join('\n');
      setText(joined);
      run(joined);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : '识别失败，换一张图再试');
    } finally {
      setOcrBusy(false);
    }
  }

  const selected = useMemo(() => {
    if (!result) return [] as ParsedEntry[];
    return result.entries.filter((_, i) => !excluded.has(i));
  }, [result, excluded]);

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const allOn = result ? excluded.size === 0 : false;

  const handleImport = () => {
    if (!selected.length) return;
    onImport(selected);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={result ? () => setResult(null) : onClose}
            accessibilityRole="button"
            style={styles.headerSide}
            hitSlop={8}
          >
            <Text style={[type.body, styles.headerAction]}>{result ? '返回' : '取消'}</Text>
          </Pressable>
          <Text style={[type.title, styles.headerTitle]}>导入账单</Text>
          <View style={styles.headerSide} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {result ? (
            <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
              <View style={styles.summaryCard}>
                <Text style={[type.small, styles.summaryText]}>{describeResult(result)}</Text>
                <Text style={[type.caption, styles.summaryHint]}>
                  {result.source === 'payment'
                    ? '来自支付页，直接取实付金额'
                    : result.source === 'cart'
                      ? '来自点餐清单，金额由单价 × 数量求和'
                      : '来自账本流水，日期按分组向下继承'}
                </Text>
              </View>

              {result.warnings.length > 0 && (
                <View style={styles.warnBox}>
                  {result.warnings.map((w) => (
                    <View key={w} style={styles.warnRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={palette.ink2} />
                      <Text style={[type.caption, styles.warnText]}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.entries.length > 0 && (
                <View style={styles.listHead}>
                  <Text style={[type.caption, styles.listHeadText]}>
                    勾选要导入的（已去掉 {excluded.size} 笔）
                  </Text>
                  <Pressable
                    onPress={() => setExcluded(allOn ? new Set(result.entries.map((_, i) => i)) : new Set())}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[type.caption, styles.listHeadAction]}>
                      {allOn ? '全不选' : '全选'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {result.entries.map((entry, index) => {
                const on = !excluded.has(index);
                const category = categoryOf(entry.categoryId);
                const dup = duplicates.has(index);
                return (
                  <Pressable
                    key={`${entry.date}-${index}`}
                    onPress={() => toggle(index)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={on ? palette.accent : palette.hair}
                    />
                    <View style={styles.rowBody}>
                      <Text style={[type.body, styles.rowTitle]} numberOfLines={1}>
                        {category.name}
                        {dup ? '  · 可能已记过' : ''}
                      </Text>
                      <Text style={[type.small, styles.rowSub]} numberOfLines={1}>
                        {dateChip(entry.date)}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={[
                        type.body,
                        num,
                        styles.rowAmount,
                        entry.kind === 'income' && styles.rowAmountIncome,
                      ]}
                    >
                      {entry.kind === 'income' ? '+' : '−'}
                      {formatAmount(entry.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.intro}>
                <Text style={[type.title, styles.introTitle]}>把账单截图变成账目</Text>
                <Text style={[type.small, styles.introBody]}>
                  识别只在这台手机上完成，图片不上传、也不会保存。
                </Text>
              </View>

              {ocrAvailable ? (
                <Pressable
                  onPress={pickImage}
                  disabled={ocrBusy}
                  accessibilityRole="button"
                  accessibilityLabel="从相册选一张账单截图"
                  accessibilityState={{ disabled: ocrBusy, busy: ocrBusy }}
                  style={({ pressed }) => [
                    styles.primary,
                    styles.pickButton,
                    ocrBusy && styles.primaryDisabled,
                    pressed && styles.primaryPressed,
                  ]}
                >
                  {ocrBusy ? (
                    <ActivityIndicator color={palette.accentInk} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={18} color={palette.accentInk} />
                      <Text style={[type.body, styles.primaryLabel]}>从相册选截图</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Text style={[type.caption, styles.step]}>
                  当前安装包不含本地识别，只能用下面的方式粘贴文字。重新构建安装后即可直接选图。
                </Text>
              )}

              {ocrError ? <Text style={[type.caption, styles.error]}>{ocrError}</Text> : null}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={[type.caption, styles.dividerText]}>或者粘贴文字</Text>
                <View style={styles.dividerLine} />
              </View>

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={'例如：\n11月11日 星期三 支出: 45\n购物 -30\n餐饮 -15'}
                placeholderTextColor={palette.ink3}
                multiline
                textAlignVertical="top"
                style={[type.small, styles.input]}
              />

              <Pressable
                onPress={() => run(text)}
                disabled={!text.trim()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !text.trim() }}
                style={({ pressed }) => [
                  styles.secondary,
                  !text.trim() && styles.primaryDisabled,
                  pressed && styles.primaryPressed,
                ]}
              >
                <Text style={[type.body, styles.secondaryLabel]}>解析这段文字</Text>
              </Pressable>

              <Text style={[type.caption, styles.step]}>
                也可以配一次快捷指令：用「从图像提取文本」识别截图，再通过 ledger://import 打开这里。
              </Text>
            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {result && result.entries.length > 0 && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            <Pressable
              onPress={handleImport}
              disabled={!selected.length}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected.length }}
              style={({ pressed }) => [
                styles.primary,
                styles.footerButton,
                !selected.length && styles.primaryDisabled,
                pressed && styles.primaryPressed,
              ]}
            >
              <Text style={[type.body, styles.primaryLabel]}>
                {selected.length ? `导入 ${selected.length} 笔` : '没有勾选任何一笔'}
              </Text>
            </Pressable>
          </View>
        )}
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: palette.ink,
  },
  headerAction: {
    color: palette.ink3,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  intro: {
    gap: space.sm,
  },
  introTitle: {
    color: palette.ink,
  },
  introBody: {
    color: palette.ink2,
  },
  steps: {
    gap: space.xs,
    marginTop: space.xs,
  },
  step: {
    color: palette.ink3,
  },
  input: {
    minHeight: 180,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: palette.ink,
  },
  primary: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  primaryDisabled: {
    backgroundColor: palette.hair,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryLabel: {
    color: palette.accentInk,
    fontWeight: '600',
  },
  pickButton: {
    flexDirection: 'row',
    gap: space.sm,
  },
  secondary: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.surface,
  },
  secondaryLabel: {
    color: palette.ink2,
    fontWeight: '600',
  },
  error: {
    color: palette.accent,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.hair,
  },
  dividerText: {
    color: palette.ink3,
  },
  summaryCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.xs,
  },
  summaryText: {
    ...num,
    color: palette.ink,
    fontWeight: '600',
  },
  summaryHint: {
    color: palette.ink3,
  },
  warnBox: {
    backgroundColor: palette.hairSoft,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  warnText: {
    flex: 1,
    color: palette.ink2,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeadText: {
    color: palette.ink3,
  },
  listHeadAction: {
    color: palette.accent,
    fontWeight: '600',
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
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: palette.ink,
  },
  rowSub: {
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
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.paper,
  },
  footerButton: {
    width: '100%',
  },
});
