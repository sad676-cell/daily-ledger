import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconName } from '../types';
import { palette, num, radius, space, type } from '../theme';

export type Tab = 'ledger' | 'stats';

type Props = {
  tab: Tab;
  onChange: (tab: Tab) => void;
  onAdd: () => void;
  bottomInset: number;
};

function TabButton({
  icon,
  activeIcon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  activeIcon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tab}
    >
      <Ionicons name={active ? activeIcon : icon} size={20} color={active ? palette.ink : palette.ink3} />
      <Text style={[type.caption, styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function TabBar({ tab, onChange, onAdd, bottomInset }: Props) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <TabButton
        icon="book-outline"
        activeIcon="book"
        label="账本"
        active={tab === 'ledger'}
        onPress={() => onChange('ledger')}
      />
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="记一笔"
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
      >
        <Ionicons name="add" size={16} color={palette.accentInk} />
        <Text style={[type.small, styles.addLabel]}>记一笔</Text>
      </Pressable>
      <TabButton
        icon="pie-chart-outline"
        activeIcon="pie-chart"
        label="统计"
        active={tab === 'stats'}
        onPress={() => onChange('stats')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: palette.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hair,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    color: palette.ink3,
  },
  tabLabelActive: {
    color: palette.ink,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  addPressed: {
    opacity: 0.85,
  },
  addLabel: {
    ...num,
    color: palette.accentInk,
    fontWeight: '600',
  },
});
