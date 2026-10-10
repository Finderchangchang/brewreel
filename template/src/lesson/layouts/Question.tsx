import React from 'react';
import {fitBlockFont, TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, Reveal, TitleLines, colorsOf, listOf, pick, protectBreaks, showFor, textOf, useFrame, useHeadingEmphasis, useOrientation} from './shared';
import {Icon} from './pro';

const PUNCT = /[，。、；：！？,.!?;:（）()【】《》"'“”‘’…—\-·]/u;

const Struck: React.FC<{text: string; on: boolean; color: string}> = ({text, on, color}) => {
  if (!on) return <>{protectBreaks(text)}</>;
  const nodes: React.ReactNode[] = [];
  let buf = '';
  let strike = false;
  const flush = () => {
    if (!buf) return;
    nodes.push(strike
      ? <span key={nodes.length} style={{position:'relative', display:'inline-block'}}>{protectBreaks(buf)}<i style={{position:'absolute', left:0, right:0, top:'54%', height:4, background:color, borderRadius:1}} /></span>
      : <span key={nodes.length}>{protectBreaks(buf)}</span>);
    buf = '';
  };
  for (const ch of Array.from(text)) {
    const plain = PUNCT.test(ch);
    if (buf && plain === strike) flush();
    strike = !plain;
    buf += ch;
  }
  flush();
  return <>{nodes}</>;
};

export const Question: React.FC<LayoutProps> = ({page, fields, theme, lang}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const options = listOf(fields.options);
  const answer = fields.answer;
  const revealed = showFor(page, 1, frame) >= 1;
  const correct = (value: string, index: number) => revealed && (String(answer) === String(index) || answer === value);
  const asked = textOf(fields.question) || page.title;
  const qSize = vert ? 48 : fitBlockFont({chars: Array.from(asked).length, width: 680, maxFont: 48, lineHeight: 1.25, maxHeight: 140});
  const emphasis = useHeadingEmphasis(asked, qSize);
  const note = textOf(fields.answerText);
  const cols = Math.max(1, options.length);
  return <ContentFrame>
    <PageBody style={{gap: vert ? 12 : 16, width:'100%', height:'100%'}}>
      {vert ? <Reveal page={page} index={0} frame={frame} fallbackAtEnd>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span style={{color:t.surface, background:t.accent, padding:'4px 12px', borderRadius:t.badgeRadius, fontSize:30, fontWeight:700}}>{pick(lang, '随堂小测', 'Quiz')}</span>
        </div>
        <TitleLines text={asked} maxLines={3} maxEm={680 / Math.max(1, emphasis.fontPx)} style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:qSize, lineHeight:1.25, color:t.ink, ...emphasis.style}} />
      </Reveal> : null}
      <div style={{display:'grid', alignItems:'start', gridTemplateColumns: vert ? '1fr' : `repeat(${cols}, minmax(0, 1fr))`, gap: vert ? 12 : 20}}>
        {options.map((value, index) => {
          const hit = correct(value, index);
          const dim = revealed && !hit;
          const letter = String.fromCharCode(65 + index);
          const letterBox = vert ? 56 : TYPE.questionLetter;
          return <Reveal key={`${letter}-${value}`} page={page} index={0} frame={frame} fallbackAtEnd style={{display:'flex'}}>
            <Card theme={theme} shadow={!dim} style={{position:'relative', flex:1, height: vert ? undefined : 440, padding: vert ? '16px 18px' : '36px 28px 28px', display:'flex', flexDirection: vert ? 'row' : 'column', alignItems: vert ? 'center' : 'flex-start', gap: vert ? 16 : 20, border: hit ? `3px solid ${t.ok}` : t.cardBorder, background: t.surface, overflow:'visible'}}>
              <span style={{width: letterBox, height: letterBox, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto', fontFamily:t.fontNumber, fontWeight:800, fontSize: vert ? 32 : 48, color: hit ? t.surface : t.muted, background: hit ? t.ok : 'transparent', border: hit ? 'none' : `3px solid ${t.line}`}}>{letter}</span>
              <div style={{fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 32 : TYPE.questionOption, lineHeight:1.4, color: hit ? t.ok : dim ? t.muted : t.ink, wordBreak:'normal'}}>
                <Struck text={value} on={dim} color={t.muted} />
              </div>
              {hit ? <Icon name="check" size={vert ? 48 : 56} color={t.ok} /> : null}
              {hit ? <span style={{position:'absolute', left: vert ? undefined : 28, right: vert ? 16 : undefined, bottom: vert ? 12 : -24, color:t.surface, background:t.ok, padding:'4px 14px', borderRadius:t.badgeRadius, fontSize:26, fontWeight:700, letterSpacing:2}}>{pick(lang, '正确', 'Correct')}</span> : null}
            </Card>
          </Reveal>;
        })}
      </div>
      {note ? <Reveal page={page} index={1} frame={frame} fallbackAtEnd>
        <div style={{fontFamily:t.fontBody, fontSize:30, lineHeight:1.35, color: revealed ? t.ink : t.muted, wordBreak:'normal'}}>{protectBreaks(note)}</div>
      </Reveal> : null}
    </PageBody>
  </ContentFrame>;
};
