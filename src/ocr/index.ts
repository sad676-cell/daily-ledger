import { requireOptionalNativeModule } from 'expo-modules-core';
import { boxesToLines, OcrBox } from './lines';

export { boxesToLines };
export type { OcrBox };

type NativeOcr = {
  recognizeAsync(uri: string): Promise<string>;
};

/**
 * 原生模块在 modules/ledger-ocr 里（Apple Vision 框架，离线）。
 * 用 optional 版本：网页预览、或还没重新打包的旧安装包里它是 null，
 * 这时界面退回「粘贴文字」，不会崩。
 */
const native = requireOptionalNativeModule<NativeOcr>('LedgerOcr');

export const ocrAvailable = native != null;

export async function recognizeImage(uri: string): Promise<OcrBox[]> {
  if (!native) {
    throw new Error('这个安装包不含本地识别，需要重新构建后安装');
  }
  const json = await native.recognizeAsync(uri);
  const raw = JSON.parse(json);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is OcrBox =>
      item &&
      typeof item.text === 'string' &&
      typeof item.x === 'number' &&
      typeof item.y === 'number' &&
      typeof item.width === 'number' &&
      typeof item.height === 'number',
  );
}
