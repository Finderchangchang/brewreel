import React from 'react';
import {FONT} from '../../core/font';
import {fitLine} from '../../core/fit';
import {useGeometry} from '../../core/aspect';
import type {Meta} from '../../schema';

// ============================================================
// 合规小字层（非 cards 风格的默认实现）：顶部免责胶囊（meta.disclaimer）+ 底部提示条（meta.notices）。
// demoData 的「演示画面」提示靠它上屏，风格不能省；想换样式就在自己的 Overlay 里画，并在 style.json 里说明。
// 位置按画幅取（aspects.json 的 disclaimerY / noticeY），字号 26–28，半透明深底白字，任何底色上都看得清。
// ============================================================
export const StyleChrome: React.FC<{meta: Meta}> = ({meta}) => {
  const geo = useGeometry();
  const notices = (meta.notices ?? []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3);
  const noticeText = notices.join('   ·   ');
  const pill: React.CSSProperties = {
    display: 'inline-block',
    padding: '5px 20px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.42)',
    color: 'rgba(255,255,255,0.95)',
    fontFamily: FONT,
    fontWeight: 600,
    lineHeight: 1.3,
  };
  const w = geo.safe.x1 - geo.safe.x0;
  return (
    <>
      {meta.disclaimer ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: geo.disclaimerY, textAlign: 'center'}}>
          <span style={{...pill, fontSize: 26}}>{meta.disclaimer}</span>
        </div>
      ) : null}
      {noticeText ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: geo.noticeY, display: 'flex', justifyContent: 'center'}}>
          <span style={{...pill, maxWidth: w, fontSize: Math.max(26, Math.min(28, fitLine(noticeText, w - 40, 28, 26))), textAlign: 'center'}}>{noticeText}</span>
        </div>
      ) : null}
    </>
  );
};
