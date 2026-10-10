import React from 'react';
import {TYPE} from '../stage.mjs';
import type {LayoutProps} from './shared';
import {ContentFrame, TitleLines, colorsOf, pick, protectBreaks, textOf, useHeadingEmphasis, useOrientation, usePageReserve} from './shared';
import {Icon} from './pro';

// i18n-ignore 章节序数，只拼进 pick 的中文参数
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const chapterWord = (n: number) => {
  if (n >= 0 && n <= 10) return CN[n];
  if (n < 20) return `${CN[10]}${CN[n - 10]}`;
  return String(n);
};

const pointRows = (value: unknown) => Array.isArray(value) ? value : [];

export const Chapter: React.FC<LayoutProps> = ({page, fields, theme, lang, chapterTitles = []}) => {
  const vert = useOrientation() === 'vertical';
  const reserve = usePageReserve();
  const t = colorsOf(theme);
  const n = page.chapterIndex + 1;
  const total = Math.max(chapterTitles.length, n);
  const titles = chapterTitles.length ? chapterTitles : [page.chapterTitle || page.title];
  const name = page.title;
  const kicker = textOf(fields.kicker);
  const note = textOf(fields.subtitle);
  const points = pointRows(fields.points);
  const nameSize = vert ? 56 : TYPE.chapterTitle;
  const emphasis = useHeadingEmphasis(name, nameSize);
  const indexSize = vert ? 160 : TYPE.chapterNum;
  if (!vert) {
    const rowH = 96;
    const pointsTop = 520;
    return <div style={{position:'absolute', inset:0}}>
      <div style={{position:'absolute', left:0, top:0, width:820, height:1080, background:t.accent, color:'#FFFFFF', overflow:'hidden'}}>
        <div style={{position:'absolute', left:104, top:200, fontFamily:t.fontHeading, fontWeight:700, fontSize:36, letterSpacing:4}}>{pick(lang, `第${chapterWord(n)}章`, `Chapter ${n}`)}</div>
        <div style={{position:'absolute', left:104, top:330, fontFamily:t.fontNumber, fontWeight:800, fontSize:indexSize, lineHeight:0.9, letterSpacing:-4}}>{String(n).padStart(2, '0')}</div>
        <div style={{position:'absolute', left:104, top:820, width:580}}>
          <div style={{textAlign:'right', fontFamily:t.fontNumber, fontSize:30, marginBottom:10}}>{n} / {total}<span style={{marginLeft:8, letterSpacing:2}}>{pick(lang, '章', 'ch')}</span></div>
          <div style={{display:'flex', gap:8}}>
            {titles.map((title, index) => <i key={`${index}-${title}`} style={{flex:1, height: index === page.chapterIndex ? 8 : 4, borderRadius:4, background: index === page.chapterIndex ? '#FFFFFF' : index < page.chapterIndex ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.28)', alignSelf:'center'}} />)}
          </div>
          <div style={{display:'flex', gap:8, marginTop:10}}>
            {titles.map((title, index) => {
              const current = index === page.chapterIndex;
              const label = Array.from(title).length <= 4 ? title : String(index + 1).padStart(2, '0');
              return <span key={`${index}-lab`} style={{flex:1, fontSize:30, lineHeight:1.2, color: current ? '#FFFFFF' : 'rgba(255,255,255,.62)', fontWeight: current ? 700 : 500}}>{current ? `${String(index + 1).padStart(2, '0')} ${pick(lang, '本章', 'Now')}` : protectBreaks(label)}</span>;
            })}
          </div>
        </div>
      </div>
      <div style={{position:'absolute', left:940, top:230, width:860}}>
        {kicker ? <div style={{fontSize:32, fontWeight:700, letterSpacing:2, color:t.accent}}>{protectBreaks(kicker)}</div> : null}
        <TitleLines text={name} maxLines={2} maxEm={860 / Math.max(1, nameSize)} style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:nameSize, lineHeight:1.05, color:t.ink, marginTop:8, ...emphasis.style}} />
        <i style={{display:'block', width:72, height:4, background:t.deco, marginTop:20}} />
        {note ? <div style={{marginTop:16, fontSize:32, lineHeight:1.35, color:t.muted, wordBreak:'normal'}}>{protectBreaks(note)}</div> : null}
      </div>
      {points.map((point, index) => {
        const row = point && typeof point === 'object' ? point as Record<string, unknown> : {};
        const y = pointsTop + index * rowH;
        const rowRight = y + rowH > reserve.y ? reserve.x : 1800;
        return <div key={index} style={{position:'absolute', left:940, top:y, width:Math.max(280, rowRight - 940), height:rowH, display:'flex', alignItems:'center', gap:16, borderTop:`1px solid ${t.line}`}}>
          <span style={{width:56, height:56, borderRadius:'50%', border:t.cardBorder, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto'}}><Icon name={textOf(row.icon)} size={32} color={t.accent} /></span>
          <span style={{fontFamily:t.fontNumber, fontWeight:700, fontSize:30, color:t.deco, width:56}}>{n}.{index + 1}</span>
          <span style={{fontFamily:t.fontHeading, fontWeight:700, fontSize:TYPE.chapterPoint, color:t.ink}}>{protectBreaks(textOf(row.text))}</span>
        </div>;
      })}
    </div>;
  }
  const panel = <div style={{position:'relative', flex: vert ? '0 0 auto' : '0 0 43%', height: vert ? '46%' : '100%', background:t.accent, color:'#FFFFFF', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding: vert ? '20px 24px' : '28px 32px', boxSizing:'border-box'}}>
    <div style={{fontFamily:t.fontHeading, fontWeight:700, fontSize:30, letterSpacing:4, color:'rgba(255,255,255,.86)'}}>{pick(lang, `第${chapterWord(n)}章`, `Chapter ${n}`)}</div>
    <div style={{fontFamily:t.fontNumber, fontWeight:800, fontSize:indexSize, lineHeight:0.9, letterSpacing:-2}}>{String(n).padStart(2, '0')}</div>
    <div>
      <div style={{textAlign:'right', fontFamily:t.fontNumber, fontSize:30, color:'rgba(255,255,255,.9)', marginBottom:10}}>{n} / {total}<span style={{marginLeft:8, fontSize:30, letterSpacing:2}}>{pick(lang, '章', 'ch')}</span></div>
      <div style={{display:'flex', gap:8}}>
        {titles.map((title, index) => <i key={`${index}-${title}`} style={{flex:1, height: index === page.chapterIndex ? 8 : 4, borderRadius:4, background: index === page.chapterIndex ? '#FFFFFF' : index < page.chapterIndex ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.28)', alignSelf:'center'}} />)}
      </div>
      <div style={{display:'flex', gap:8, marginTop:10}}>
        {titles.map((title, index) => {
          const current = index === page.chapterIndex;
          const label = Array.from(title).length <= 4 ? title : String(index + 1).padStart(2, '0');
          return <span key={`${index}-lab`} style={{flex:1, fontSize:30, lineHeight:1.2, color: current ? '#FFFFFF' : 'rgba(255,255,255,.62)', fontWeight: current ? 700 : 500}}>{current ? `${String(index + 1).padStart(2, '0')} ${pick(lang, '本章', 'Now')}` : protectBreaks(label)}</span>;
        })}
      </div>
    </div>
  </div>;
  const body = <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', justifyContent:'center', padding: vert ? '16px 4px 0' : '8px 8px 8px 36px', overflow:'hidden'}}>
    {kicker ? <div style={{fontSize:30, fontWeight:700, letterSpacing:2, color:t.accent}}>{protectBreaks(kicker)}</div> : null}
    <TitleLines text={name} maxLines={vert ? 2 : 3} maxEm={vert ? 12 : 8} style={{fontFamily:t.fontHeading, fontWeight:800, fontSize:nameSize, lineHeight:1.15, color:t.ink, marginTop:8, ...emphasis.style}} />
    <i style={{display:'block', width:72, height:4, background:t.deco, marginTop:16}} />
    {note ? <div style={{marginTop:14, fontSize:30, lineHeight:1.35, color:t.muted, wordBreak:'normal'}}>{protectBreaks(note)}</div> : null}
    {points.length ? <div style={{marginTop:18}}>
      <div style={{fontSize:30, letterSpacing:3, color:t.muted, marginBottom:8}}>{pick(lang, '本章要点', 'In this chapter')}</div>
      {points.map((point, index) => {
        const row = point && typeof point === 'object' ? point as Record<string, unknown> : {};
        const icon = textOf(row.icon);
        const text = textOf(row.text);
        return <div key={index} style={{display:'flex', alignItems:'center', gap:16, height: vert ? 52 : 64, borderTop:`1px solid ${t.line}`}}>
          <span style={{width:48, height:48, borderRadius:'50%', border:t.cardBorder, display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto'}}><Icon name={icon} size={28} color={t.accent} /></span>
          <span style={{fontFamily:t.fontNumber, fontWeight:700, fontSize:30, color:t.deco, width:48}}>{n}.{index + 1}</span>
          <span style={{fontFamily:t.fontHeading, fontWeight:700, fontSize: vert ? 30 : 36, color:t.ink}}>{protectBreaks(text)}</span>
        </div>;
      })}
    </div> : null}
  </div>;
  return <ContentFrame>
    <div style={{width:'100%', height:'100%', display:'flex', flexDirection: vert ? 'column' : 'row', minHeight:0}}>
      {panel}
      {body}
    </div>
  </ContentFrame>;
};
