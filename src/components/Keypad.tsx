import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, num, type } from '../theme';

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

type Props = {
  onKey: (key: string) => void;
};

/** 账本格线感的键盘：只有细线，没有圆角块。 */
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
                key={key}
                onPress={() => onKey(key)}
                accessibilityRole="button"
                accessibilityLabel={key === 'backspace' ? '删除' : key === '.' ? '小数点' : key}
                style={({ pressed }) => [
                  styles.key,
                  !lastCol && styles.cellRight,
                  !lastRow && styles.cellBottom,
                  pressed && styles.keyPressed,
                ]}
              >
                {key === 'backspace' ? (
                  <Ionicons name="backspace-outline" size={20} color={palette.ink2} />
                ) : (
                  <Text style={[type.title, styles.keyText]}>{key}</Text>
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
  cellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  cellBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
});
