// 角色卡 3 秒动画：说一句话、眨一次眼、换一次手势。给 Remotion 和测试共用。
import {mouthOpenAmount} from '../../template/src/lesson/mascot/motion.mjs';

export const CARD_FPS = 30;
export const CARD_FRAMES = 90;
export const CARD_LINE = '大家好，我是讲解员。';

export const POSE_LABELS = {
  explain: '讲解',
  point: '指向',
  check: '勾选',
  warn: '提醒',
  think: '思考',
  affirm: '肯定',
  cheer: '加油',
  wave: '挥手',
};

const CHARS = [
  {text: '大', startMs: 400, endMs: 520},
  {text: '家', startMs: 520, endMs: 640},
  {text: '好', startMs: 640, endMs: 760},
  {text: '，', startMs: 760, endMs: 860},
  {text: '我', startMs: 860, endMs: 980},
  {text: '是', startMs: 980, endMs: 1100},
  {text: '讲', startMs: 1100, endMs: 1220},
  {text: '解', startMs: 1220, endMs: 1340},
  {text: '员', startMs: 1340, endMs: 1460},
  {text: '。', startMs: 1460, endMs: 1560},
];
const SENTENCE_END = 1560;
const BLINK_START = 180;
const BLINK_END = 310;
const GESTURE_START = 1700;
const GESTURE_END = 2000;

export function cardFrameState(frame) {
  const elapsedMs = Math.max(0, frame) * 1000 / CARD_FPS;
  const blink = elapsedMs >= BLINK_START && elapsedMs < BLINK_END ? 1 : 0;
  const mouth = mouthOpenAmount(CHARS, elapsedMs, 0, SENTENCE_END);
  let pose = 'explain';
  let fromPose = 'explain';
  let progress = 1;
  if (elapsedMs >= GESTURE_END) {
    pose = 'point';
    fromPose = 'explain';
    progress = 1;
  } else if (elapsedMs >= GESTURE_START) {
    pose = 'point';
    fromPose = 'explain';
    progress = (elapsedMs - GESTURE_START) / (GESTURE_END - GESTURE_START);
  }
  return {pose, fromPose, progress, mouth, blink, elapsedMs, line: CARD_LINE};
}
