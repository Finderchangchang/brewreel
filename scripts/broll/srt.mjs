// 解析 SRT：认 BOM、CRLF、多行字幕、段与段之间的空行。句子号按出现顺序编成 c1、c2…
const TS = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

const msOf = (h, m, s, frac) => {
  const digits = String(frac).padEnd(3, '0').slice(0, 3);
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(digits);
};

export const parseSrt = (raw) => {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const cues = [];
  blocks.forEach((block, i) => {
    const lines = block.split('\n');
    let tsAt = lines.findIndex((l) => TS.test(l));
    if (tsAt < 0) {
      if (/^\d+$/.test(lines[0] ?? '') && lines.length === 1) return;
      throw new Error(`字幕第 ${i + 1} 段没有时间轴。每段要有「00:00:01,000 --> 00:00:02,000」这样一行。`);
    }
    const m = TS.exec(lines[tsAt]);
    const body = lines.slice(tsAt + 1).map((l) => l.trim()).filter((l) => l.length > 0);
    const startMs = msOf(m[1], m[2], m[3], m[4]);
    const endMs = msOf(m[5], m[6], m[7], m[8]);
    if (!(endMs > startMs)) throw new Error(`字幕第 ${i + 1} 段的结束时间不晚于开始时间。`);
    cues.push({id: `c${cues.length + 1}`, index: cues.length + 1, startMs, endMs, text: body.join('\n')});
  });
  return cues;
};

export const formatCues = (cues) =>
  cues
    .map((c) => {
      const dur = ((c.endMs - c.startMs) / 1000).toFixed(2);
      const text = c.text.replace(/\s*\n\s*/g, ' / ');
      return `${c.id}  ${dur} 秒  ${text}`;
    })
    .join('\n');
