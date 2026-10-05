// counter：数字。一张大卡用满取景框：上面一枚标签（槽位 label，原话），中间是大号数字，下面一根进度条跟着数字走。
// 数字在念到最后一个数字字的那一刻落定，落定时鼓一下、炸开一圈小形状。有旧值（from）时旧值一直亮着，落定前被一笔划掉、往新值滚。
// 屏幕上的数只有原话里的 say / from（由脚本解析好，原样显示前后缀），不画算出来的降幅、百分比。
import React from 'react';
import {Easing} from 'remotion';
import {rgba, type MotionPalette} from './palette';
import {Burst, Card, bump, fitFont, prog, springAt, textEm} from './parts';
import {counterClock, counterValue} from './timing';
import type {CounterData, CounterMarks} from './types';

/** 显示用的数：小数位按原话，整数部分超过 4 位加千分位 */
export const numText = (v: number, dec: number) => {
  const [ip, fp] = Math.abs(v).toFixed(dec).split('.');
  return (v < 0 ? '-' : '') + (ip.length > 4 ? ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ip) + (fp ? '.' + fp : '');
};

const PRE_K = 0.55;
const SUF_K = 0.42;

export const Counter: React.FC<{data: CounterData; marks: CounterMarks; t: number; dur: number; W: number; H: number; pal: MotionPalette}> = ({data, marks, t, dur, W, H, pal}) => {
  const {say, from, label} = data;
  const hasFrom = !!from && from.value !== say.value;
  const dec = Math.max(0, Math.min(2, Math.max(say.decimals ?? 0, hasFrom ? from!.decimals ?? 0 : 0)));
  /** 旧值按它自己在原话里的写法（「七块钱」显示 7 元，不跟着新值写成 7.0） */
  const fromDec = hasFrom ? Math.max(0, Math.min(2, from!.decimals ?? 0)) : 0;
  const prefix = say.prefix || (hasFrom ? from!.prefix : '') || '';
  const suffix = say.suffix || (hasFrom ? from!.suffix : '') || '';
  const clock = counterClock(Number.isFinite(marks.sayAt) ? marks.sayAt : marks.say, hasFrom, dur);
  const value = counterValue(t, clock, say.value, hasFrom ? from!.value : 0);
  const landed = t >= clock.land;

  // 版面：卡片宽用满（横版收到高的 1.5 倍），数字字号按最长的那一串定，高度不超过取景框四成多
  const cardW = Math.min(W, H * 1.5);
  const pad = Math.max(36, cardW * 0.06);
  const innerW = cardW - pad * 2;
  const longest = [numText(say.value, dec), hasFrom ? numText(from!.value, dec) : ''].sort((a, b) => b.length - a.length)[0];
  const numEm = textEm(longest) + (prefix ? textEm(prefix) * PRE_K : 0) + (suffix ? textEm(suffix) * SUF_K + 0.1 : 0);
  const labelSize = Math.min(Math.max(48, H * 0.09), fitFont(label ?? '', innerW * 0.8, 100, 36));
  const barH = Math.max(14, Math.min(28, H * 0.032));
  const restH = labelSize * 1.9 + barH + pad * 2 + H * 0.06;
  const numSize = Math.max(90, Math.min(Math.floor((innerW * 0.94) / numEm), (H - restH) / (hasFrom ? 1.45 : 1.05), 340));
  const oldSize = hasFrom ? Math.round(numSize * 0.36) : 0;
  const cardH = Math.min(H, labelSize * 1.9 + (hasFrom ? oldSize * 1.25 : 0) + numSize * 1.08 + barH + pad * 2 + H * 0.05);
  const cx = (W - cardW) / 2;
  const cy = (H - cardH) / 2;

  const enter = springAt(t, 0, 14, 160);
  const hit = bump(t, clock.land, 0.42);
  const strike = hasFrom ? prog(t, clock.start - 0.05, 0.3, Easing.out(Easing.quad)) : 0;
  // 进度条只是跟着数字动的装饰：没有旧值时从空到满；有旧值时两头按两个数的大小比例（都是原话里的数）
  const max = Math.max(Math.abs(say.value), hasFrom ? Math.abs(from!.value) : 0) || 1;
  const barFrom = hasFrom ? Math.abs(from!.value) / max : 0;
  const barTo = Math.abs(say.value) / max;
  const a0 = hasFrom ? from!.value : 0;
  const frac = say.value === a0 ? 1 : Math.max(0, Math.min(1, (value - a0) / (say.value - a0)));
  const barP = barFrom + (barTo - barFrom) * frac;
  const numY = cy + pad + labelSize * 1.9 + (hasFrom ? oldSize * 1.25 : 0);

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, enter * 1.6), transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`, transformOrigin: `${W / 2}px ${H / 2}px`}}>
        <Card pal={pal} x={cx} y={cy} w={cardW} h={cardH} index={1}>
          {/* 标签（原话） */}
          <div style={{position: 'absolute', left: 0, top: pad * 0.85, width: cardW, height: labelSize * 1.6, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: labelSize * 0.4, fontSize: labelSize, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap'}}>
              <span style={{width: labelSize * 0.38, height: labelSize * 0.38, borderRadius: pal.look === 'wood' ? labelSize * 0.08 : '50%', background: pal.cool, flex: 'none'}} />
              {label}
              <span style={{width: labelSize * 0.38, height: labelSize * 0.38, borderRadius: pal.look === 'wood' ? labelSize * 0.08 : '50%', background: pal.warm, flex: 'none'}} />
            </div>
          </div>
          {/* 旧值（原话里说了）：一直亮着，开始滚时被划掉 */}
          {hasFrom ? (
            <div style={{position: 'absolute', left: 0, top: pad + labelSize * 1.9 - oldSize * 0.1, width: cardW, height: oldSize * 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
              <div style={{position: 'relative', fontSize: oldSize, fontWeight: 800, color: rgba(pal.sub, 0.9), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
                {from!.prefix || prefix}
                {numText(from!.value, fromDec)}
                {from!.suffix || suffix}
                <div style={{position: 'absolute', left: '-6%', top: '52%', height: Math.max(6, oldSize * 0.11), width: `${112 * strike}%`, borderRadius: oldSize * 0.06, background: pal.look === 'ink' ? pal.ink : pal.accent, transform: 'rotate(-4deg)', transformOrigin: '0 50%'}} />
              </div>
            </div>
          ) : null}
          {/* 大数字 */}
          <div style={{position: 'absolute', left: 0, top: numY - cy, width: cardW, height: numSize * 1.08, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                fontWeight: 900,
                color: pal.ink,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                transform: `scale(${1 + 0.07 * hit})`,
                textShadow: pal.look === 'paper' ? `${numSize * 0.03}px ${numSize * 0.03}px 0 ${pal.warm}` : pal.look === 'wood' ? `0 ${numSize * 0.025}px 0 ${pal.edge}` : 'none',
              }}
            >
              {prefix ? <span style={{fontSize: numSize * PRE_K, marginRight: numSize * 0.04}}>{prefix}</span> : null}
              <span style={{fontSize: numSize, color: landed ? pal.ink : rgba(pal.ink, 0.92)}}>{numText(value, dec)}</span>
              {suffix ? <span style={{fontSize: numSize * SUF_K, marginLeft: numSize * 0.06}}>{suffix}</span> : null}
            </div>
          </div>
          {/* 进度条：跟着数字走 */}
          <div style={{position: 'absolute', left: pad * 1.2, width: cardW - pad * 2.4, top: cardH - pad - barH, height: barH, borderRadius: barH / 2, background: rgba(pal.sub, 0.16), overflow: 'hidden'}}>
            <div style={{width: `${Math.max(0, Math.min(1, barP)) * 100}%`, height: '100%', borderRadius: barH / 2, background: `linear-gradient(90deg, ${pal.cool}, ${pal.accent})`}} />
          </div>
        </Card>
        <Burst t={t} at={clock.land} x={W / 2} y={numY + numSize * 0.5} radius={Math.min(cardW * 0.48, numSize * 1.6)} pal={pal} count={12} />
      </div>
    </div>
  );
};
