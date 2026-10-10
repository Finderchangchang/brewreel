export const ICON_NAMES: readonly [
  'percent', 'card', 'document', 'chat', 'bank', 'clock', 'shield', 'scale',
  'phone', 'check', 'warning', 'user', 'users', 'calendar', 'money', 'search', 'flag', 'cross',
];

export type IconShape = {
  t: string;
  cx?: number;
  cy?: number;
  r?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  d?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
};

export const ICON_SHAPES: Record<string, IconShape[]>;
export function isIconName(name: string): name is (typeof ICON_NAMES)[number];
