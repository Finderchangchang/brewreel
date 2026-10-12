/** 把浏览器量到的像素换回成片坐标。
 * 竖版成片宽 1080，旧公式 `1080 / 渲染宽` 与此相同。
 * 横版 1920 若仍按 1080 折，安全区会误报，字号上限也会放开，紧排的两行被当成相交。
 */
export function probeScale(compWidth: number, renderedWidth: number): number {
  if (!renderedWidth) return 1;
  const width = compWidth > 0 ? compWidth : 1080;
  return width / renderedWidth;
}
