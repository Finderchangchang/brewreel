import {FONT, MONO, fitLine, type CustomShotProps} from '../../custom-api';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export default function GrowBar({slots, theme, geo, t}: CustomShotProps) {
  const label = typeof slots.label === 'string' ? slots.label : '';
  const unit = typeof slots.unit === 'string' ? slots.unit : '';
  const from = num(slots.from);
  const to = num(slots.to);
  const u = Math.min(1, Math.max(0, t / 1.6));
  const eased = 1 - Math.pow(1 - u, 3);
  const n = Math.round(from + (to - from) * eased);
  const wobX = Math.sin(t * 8) * 32;
  const wobY = Math.sin(t * 5.5) * 22;
  const left = geo.safe.x0 + 40 + wobX;
  const top = geo.safe.y0 + 200 + wobY;
  const track = 600;
  const fill = track * (0.18 + 0.72 * eased) * (0.62 + 0.38 * Math.sin(t * 8));
  return (
    <div style={{position: 'absolute', left, top, width: track + 40}}>
      <div style={{fontFamily: FONT, fontSize: fitLine(label, 560, 48, 36), color: theme.cardText, fontWeight: 700}}>{label}</div>
      <div style={{marginTop: 16, fontFamily: MONO, fontSize: 96, color: theme.accentInk, fontWeight: 760, lineHeight: 1}}>
        {String(n)}
        {unit}
      </div>
      <div style={{marginTop: 28, width: track, height: 28, borderRadius: 14, background: theme.line}}>
        <div style={{width: Math.max(24, fill), height: 28, borderRadius: 14, background: theme.accent}} />
      </div>
    </div>
  );
}
