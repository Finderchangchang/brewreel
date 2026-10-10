import {CutShape, FONT, PaperGrain, fitLine, shadowByHeight, toss, type CustomShotProps} from '../../custom-api';

export default function KeywordToss({slots, theme, t}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  const pose = toss(520).at(t);
  const wobX = Math.sin(t * 8) * 36;
  const wobY = Math.sin(t * 5.5) * 24;
  const sh = shadowByHeight(pose.h, 720);
  const width = 560;
  const height = 240;
  const left = 260 + pose.x + wobX;
  const top = 860 + pose.y + wobY;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        filter: `drop-shadow(${sh.dx}px ${sh.dy}px ${sh.blur}px rgba(40, 30, 20, ${sh.opacity}))`,
      }}
    >
      <CutShape seed={3} w={width} h={height} fill={theme.card} tilt={pose.tilt} shortSide={720}>
        <PaperGrain w={width} h={height} seed={3} opacity={0.22} />
        <div style={{fontFamily: FONT, fontSize: fitLine(word, 400, 80, 40), color: theme.cardText, fontWeight: 760}}>{word}</div>
      </CutShape>
    </div>
  );
}
