import {createHash} from 'node:crypto';
import fs from 'node:fs';

const sortValue = (v) => {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortValue(v[k]);
    return o;
  }
  return v;
};

/** 键排序后的 JSON，同一份请求永远得到同一串。 */
export const stableString = (value) => JSON.stringify(sortValue(value));

export const sha256Text = (s) => createHash('sha256').update(String(s)).digest('hex');

export const sha256File = (file) => {
  const h = createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
};
