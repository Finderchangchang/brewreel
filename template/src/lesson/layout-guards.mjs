/** H–O 版式的纯校验。组件和 validate-lesson 共用这些常量，避免两边各写一套。 */
export {TIMELINE_FRAME, timelineClipIssues, timelineFrameLayout} from '../../../scripts/lesson/timeline-frame.mjs';

export const CASE_LABEL = '案例 · 人物均为虚构';

export const SAYING_LAW_RE = /第\s*[0-9０-９〇零一二三四五六七八九十百千]+\s*条|《[^》]{0,30}法》/u;

export const DOCUMENT_BRANDS = Object.freeze([
  '微信', 'WeChat', 'QQ', '支付宝', 'Alipay', '云闪付', '钉钉', '飞书', '抖音', '淘宝', '京东', '美团', '拼多多',
  '工商银行', '建设银行', '农业银行', '中国银行', '招商银行', '交通银行', '浦发银行', '民生银行', '兴业银行',
  '中信银行', '光大银行', '平安银行', '邮储银行', '网商银行', '微众银行', 'PayPal', 'Apple Pay', '银联',
  '花呗', '借呗', '微信支付',
]);

export const BASIS_RE = /^《[^》]{1,40}》\s*第[0-9０-９〇零一二三四五六七八九十百千]+条(?:\s*[；;]\s*《[^》]{1,40}》\s*第[0-9０-９〇零一二三四五六七八九十百千]+条)*$/u;

const BASIS_PART = /《([^》]+)》\s*第([0-9０-９〇零一二三四五六七八九十百千]+)条/gu;

export function basisCitations(text) {
  return [...String(text ?? '').matchAll(BASIS_PART)].map((match) => ({book: match[1], number: match[2]}));
}

export function sayingLawHit(text) {
  const found = String(text ?? '').match(SAYING_LAW_RE);
  return found ? found[0] : '';
}

export function documentBrandHit(text) {
  const raw = String(text ?? '');
  const folded = raw.toLowerCase();
  return DOCUMENT_BRANDS.find((name) => raw.includes(name) || folded.includes(name.toLowerCase())) ?? '';
}

export function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
