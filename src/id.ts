/** 生成一个足够随机的本地 id，离线可用。 */
export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
