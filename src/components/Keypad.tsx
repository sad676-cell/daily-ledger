import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, num, type } from '../theme';

type Key = { id: string; icon?: 'backspace-outline' };

/** 4×4 全同尺寸：数字在左三列，运算和退格在右列。 */
const ROWS: Key[][] = [
  [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '+' }],
  [{ id: '4' }, { id: '5' }, { id: '6' }, { id: '-' }],
  [{ id: '7' }, { id: '8' }, { id: '9' }, { id: '×' }],
  [{ id: '.' }, { id: '0' }, { id: 'backspace', icon: 'backspace-outline' }, { id: '÷' }],
];

const LABELS: Record<string, string> = {
  '+': '加',
  '-': '减',
  '×': '乘',
  '÷': '除',
  '.': '小数点',
  backspace: '退格',
};

const isOperator = (key: string) => key === '+' || key === '-' || key === '×' || key === '÷';

type Props = {
  onKey: (key: string) => void;
};

export function Keypad({ onKey }: Props) {
  return (
    <View style={styles.pad}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, colIndex) => {
            const lastCol = colIndex === row.length - 1;
            const lastRow = rowIndex === ROWS.length - 1;
            return (
              <Pressable
                key={key.id}
                onPress={() => onKey(key.id)}
                accessibilityRole="button"
                accessibilityLabel={LABELS[key.id] ?? key.id}
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
                      isOperator(key.id) && styles.operatorText,
                    ]}
                  >
                    {key.id === '-' ? '−' : key.id}
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
  operatorText: {
    color: palette.ink2,
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
