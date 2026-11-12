import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type Kind = 'expense' | 'income';

export type Category = {
  id: string;
  name: string;
  icon: IconName;
};

export type Entry = {
  id: string;
  kind: Kind;
  /** 始终为正数，方向由 kind 决定 */
  amount: number;
  categoryId: string;
  note: string;
  /** YYYY-MM-DD，按本地时区 */
  date: string;
  createdAt: number;
};

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', name: '餐饮', icon: 'restaurant-outline' },
  { id: 'market', name: '买菜', icon: 'basket-outline' },
  { id: 'transport', name: '交通', icon: 'subway-outline' },
  { id: 'shopping', name: '购物', icon: 'bag-handle-outline' },
  { id: 'home', name: '居住', icon: 'home-outline' },
  { id: 'fun', name: '娱乐', icon: 'game-controller-outline' },
  { id: 'health', name: '医疗', icon: 'medkit-outline' },
  { id: 'study', name: '学习', icon: 'book-outline' },
  { id: 'social', name: '人情', icon: 'gift-outline' },
  { id: 'other', name: '其他', icon: 'ellipsis-horizontal' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: '工资', icon: 'card-outline' },
  { id: 'bonus', name: '奖金', icon: 'trophy-outline' },
  { id: 'side', name: '兼职', icon: 'briefcase-outline' },
  { id: 'redpack', name: '红包', icon: 'mail-open-outline' },
  { id: 'other-in', name: '其他', icon: 'ellipsis-horizontal' },
];

export const categoriesFor = (kind: Kind): Category[] =>
  kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function categoryOf(id: string): Category {
  return (
    ALL_CATEGORIES.find((c) => c.id === id) ?? {
      id,
      name: '其他',
      icon: 'ellipsis-horizontal',
    }
  );
}
