// counter：数字。一张大卡用满取景框：上面一枚标签（槽位 label，原话），中间是大号数字，下面一根进度条跟着数字走。
// 竖长的框（pip）里卡片至少占框高六成，数字 390–420 参考像素（720 宽时 260–280 像素）。
// 数字在念到最后一个数字字的那一刻落定，落定时鼓一下，卡片后面往上、往两边飞出一小把彩纸（0.8 秒内清完，不压卡片内容）。
// 有旧值（from）：计数的旧值先亮着，落定前 0.6 秒才往新值滚；金额不滚，大数字一直是旧值，落定那一刻翻牌成新值，
// 同时旧值缩到上面一行、被一笔划掉（不出原话里没有的中间价）。金额没有旧值时，数字落定前 0.6 秒才出现。
// 屏幕上的数只有原话里的 say / from（由脚本解析好，原样显示前后缀），不画算出来的降幅、百分比。
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {rgba, type MotionPalette} from './palette';
import {Card, Confetti, bump, fitFont, isTall, prog, quietFloat, springAt, textEm} from './parts';
import {visualTop} from './stage';
import {FLIP, counterClock, counterValue, isMoney} from './timing';
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
  const prefix = say.prefix || (hasFrom ? from!.prefix : '') || '';
  const suffix = say.suffix || (hasFrom ? from!.suffix : '') || '';
  const money = isMoney(prefix, suffix);
  const clock = counterClock(Number.isFinite(marks.sayAt) ? marks.sayAt : marks.say, hasFrom, dur, money);
  const flip = clock.how === 'flip';
  /** 旧值按它自己在原话里的写法（「七块钱」显示 7 元，不跟着新值写成 7.0） */
  const fromDec = hasFrom ? Math.max(0, Math.min(2, from!.decimals ?? 0)) : 0;
  const landed = t >= clock.land;
  // 翻牌时落定前大数字就是旧值，按旧值的小数位写；滚动时按两者里多的那个写，滚的时候位数不跳
  const dec = flip && !landed ? fromDec : Math.max(0, Math.min(2, Math.max(say.decimals ?? 0, hasFrom && !flip ? from!.decimals ?? 0 : 0)));
  const value = counterValue(t, clock, say.value, hasFrom ? from!.value : 0);
  const ink = pal.look === 'ink';
  const tall = isTall(W, H);

  // 版面：卡片宽用满（横版收到高的 1.5 倍），数字字号按最长的那一串定
  const cardW = Math.min(W - 14, H * 1.5);
  const pad = Math.max(36, cardW * 0.06);
  const innerW = cardW - pad * 2;
  const longest = [numText(say.value, dec), hasFrom ? numText(from!.value, fromDec) : ''].sort((a, b) => b.length - a.length)[0];
  const numEm = textEm(longest) + (prefix ? textEm(prefix) * PRE_K : 0) + (suffix ? textEm(suffix) * SUF_K + 0.1 : 0);
  const labelSize = Math.min(tall ? Math.max(72, H * 0.075) : Math.max(48, H * 0.09), fitFont(label ?? '', innerW * 0.8, tall ? 112 : 100, 36));
  const barH = Math.max(14, Math.min(28, H * 0.032));
  const oldK = 0.34;
  const restH = labelSize * 1.9 + barH + pad * 2 + H * 0.06;
  const numSize = Math.max(90, Math.min(Math.floor((innerW * 0.94) / numEm), (H - restH) / (hasFrom ? 1.05 + oldK * 1.25 : 1.05), tall ? 420 : 340));
  const oldSize = hasFrom ? Math.round(numSize * oldK) : 0;
  const natural = labelSize * 1.9 + (hasFrom ? oldSize * 1.25 : 0) + numSize * 1.08 + barH + pad * 2 + H * 0.05;
  const cardH = Math.min(H - 14, Math.max(natural, tall ? H * 0.62 : 0));
  const cx = (W - 14 - cardW) / 2;
  const cy = visualTop(H - 14, cardH);
  // 卡片比内容高时，内容整体在卡片里竖直居中
  const slack = Math.max(0, cardH - natural) / 2;
  const labelY = pad * 0.85 + slack;
  const oldY = pad + labelSize * 1.9 - oldSize * 0.1 + slack;
  const numY = pad + labelSize * 1.9 + (hasFrom ? oldSize * 1.25 : 0) + slack;

  const enter = springAt(t, 0, 14, 160);
  const hit = bump(t, clock.land, 0.42);
  // 旧值那一行：计数一开始就亮着，开始滚时被划掉；金额翻牌那一刻才出现（之前旧值就在大数字的位置上），随即被划掉
  const oldShow = !hasFrom ? 0 : flip ? prog(t, clock.land, 0.2) : 1;
  const strike = !hasFrom ? 0 : flip ? prog(t, clock.land + 0.12, 0.25, Easing.out(Easing.quad)) : prog(t, clock.start - 0.05, 0.3, Easing.out(Easing.quad));
  // 翻牌：落定前 FLIP 秒旧值压扁，落定那一刻新值从扁到满
  const flipY = !flip ? 1 : t < clock.land ? interpolate(t, [clock.land - FLIP, clock.land], [1, 0.05], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad)}) : interpolate(t, [clock.land, clock.land + FLIP], [0.05, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))});
  // 金额没有旧值：落定前 0.6 秒才出现
  const numOpacity = clock.how === 'pop' ? interpolate(t, [clock.start, clock.start + 0.12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  // 进度条只是跟着数字动的装饰：没有旧值时从空到满；有旧值时两头按两个数的大小比例（都是原话里的数）
  const max = Math.max(Math.abs(say.value), hasFrom ? Math.abs(from!.value) : 0) || 1;
  const barFrom = hasFrom ? Math.abs(from!.value) / max : 0;
  const barTo = Math.abs(say.value) / max;
  const a0 = hasFrom ? from!.value : 0;
  const frac = flip ? (landed ? prog(t, clock.land, 0.35) : 0) : say.value === a0 ? 1 : Math.max(0, Math.min(1, (value - a0) / (say.value - a0)));
  const barP = barFrom + (barTo - barFrom) * frac;
  const dotA = ink ? pal.ink : pal.cool;
  const dotB = ink ? pal.accent : pal.warm;
  const bigPrefix = flip && !landed ? from!.prefix || prefix : prefix;
  const bigSuffix = flip && !landed ? from!.suffix || suffix : suffix;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...quietFloat(t, H)}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, enter * 1.6), transform: `translateY(${(1 - enter) * 50}px) scale(${0.94 + 0.06 * enter})`, transformOrigin: `${W / 2}px ${H / 2}px`}}>
        {/* 彩纸在卡片后面，从卡片边上往外飞 */}
        <Confetti t={t} at={clock.land} dur={dur} rect={{x: cx, y: cy, w: cardW, h: cardH}} pal={pal} count={14} />
        <Card pal={pal} x={cx} y={cy} w={cardW} h={cardH} index={1}>
          {/* 标签（原话） */}
          <div style={{position: 'absolute', left: 0, top: labelY, width: cardW, height: labelSize * 1.6, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', display: 'inline-flex', alignItems: 'center', gap: labelSize * 0.4, fontSize: labelSize, fontWeight: 900, color: pal.ink, whiteSpace: 'nowrap'}}>
              <span style={{width: labelSize * 0.38, height: labelSize * 0.38, borderRadius: pal.look === 'wood' ? labelSize * 0.08 : '50%', background: dotA, flex: 'none'}} />
              {label}
              <span style={{width: labelSize * 0.38, height: labelSize * 0.38, borderRadius: pal.look === 'wood' ? labelSize * 0.08 : '50%', background: dotB, flex: 'none', border: ink ? `3px solid ${pal.ink}` : 'none', boxSizing: 'border-box'}} />
            </div>
          </div>
          {/* 旧值（原话里说了）：被一笔划掉 */}
          {hasFrom && oldShow > 0 ? (
            <div style={{position: 'absolute', left: 0, top: oldY, width: cardW, height: oldSize * 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: oldShow, transform: `translateY(${(1 - oldShow) * oldSize * 0.8}px)`}}>
              <div style={{position: 'relative', fontSize: oldSize, fontWeight: 800, color: rgba(pal.sub, 0.9), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
                {from!.prefix || prefix}
                {numText(from!.value, fromDec)}
                {from!.suffix || suffix}
                <div style={{position: 'absolute', left: '-6%', top: '52%', height: Math.max(6, oldSize * 0.11), width: `${112 * strike}%`, borderRadius: oldSize * 0.06, background: ink ? pal.ink : pal.accent, transform: 'rotate(-4deg)', transformOrigin: '0 50%'}} />
              </div>
            </div>
          ) : null}
          {/* 大数字 */}
          <div style={{position: 'absolute', left: 0, top: numY, width: cardW, height: numSize * 1.08, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: numOpacity}}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                fontWeight: 900,
                color: pal.ink,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                transform: `scale(${1 + 0.07 * hit}) scaleY(${flipY})`,
                textShadow: pal.look === 'paper' ? `${numSize * 0.03}px ${numSize * 0.03}px 0 ${pal.warm}` : pal.look === 'wood' ? `0 ${numSize * 0.025}px 0 ${pal.edge}` : 'none',
              }}
            >
              {bigPrefix ? <span style={{fontSize: numSize * PRE_K, marginRight: numSize * 0.04}}>{bigPrefix}</span> : null}
              <span style={{fontSize: numSize}}>{numText(value, dec)}</span>
              {bigSuffix ? <span style={{fontSize: numSize * SUF_K, marginLeft: numSize * 0.06}}>{bigSuffix}</span> : null}
            </div>
          </div>
          {/* 进度条：跟着数字走。ink 黑框黄芯 */}
          <div
            style={{
              position: 'absolute',
              left: pad * 1.2,
              width: cardW - pad * 2.4,
              top: cardH - pad - barH - slack,
              height: barH,
              borderRadius: barH / 2,
              background: ink ? '#FFFFFF' : rgba(pal.sub, 0.16),
              border: ink ? `3px solid ${pal.ink}` : 'none',
              boxSizing: 'content-box',
              overflow: 'hidden',
            }}
          >
            <div style={{width: `${Math.max(0, Math.min(1, barP)) * 100}%`, height: '100%', borderRadius: barH / 2, background: ink ? pal.accent : `linear-gradient(90deg, ${pal.cool}, ${pal.accent})`}} />
          </div>
        </Card>
      </div>
    </div>
  );
};
