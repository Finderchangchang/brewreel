#!/usr/bin/env node
// 示例口播：examples/talk/demo/talk.mp4（20 秒彩条 + 440Hz 正弦音，1080×1920）。mp4 不进仓库（.gitignore 忽略 *.mp4），
// 用到时现生成一份，再拷给 examples/talk/motion（v2 示例和 demo 共用同一段口播和字幕）。
// run.mjs、integration.mjs 都调 ensureDemo()；也可以单独跑，给想直接试示例的人生成口播：
//   node tests/broll/demo.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ffmpegPath, probeMedia} from '../../scripts/broll/media.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';

export const DEMO = path.join(ROOT, 'examples', 'talk', 'demo');
export const MOTION_DEMO = path.join(ROOT, 'examples', 'talk', 'motion');

/** 示例口播在不在、对不对；不对就重新生成。返回 demo 的 talk.mp4 路径。 */
export const ensureDemo = () => {
  const dest = path.join(DEMO, 'talk.mp4');
  let ok = false;
  if (fs.existsSync(dest)) {
    try {
      const m = probeMedia(dest);
      ok = m.width === 1080 && m.height === 1920 && m.hasAudio && Math.abs(m.durationSec - 20) < 0.2;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    const r = spawnSync(ffmpegPath(), ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'smptebars=size=1080x1920:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '20', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-c:a', 'aac', dest], {windowsHide: true, encoding: 'utf8'});
    if (r.status !== 0) throw new Error(`示例口播生成失败（要完整版 ffmpeg：pip install imageio-ffmpeg）：${r.stderr || r.stdout}`);
  }
  const motionTalk = path.join(MOTION_DEMO, 'talk.mp4');
  if (!fs.existsSync(motionTalk) || fs.statSync(motionTalk).size !== fs.statSync(dest).size) fs.copyFileSync(dest, motionTalk);
  return dest;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const dest = ensureDemo();
    console.log(`示例口播已就绪：${dest}\n（也拷到了 ${path.join(MOTION_DEMO, 'talk.mp4')}）`);
  } catch (e) {
    console.log(e.message);
    process.exit(4);
  }
}
