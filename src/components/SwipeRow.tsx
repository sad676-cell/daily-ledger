import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, type } from '../theme';

/** 露出的删除按钮宽度 */
const ACTION_W = 80;
/** 一路滑到底（超过这个距离）松手就直接删，不用再点 */
const FULL_SWIPE = ACTION_W + 96;

type Props = {
  children: ReactNode;
  /** 由父级统一管理，保证同时只有一行是打开的 */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export function SwipeRow({ children, open, onOpen, onClose, onDelete }: Props) {
  const tx = useRef(new Animated.Value(0)).current;
  /** 手势开始时行的位置，跟手过程中 + dx 得到实时位置 */
  const startX = useRef(0);
  const current = useRef(0);
  const startedOpen = useRef(false);

  // PanResponder 只创建一次，回调通过 ref 拿最新的值，避免闭包读到旧状态
  const openRef = useRef(open);
  openRef.current = open;
  const cb = useRef({ onOpen, onClose, onDelete });
  cb.current = { onOpen, onClose, onDelete };

  const settle = (to: number, notify = true) => {
    current.current = to;
    Animated.timing(tx, {
      toValue: to,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (!notify) return;
    if (to === 0) cb.current.onClose();
    else cb.current.onOpen();
  };

  // 外部关掉（打开另一行、切换月份、开始滚动列表）
  useEffect(() => {
    const target = open ? -ACTION_W : 0;
    if (Math.abs(current.current - target) < 0.5) return;
    current.current = target;
    Animated.timing(tx, {
      toValue: target,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, tx]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 已经滑开时，点一下这一行应该先收起，而不是进编辑页
        onStartShouldSetPanResponderCapture: () => openRef.current,
        // 只有明确的横向滑动才从子级（Pressable）手里抢走手势，不影响竖向滚动
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderGrant: () => {
          startedOpen.current = openRef.current;
          tx.stopAnimation((v) => {
            startX.current = v;
            current.current = v;
          });
        },
        onPanResponderMove: (_e, g) => {
          const raw = startX.current + g.dx;
          // 右边到头是 0（露出一点点阻尼），左边最多再多拖 40
          const next = Math.min(0, Math.max(raw, -FULL_SWIPE - 40));
          current.current = next;
          tx.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const cur = current.current;
          const moved = Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;

          // 滑开后轻点一下：收起
          if (!moved && startedOpen.current) {
            settle(0);
            return;
          }

          // 一路滑到底：直接删掉
          if (cur <= -FULL_SWIPE) {
            current.current = 0;
            tx.setValue(0);
            cb.current.onDelete();
            return;
          }

          const flingLeft = g.vx < -0.35;
          const flingRight = g.vx > 0.35;
          settle(!flingRight && (flingLeft || cur < -ACTION_W / 2) ? -ACTION_W : 0);
        },
        onPanResponderTerminate: () => {
          settle(current.current < -ACTION_W / 2 ? -ACTION_W : 0);
        },
      }),
    [tx],
  );

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

      <Animated.View
        style={[styles.content, { transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
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
