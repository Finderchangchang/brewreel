import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {ThemeName} from './schema';
import {FONT} from './core/font';
import {ThemeProvider, resolveTheme, useTheme} from './core/theme';
import {Illust} from './illust';
import namesData from './illust/names.json';

// ============================================================
// IllustLab：网格展示行业插画占位（接口预留）。给插画开发者出一张图检查用，不是正式镜头。
// props：{industry?: "food" | "ecommerce" | "education" | "beauty" | "travel" | "_base", theme?: ThemeName}
//   不给 industry 就显示全部 66 个；给了就只显示该行业 + 通用 _base 的
// 出图：cd template && npx remotion still src/index.ts IllustLab ..\tests\<你>\illust-food.png --props=..\tests\<你>\illust-food.json
//   illust-food.json 内容：{"industry": "food"}
// ============================================================
export type IllustLabProps = {industry?: string; theme?: ThemeName};

type NameRow = {id: string; industry: string; label?: string; must?: boolean};

const Grid: React.FC<{industry?: string}> = ({industry}) => {
  const th = useTheme();
  const list = (namesData as NameRow[]).filter((n) => !industry || n.industry === industry || n.industry === '_base');
  const cols = 6;
  const cell = 164;
  return (
    <AbsoluteFill style={{background: th.bgBot[0], fontFamily: FONT, padding: 28, boxSizing: 'border-box'}}>
      <div style={{fontSize: 40, fontWeight: 900, color: th.onBg, marginBottom: 20}}>
        IllustLab{industry ? ` · ${industry}` : ''} ({list.length})
      </div>
      <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap: 14}}>
        {list.map((n) => (
          <div key={n.id} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            <Illust name={n.id} size={cell} />
            {n.label && <div style={{fontSize: 22, color: th.onBgSub, textAlign: 'center'}}>{n.label}{n.must ? ' ★' : ''}</div>}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const IllustLab: React.FC<IllustLabProps> = ({industry, theme}) => {
  const th = resolveTheme(theme);
  return (
    <ThemeProvider theme={th}>
      <Grid industry={industry} />
    </ThemeProvider>
  );
};

export default IllustLab;
