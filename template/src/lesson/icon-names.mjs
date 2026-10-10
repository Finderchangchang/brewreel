/** 线条图标库。版式只认这些名字。形状是 24 坐标，描边由组件统一加。 */
export const ICON_NAMES = Object.freeze([
  'percent', 'card', 'document', 'chat', 'bank', 'clock', 'shield', 'scale',
  'phone', 'check', 'warning', 'user', 'users', 'calendar', 'money', 'search', 'flag', 'cross',
]);

export const ICON_SHAPES = {
  percent: [
    {t: 'circle', cx: 12, cy: 12, r: 9},
    {t: 'line', x1: 8, y1: 16, x2: 16, y2: 8},
    {t: 'circle', cx: 9, cy: 9, r: 1.3},
    {t: 'circle', cx: 15, cy: 15, r: 1.3},
  ],
  card: [
    {t: 'rect', x: 3, y: 5, w: 18, h: 14, rx: 2},
    {t: 'line', x1: 3, y1: 9, x2: 21, y2: 9},
    {t: 'path', d: 'M8 14.5 l2.2 2.2 l4.2 -4.4'},
  ],
  document: [
    {t: 'path', d: 'M7 3 h7 l4 4 v14 h-11 z'},
    {t: 'path', d: 'M14 3 v4 h4'},
    {t: 'line', x1: 9, y1: 12, x2: 15, y2: 12},
    {t: 'line', x1: 9, y1: 16, x2: 15, y2: 16},
  ],
  chat: [
    {t: 'path', d: 'M5 6 h14 v9 h-8 l-3 3 v-3 h-3 z'},
    {t: 'line', x1: 8, y1: 10, x2: 16, y2: 10},
    {t: 'line', x1: 8, y1: 13, x2: 13, y2: 13},
  ],
  bank: [
    {t: 'path', d: 'M4 10 l8 -6 l8 6'},
    {t: 'line', x1: 4, y1: 20, x2: 20, y2: 20},
    {t: 'line', x1: 7, y1: 10, x2: 7, y2: 20},
    {t: 'line', x1: 12, y1: 10, x2: 12, y2: 20},
    {t: 'line', x1: 17, y1: 10, x2: 17, y2: 20},
  ],
  clock: [
    {t: 'circle', cx: 12, cy: 12, r: 8},
    {t: 'path', d: 'M12 8 v5 l3 2'},
  ],
  shield: [
    {t: 'path', d: 'M12 3 l7 3 v5 c0 4 -3 7 -7 8 c-4 -1 -7 -4 -7 -8 v-5 z'},
    {t: 'path', d: 'M9 12 l2 2 l4 -4'},
  ],
  scale: [
    {t: 'line', x1: 12, y1: 4, x2: 12, y2: 20},
    {t: 'line', x1: 7, y1: 20, x2: 17, y2: 20},
    {t: 'path', d: 'M5 8 h14'},
    {t: 'path', d: 'M5 8 l-2 5 h6 z'},
    {t: 'path', d: 'M19 8 l-2 5 h6 z'},
  ],
  phone: [
    {t: 'rect', x: 8, y: 3, w: 8, h: 18, rx: 2},
    {t: 'line', x1: 11, y1: 18, x2: 13, y2: 18},
  ],
  check: [
    {t: 'circle', cx: 12, cy: 12, r: 8},
    {t: 'path', d: 'M8 12.5 l2.5 2.5 l5 -5.5'},
  ],
  warning: [
    {t: 'path', d: 'M12 4 l8 14 h-16 z'},
    {t: 'line', x1: 12, y1: 10, x2: 12, y2: 14},
    {t: 'line', x1: 12, y1: 16.5, x2: 12.01, y2: 16.5},
  ],
  user: [
    {t: 'circle', cx: 12, cy: 8, r: 3},
    {t: 'path', d: 'M6 19 c1.5 -3 3.5 -4.5 6 -4.5 s4.5 1.5 6 4.5'},
  ],
  users: [
    {t: 'circle', cx: 9, cy: 8, r: 2.6},
    {t: 'path', d: 'M3.5 18.5 c.8 -3 2.6 -4.5 5.5 -4.5 s4.7 1.5 5.5 4.5'},
    {t: 'circle', cx: 16.5, cy: 9, r: 2.1},
    {t: 'path', d: 'M14.5 18.5 c.4 -2 1.6 -3.2 3.2 -3.6'},
  ],
  calendar: [
    {t: 'rect', x: 4, y: 6, w: 16, h: 14, rx: 2},
    {t: 'line', x1: 4, y1: 10, x2: 20, y2: 10},
    {t: 'line', x1: 8, y1: 4, x2: 8, y2: 8},
    {t: 'line', x1: 16, y1: 4, x2: 16, y2: 8},
  ],
  money: [
    {t: 'rect', x: 3, y: 6, w: 18, h: 12, rx: 2},
    {t: 'circle', cx: 12, cy: 12, r: 2.5},
  ],
  search: [
    {t: 'circle', cx: 11, cy: 11, r: 6},
    {t: 'line', x1: 15.5, y1: 15.5, x2: 20, y2: 20},
  ],
  flag: [
    {t: 'line', x1: 6, y1: 3, x2: 6, y2: 21},
    {t: 'path', d: 'M6 4 h11 l-2 4 l2 4 h-11'},
  ],
  cross: [
    {t: 'circle', cx: 12, cy: 12, r: 8},
    {t: 'line', x1: 9, y1: 9, x2: 15, y2: 15},
    {t: 'line', x1: 15, y1: 9, x2: 9, y2: 15},
  ],
};

export function isIconName(value) {
  return typeof value === 'string' && ICON_NAMES.includes(value);
}
