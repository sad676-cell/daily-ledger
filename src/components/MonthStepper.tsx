import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { monthLabel, shiftMonth, todayISO, monthOf } from '../money';
import { palette, num, radius, type } from '../theme';

type Props = {
  month: string;
  onChange: (month: string) => void;
};

export function MonthStepper({ month, onChange }: Props) {
  const currentMonth = monthOf(todayISO());
  const atLatest = month >= currentMonth;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(shiftMonth(month, -1))}
        accessibilityRole="button"
        accessibilityLabel="上个月"
        style={styles.arrow}
      >
        <Ionicons name="chevron-back" size={16} color={palette.ink2} />
      </Pressable>
      <Text style={[type.small, num, styles.label]}>{monthLabel(month)}</Text>
      <Pressable
        onPress={() => onChange(shiftMonth(month, 1))}
        disabled={atLatest}
        accessibilityRole="button"
        accessibilityLabel="下个月"
        accessibilityState={{ disabled: atLatest }}
        style={styles.arrow}
      >
        <Ionicons name="chevron-forward" size={16} color={atLatest ? palette.hair : palette.ink2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: palette.ink,
    fontWeight: '600',
    minWidth: 84,
    textAlign: 'center',
  },
});
