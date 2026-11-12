import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, num, type } from '../theme';

/** 左侧 3×4 数字区，行高 54。 */
const DIGIT_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '00'],
];

/** 右侧竖排：加、减、退格。没有清空键。 */
const RAIL: ('+' | '-' | 'backspace')[] = ['+', '-', 'backspace'];

const LABELS: Record<string, string> = {
  '+': '加',
  '-': '减',
  '.': '小数点',
  '00': '两个零',
  backspace: '退格',
};

type Props = {
  onKey: (key: string) => void;
};

export function Keypad({ onKey }: Props) {
  return (
    <View style={styles.pad}>
      <View style={styles.digits}>
        {DIGIT_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key, colIndex) => {
              const lastCol = colIndex === row.length - 1;
              const lastRow = rowIndex === DIGIT_ROWS.length - 1;
              return (
                <Pressable
                  key={key}
                  onPress={() => onKey(key)}
                  accessibilityRole="button"
                  accessibilityLabel={LABELS[key] ?? key}
                  style={({ pressed }) => [
                    styles.key,
                    !lastCol && styles.cellRight,
                    !lastRow && styles.cellBottom,
                    pressed && styles.keyPressed,
                  ]}
                >
                  <Text style={[type.title, num, styles.keyText]}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.rail}>
        {RAIL.map((key, index) => {
          const isBackspace = key === 'backspace';
          return (
            <Pressable
              key={key}
              onPress={() => onKey(key)}
              accessibilityRole="button"
              accessibilityLabel={LABELS[key]}
              style={({ pressed }) => [
                styles.railKey,
                index !== RAIL.length - 1 && styles.cellBottom,
                pressed && styles.keyPressed,
              ]}
            >
              {isBackspace ? (
                <Ionicons name="backspace-outline" size={20} color={palette.ink2} />
              ) : (
                <Text style={[type.title, num, styles.railText]}>{key === '-' ? '−' : key}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
    backgroundColor: palette.paper,
  },
  digits: {
    flex: 1,
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
  rail: {
    width: 84,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  railKey: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railText: {
    ...num,
    color: palette.ink2,
    fontWeight: '500',
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
