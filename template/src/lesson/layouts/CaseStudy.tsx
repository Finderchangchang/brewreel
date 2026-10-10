import React from 'react';
import type {MascotPose, MascotWardrobe} from '../mascot';
import {Character, POSES} from '../mascot';
import {resolveLook} from '../mascot/cast.mjs';
import {TYPE} from '../stage.mjs';
import {CASE_LABEL} from '../layout-guards.mjs';
import type {LayoutProps} from './shared';
import {Card, ContentFrame, PageBody, Reveal, colorsOf, pick, protectBreaks, showFor, textOf, useFrame, useOrientation} from './shared';
import {Icon, emphasized} from './pro';

const poseOf = (value: unknown): MascotPose => (POSES as readonly string[]).includes(String(value)) ? value as MascotPose : 'explain';

function rolesOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{name: textOf(row.name), role: textOf(row.role), look: textOf(row.look), pose: poseOf(row.pose)}];
  });
}

function linesOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const who = row.who === 1 ? 1 : 0;
    return [{who, text: textOf(row.text)}];
  });
}

const Face: React.FC<{look: string; pose: MascotPose; domain?: string; flip?: boolean; ink: string; surface: string; size: number}> = ({look, pose, domain, flip, ink, surface, size}) => {
  const resolved = resolveLook({preset: look}, domain);
  const wardrobe: MascotWardrobe = {
    preset: resolved.preset as MascotWardrobe['preset'],
    hair: resolved.hair,
    accessory: resolved.accessory,
    facialHair: resolved.facialHair,
    outfit: resolved.outfit as MascotWardrobe['outfit'],
  };
  return <div style={{position:'relative', width:size, height:size, borderRadius:'50%', overflow:'hidden', background:surface, border:`3px solid ${ink}`, transform: flip ? 'scaleX(-1)' : undefined, flex:'0 0 auto'}}>
    <Character pose={pose} fromPose={pose} progress={1} mouth={0} blink={0} elapsedMs={0} wardrobe={wardrobe} ink={ink} surface={surface} crop="bust" frameWidth={size} frameHeight={size} />
  </div>;
};

export const CaseStudy: React.FC<LayoutProps> = ({page, fields, theme, lang, domain}) => {
  const frame = useFrame();
  const vert = useOrientation() === 'vertical';
  const t = colorsOf(theme);
  const roles = rolesOf(fields.roles);
  const lines = linesOf(fields.lines);
  const payOn = Boolean(textOf(fields.payLabel) && textOf(fields.payAmount));
  const lastLine = Math.max(0, lines.length - 1);
  const paySeen = showFor(page, lastLine, frame) > 0.02;
  const rowCount = Math.max(1, lines.length);
  const rowBudget = Math.floor((560 - 32 - 44 - Math.max(0, rowCount - 1) * 10 - (payOn ? 56 : 0)) / rowCount);
  const stacked = !vert && rowBudget >= TYPE.caseFace + 52;
  const namePx = stacked ? 30 : 22;
  const rolePx = stacked ? 26 : 20;
  const caption = stacked ? 72 : 26;
  const face = vert ? 72 : Math.min(TYPE.caseFace, Math.max(64, rowBudget - caption));
  return <ContentFrame>
    <PageBody>
      <div style={{width:'100%', display:'flex', flexDirection: vert ? 'column' : 'row', alignItems:'flex-start', gap: vert ? 10 : 16}}>
        <Card theme={theme} style={{flex:'0 0 auto', width: vert ? '100%' : 1010, height: vert ? undefined : 560, padding: vert ? '12px 14px' : '16px 24px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, paddingBottom:8, borderBottom:`1px dashed ${t.line}`, fontSize:26, fontWeight:700, color:t.accent, letterSpacing:1}}>
            <Icon name="users" size={28} color={t.accent} />
            <span>{pick(lang, CASE_LABEL, 'Story · people are fictional')}</span>
          </div>
          <div style={{flex:'0 0 auto', display:'flex', flexDirection:'column', justifyContent:'flex-start', gap: vert ? 10 : 10, paddingTop:8}}>
            {lines.map((line, index) => {
              const who = roles[line.who] ?? roles[0];
              const right = line.who === 1;
              return <Reveal key={index} page={page} index={index} frame={frame} fallbackAtEnd>
                <div style={{display:'flex', flexDirection: right ? 'row-reverse' : 'row', alignItems:'center', gap:12}}>
                  {who ? <div style={{width:face, textAlign:'center', flex:'0 0 auto'}}>
                    <Face look={who.look} pose={who.pose} domain={domain} flip={right} ink={t.ink} surface={t.surface} size={face} />
                    {stacked ? <>
                      <b style={{display:'block', marginTop:4, fontSize:namePx, lineHeight:1.2, color:t.ink}}>{protectBreaks(who.name)}</b>
                      <small style={{display:'block', fontSize:rolePx, lineHeight:1.2, color:t.muted}}>{protectBreaks(who.role)}</small>
                    </> : <b style={{display:'block', marginTop:2, fontSize:namePx, lineHeight:1.15, color:t.ink}}>{protectBreaks(who.name)} <small style={{fontWeight:500, color:t.muted}}>{protectBreaks(who.role)}</small></b>}
                  </div> : null}
                  <div style={{display:'flex', flexDirection:'column', alignItems: right ? 'flex-end' : 'flex-start', gap:8, minWidth:0}}>
                    <div style={{fontFamily:t.fontBody, fontWeight:600, fontSize: vert ? 30 : TYPE.caseBubble, lineHeight:1.35, padding:'12px 18px', borderRadius:t.radius, background: right ? t.accent : t.accentSoft, color: right ? t.surface : t.ink, wordBreak:'normal'}}>{protectBreaks(line.text)}</div>
                    {payOn && index === lastLine && paySeen ? <div style={{display:'flex', alignItems:'center', gap:10, padding:'6px 14px', border:t.cardBorder, borderRadius:t.radius, background:t.surface}}>
                      <span style={{width:36, height:36, borderRadius:18, background:t.accent2, color:t.surface, display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name="money" size={22} color={t.surface} /></span>
                      <span style={{fontSize:30, color:t.muted}}>{protectBreaks(textOf(fields.payLabel))}</span>
                      <b style={{fontFamily:t.fontNumber, fontWeight:800, fontSize:32, color:t.ink}}>{protectBreaks(textOf(fields.payAmount))}</b>
                    </div> : null}
                  </div>
                </div>
              </Reveal>;
            })}
          </div>
        </Card>
        {!vert ? <div style={{width:28, alignSelf:'center', height:2, background:t.deco, position:'relative', flex:'0 0 auto'}}>
          <i style={{position:'absolute', right:-6, top:-6, borderTop:'7px solid transparent', borderBottom:'7px solid transparent', borderLeft:`10px solid ${t.deco}`}} />
        </div> : null}
        <Reveal page={page} index={lines.length} frame={frame} fallbackAtEnd style={{flex:'0 0 auto', width: vert ? '100%' : 560, marginTop: vert ? 0 : 60, display:'flex'}}>
          <Card theme={theme} style={{flex:1, padding: vert ? '14px 16px' : '28px 28px', borderTop:`10px solid ${t.alert}`, display:'flex', flexDirection:'column', justifyContent:'flex-start'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, fontSize:30, fontWeight:800, color:t.alert, letterSpacing:2}}>
              <Icon name={textOf(fields.verdictIcon)} size={36} color={t.alert} />
              {protectBreaks(textOf(fields.verdictLabel))}
            </div>
            <div style={{marginTop:14, fontFamily:t.fontHeading, fontWeight:800, fontSize: vert ? 32 : TYPE.caseVerdict, lineHeight:1.35, color:t.ink, wordBreak:'normal'}}>
              {emphasized(textOf(fields.verdictText), textOf(fields.verdictEmphasis), {color:t.alert})}
            </div>
            <i style={{display:'block', width:72, height:3, background:t.deco, marginTop:16}} />
          </Card>
        </Reveal>
      </div>
    </PageBody>
  </ContentFrame>;
};
