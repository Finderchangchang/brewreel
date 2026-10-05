// 测试里直接 import template 下的 .ts（Node 22 自带去类型）：template/package.json 没写 "type"，
// Node 每次都会印一条 MODULE_TYPELESS_PACKAGE_JSON 警告，看着像出错了。这里只把这一条滤掉，别的警告照常印。
// 不给 template/package.json 加 "type": "module"：Remotion 打包时会按严格 ESM 处理 template 里的文件，影响宣传片。
//   const {layoutOf} = await importTs('../../template/src/talk/layout.ts', import.meta.url);
const QUIET = new Set(['MODULE_TYPELESS_PACKAGE_JSON']);
let installed = false;

const install = () => {
  if (installed) return;
  installed = true;
  const keep = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (QUIET.has(w?.code)) return;
    if (keep.length) for (const l of keep) l(w);
    else console.error(String(w?.stack || w));
  });
};

/** 动态 import 一个 .ts 文件（相对 base 解析），不印 MODULE_TYPELESS_PACKAGE_JSON。 */
export const importTs = async (rel, base) => {
  install();
  return import(new URL(rel, base).href);
};
