/**
 * 纯函数：把 Vision 的识别结果拼回「一行一段文字」。
 *
 * 不引用任何原生模块，方便在 node 里离线测（见 scripts/parse-check.ts）。
 */

/** Vision 返回的一行原始文字 + 它在图里的像素坐标（原点左上） */
export type OcrBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

type Placed = OcrBox & { cy: number };

/**
 * Vision 会把「11月11日」和「星期三」、「餐饮」和「−30」拆成互不相干的几段，
 * 只按返回顺序拼会把它们打散。所以：
 *   1. 按纵向中心聚成行（同一行的中心差不超过行高的一半）；
 *   2. 行内按横向排序；
 *   3. 间距大的位置补空格，间距小的直接连起来（避免把「−30」拼成「− 30」）。
 */
export function boxesToLines(boxes: OcrBox[]): string[] {
  const placed: Placed[] = boxes
    .map((b) => ({ ...b, text: b.text.trim() }))
    .filter((b) => b.text.length > 0)
    .map((b) => ({ ...b, cy: b.y + b.height / 2 }))
    .sort((a, b) => a.cy - b.cy);

  const rows: Placed[][] = [];
  for (const item of placed) {
    const row = rows[rows.length - 1];
    const last = row?.[row.length - 1];
    if (row && last) {
      const tolerance = Math.max(6, Math.min(last.height, item.height) * 0.6);
      if (Math.abs(item.cy - last.cy) <= tolerance) {
        row.push(item);
        continue;
      }
    }
    rows.push([item]);
  }

  return rows.map((row) => {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const height = Math.max(...sorted.map((i) => i.height), 1);
    let line = sorted[0].text;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const gap = sorted[i].x - (prev.x + prev.width);
      if (gap > height * 0.35) line += ' ';
      line += sorted[i].text;
    }
    return line;
  });
}
