import type {CustomShotProps} from '../../custom-api';

export default function Overflow({slots, theme, t}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  const wob = Math.sin(t * 8) * 40;
  return (
    <div>
      <div style={{position: 'absolute', left: 0, top: 800, fontSize: 64, color: theme.cardText}}>{word}</div>
      <div style={{position: 'absolute', left: 220, top: 780 + wob, width: 640, height: 220, background: theme.card}} />
    </div>
  );
}
