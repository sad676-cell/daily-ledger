import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, num, space, type } from '../theme';

type KeySpec = {
  id: string;
  label?: string;
  icon?: 'backspace-outline';
  tone: 'digit' | 'operator' | 'muted';
};

const KEYS: KeySpec[] = [
  { id: '1', tone: 'digit' },
  { id: '2', tone: 'digit' },
  { id: '3', tone: 'digit' },
  { id: '+', label: '+', tone: 'operator' },
  { id: '4', tone: 'digit' },
  { id: '5', tone: 'digit' },
  { id: '6', tone: 'digit' },
  { id: '-', label: '−', tone: 'operator' },
  { id: '7', tone: 'digit' },
  { id: '8', tone: 'digit' },
  { id: '9', tone: 'digit' },
  { id: 'backspace', icon: 'backspace-outline', tone: 'operator' },
  { id: '.', label: '.', tone: 'digit' },
  { id: '0', label: '0', tone: 'digit' },
  { id: '00', label: '00', tone: 'digit' },
  { id: 'C', label: 'C', tone: 'muted' },
];

const COLUMNS = 4;

const ACCESSIBILITY: Record<string, string> = {
  '+': '加',
  '-': '减',
  '.': '小数点',
  C: '清空',
  '00': '两个零',
  backspace: '退格',
};

type Props = {
  onKey: (key: string) => void;
};

/** 账本格线感的键盘：只有细线，没有圆角块。右侧一列是运算符和编辑键。 */
export function Keypad({ onKey }: Props) {
  const rows: KeySpec[][] = [];
  for (let i = 0; i < KEYS.length; i += COLUMNS) rows.push(KEYS.slice(i, i + COLUMNS));

  return (
    <View style={styles.pad}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, colIndex) => {
            const lastCol = colIndex === row.length - 1;
            const lastRow = rowIndex === rows.length - 1;
            return (
              <Pressable
                key={key.id}
                onPress={() => onKey(key.id)}
                accessibilityRole="button"
                accessibilityLabel={ACCESSIBILITY[key.id] ?? key.label ?? key.id}
                style={({ pressed }) => [
                  styles.key,
                  !lastCol && styles.cellRight,
                  !lastRow && styles.cellBottom,
                  pressed && styles.keyPressed,
                ]}
              >
                {key.icon ? (
                  <Ionicons name={key.icon} size={20} color={palette.ink2} />
                ) : (
                  <Text
                    style={[
                      type.title,
                      num,
                      styles.keyText,
                      key.tone === 'operator' && styles.keyOperator,
                      key.tone === 'muted' && styles.keyMuted,
                    ]}
                  >
                    {key.label ?? key.id}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.paper,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
  },
  key: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: palette.hairSoft,
  },
  keyText: {
    ...num,
    color: palette.ink,
    fontWeight: '500',
  },
  keyOperator: {
    color: palette.ink2,
  },
  keyMuted: {
    color: palette.ink3,
  },
  cellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  cellBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
});
