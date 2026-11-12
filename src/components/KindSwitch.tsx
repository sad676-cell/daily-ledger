import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Kind } from '../types';
import { palette, radius, type } from '../theme';

type Props = {
  value: Kind;
  onChange: (kind: Kind) => void;
};

const OPTIONS: { value: Kind; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
];

export function KindSwitch({ value, onChange }: Props) {
  return (
    <View style={styles.track}>
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[type.small, active ? styles.labelActive : styles.label]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: palette.hairSoft,
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: {
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  label: {
    color: palette.ink3,
  },
  labelActive: {
    color: palette.ink,
    fontWeight: '600',
  },
});
