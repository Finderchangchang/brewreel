import {continueRender, delayRender, staticFile} from 'remotion';

// 中文：思源黑体可变字重（NotoSansSC-VF）；数字：Cascadia Mono。加载失败回退系统字体。
// 讲课版式另注册衬线（PSerif，OFL 子集，族名 BrewReel Serif）和楷体（PKai，族名 BrewReel Kai）。宣传片仍用原来的 FONT / MONO。
export const FONT = '"PSans", "Noto Sans SC", "Microsoft YaHei UI", sans-serif';
export const SERIF = '"PSerif", "BrewReel Serif", serif';
export const KAI = '"PKai", "BrewReel Kai", serif';
export const MONO = '"PMono", "Cascadia Mono", Consolas, monospace';

let started = false;
export const ensureFont = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('load fonts');
  const faces = [
    new FontFace('PSans', `url(${staticFile('NotoSansSC-VF.ttf')}) format('truetype')`, {weight: '100 900'}),
    new FontFace('PSerif', `url(${staticFile('NotoSerifSC-VF.ttf')}) format('truetype')`, {weight: '200 900'}),
    new FontFace('PKai', `url(${staticFile('LXGWWenKai-Regular.ttf')}) format('truetype')`, {weight: '400'}),
    new FontFace('PMono', `url(${staticFile('CascadiaMono.ttf')}) format('truetype')`, {weight: '200 700'}),
  ];
  Promise.all(
    faces.map((face) =>
      face
        .load()
        .then((ok) => {
          document.fonts.add(ok);
        })
        .catch((e) => console.warn('font load failed', e)),
    ),
  ).then(() => continueRender(handle));
};
