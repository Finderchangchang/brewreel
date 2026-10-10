import type {CustomShotProps} from '../../custom-api';

export default function TypeErrorShot({slots, theme}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  const n: number = theme.cardText;
  return (
    <div style={{position: 'absolute', left: 240, top: 800, fontSize: 64, opacity: n ? 1 : 1}}>
      {word}
    </div>
  );
}
