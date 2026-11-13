import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { palette, type } from '../theme';

/** 露出的删除按钮宽度 */
const ACTION_W = 80;
/** 一路滑到底（超过这个距离）松手就直接删 */
const FULL_SWIPE = ACTION_W + 96;

const SPRING = { damping: 40, stiffness: 460, mass: 0.9, overshootClamping: true };

type Props = {
  children: ReactNode;
  /** 由父级统一管理，保证同时只有一行打开 */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
};

/**
 * 左滑删除行。
 * 手势跑在 UI 线程（RNGH + Reanimated），拖动过程不过 JS bridge，
 * 所以跟手是 120Hz 的，不会因为 JS 线程忙而卡顿。
 */
export function SwipeRow({ children, open, onOpen, onClose, onDelete }: Props) {
  const translate = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = useSharedValue(open);

  const cb = useRef({ onOpen, onClose, onDelete });
  cb.current = { onOpen, onClose, onDelete };

  // 传给 runOnJS 的必须是稳定引用，否则每次渲染都会重新建 worklet
  const fireOpen = useCallback(() => cb.current.onOpen(), []);
  const fireClose = useCallback(() => cb.current.onClose(), []);
  const fireDelete = useCallback(() => cb.current.onDelete(), []);

  // 外部改变 open（点别的行、切月份、滚动）时同步位置
  useEffect(() => {
    isOpen.value = open;
    const target = open ? -ACTION_W : 0;
    translate.value = withSpring(target, SPRING);
  }, [open, isOpen, translate]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 横向超过 12px 才激活，纵向多一点就放弃，避免和列表滚动打架
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          startX.value = isOpen.value ? -ACTION_W : translate.value;
        })
        .onUpdate((e) => {
          const raw = startX.value + e.translationX;
          // 右边到头 0；左边允许拉过头 40 再回弹
          translate.value = Math.min(0, Math.max(raw, -(FULL_SWIPE + 40)));
        })
        .onEnd((e) => {
          const cur = translate.value;

          // 一路滑到底：直接删
          if (cur <= -FULL_SWIPE) {
            translate.value = withSpring(0, SPRING);
            isOpen.value = false;
            runOnJS(fireDelete)();
            return;
          }

          const flingLeft = e.velocityX < -350;
          const flingRight = e.velocityX > 350;
          const shouldOpen = !flingRight && (flingLeft || cur < -ACTION_W / 2);

          translate.value = withSpring(shouldOpen ? -ACTION_W : 0, SPRING);
          isOpen.value = shouldOpen;
          runOnJS(shouldOpen ? fireOpen : fireClose)();
        })
        .onFinalize(() => {
          // 被系统打断时也要回到合理位置
          const target = isOpen.value ? -ACTION_W : 0;
          translate.value = withSpring(target, SPRING);
        }),
    [fireClose, fireDelete, fireOpen, isOpen, startX, translate],
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.action}>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="删除这笔记录"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
        >
          <Ionicons name="trash-outline" size={18} color={palette.accentInk} />
          <Text style={[type.caption, styles.deleteLabel]}>删除</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_W,
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: palette.accent,
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteLabel: {
    color: palette.accentInk,
    fontWeight: '600',
  },
  content: {
    backgroundColor: palette.paper,
  },
});
