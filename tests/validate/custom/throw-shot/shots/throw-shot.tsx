import type {CustomShotProps} from '../../custom-api';

export default function ThrowShot({slots}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  if (word.length >= 0) throw new Error('boom');
  return null;
}
