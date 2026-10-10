import type {CustomShotProps} from '../../custom-api';

export default function Hardcode({slots}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  return (
    <div style={{position: 'absolute', left: 240, top: 800, fontSize: 64}}>
      {word}你好
    </div>
  );
}
