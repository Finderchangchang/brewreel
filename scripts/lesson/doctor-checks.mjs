// 环境自检的判断都是纯函数：调用方把探测结果传进来，这里只决定过不过、怎么说。
import {judgePythonProbe} from '../lib/bgm.mjs';

export const MIN_NODE = [18, 0, 0];
export const MIN_FREE_BYTES = 1024 ** 3;
export const REQUIRED_FONTS = [
  'NotoSansSC-VF.ttf',
  'NotoSerifSC-VF.ttf',
  'LXGWWenKai-Regular.ttf',
  'CascadiaMono.ttf',
];

export function parseNodeVersion(raw) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(raw ?? '').trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersion(left, right) {
  for (let i = 0; i < 3; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function item(id, title, required, ok, detail, fix) {
  return {id, title, required, ok, detail, fix: ok ? '' : fix};
}

export function judgeNode(version, min = MIN_NODE) {
  const parsed = Array.isArray(version) ? version : parseNodeVersion(version);
  const need = `v${min[0]}.${min[1]}.${min[2]}`;
  if (!parsed) {
    return item('node', 'Node.js 版本', true, false, '读不到版本号', `安装 Node.js ${min[0]} 或更高，建议到 nodejs.org 下载 20 LTS。装完重新打开命令行。`);
  }
  const shown = `v${parsed[0]}.${parsed[1]}.${parsed[2]}`;
  const ok = compareVersion(parsed, min) >= 0;
  return item('node', 'Node.js 版本', true, ok, ok ? `${shown}（需要 ${need} 或更高）` : `${shown}，低于 ${need}`, `到 nodejs.org 下载 Node.js 20 LTS（需要 ${min[0]} 或更高）。装完重新打开命令行，再跑本检查。`);
}

export function judgeDeps({cli, remotion, react, typescript, lock, linked}) {
  if (linked) {
    return item('deps', 'template 依赖', true, false, 'node_modules 是指向别的目录的链接', '删掉 template/node_modules 这个链接，不要删链接对面的文件夹。然后在 template 目录执行 npm ci。');
  }
  if (!lock) {
    return item('deps', 'template 依赖', true, false, '没有 package-lock.json', '安装包不完整。重新解压，确认 template/package-lock.json 还在，再在 template 目录执行 npm ci。');
  }
  if (!cli || !remotion || !react || !typescript) {
    return item('deps', 'template 依赖', true, false, '依赖没装全', '在 template 目录执行 npm ci。这一步要能上网，大约几百 MB。不要拷贝别人电脑里的 node_modules。');
  }
  return item('deps', 'template 依赖', true, true, '已安装', '');
}

export function judgeFonts(presentNames) {
  const have = new Set(presentNames || []);
  const missing = REQUIRED_FONTS.filter((name) => !have.has(name));
  const ok = missing.length === 0;
  return item('fonts', '字体文件', true, ok, ok ? '四套字体都在' : `缺少 ${missing.join('、')}`, '重新解压安装包。template/public 里要有 NotoSansSC-VF.ttf、NotoSerifSC-VF.ttf、LXGWWenKai-Regular.ttf、CascadiaMono.ttf。');
}

export function judgeBrowser({skipped, code, timedOut}) {
  if (skipped) return item('browser', 'Remotion 浏览器', true, false, '依赖还没装，跳过', '先在 template 目录执行 npm ci，再跑一次本检查。');
  if (timedOut) return item('browser', 'Remotion 浏览器', true, false, '检查超时', '确认电脑能上网，然后重跑。第一次会下载约 110 MB 的浏览器。');
  if (code === 0) return item('browser', 'Remotion 浏览器', true, true, '能启动', '');
  return item('browser', 'Remotion 浏览器', true, false, '启动失败', '在 template 目录执行 npx remotion browser ensure。Windows 请用 64 位系统；Mac 需要 macOS 15 或更高。');
}

export function judgeFfmpeg({skipped, code, output}) {
  if (skipped) return item('ffmpeg', 'ffmpeg（Remotion 自带）', true, false, '依赖还没装，跳过', '先在 template 目录执行 npm ci，再跑一次本检查。');
  const text = String(output || '');
  const ok = code === 0 && /ffmpeg/i.test(text);
  return item('ffmpeg', 'ffmpeg（Remotion 自带）', true, ok, ok ? '可用' : '不可用', '在 template 目录重新执行 npm ci。不用另装系统 ffmpeg，渲染用的是 Remotion 自带的那一份。');
}

export function judgePython(probe) {
  const judged = probe?.kind ? probe : judgePythonProbe(probe || {status: -1, error: 'ENOENT'});
  const ok = judged.ok === true;
  const detail = ok ? 'numpy 和 scipy 可用' : judged.kind === 'no-python' ? '没找到 Python' : judged.kind === 'no-deps' ? '缺少 numpy 或 scipy' : '配乐环境异常';
  return item('python', 'Python 与配乐依赖', false, ok, detail, '这是可选项。不装也能出片，只是没有配乐，出片时会写明，不会悄悄交静音片。要配乐：安装 Python 3.10 或更高，在解压目录执行 pip install -r requirements.txt。');
}

export function judgeApiKey(name, present) {
  if (typeof present !== 'boolean') throw new TypeError('judgeApiKey 只接收 true 或 false，不能传入密钥');
  const purpose = name === 'DEEPSEEK_API_KEY' ? '写稿' : name === 'MINIMAX_API_KEY' ? '配音' : '调用接口';
  return item(name, name, true, present, present ? '已设置（内容不显示）' : '未设置', `在系统环境变量里新建 ${name}，值填密钥。只留在你自己的电脑上，不要写进安装文件夹或任何文档。设好后重新打开命令行。这一项是${purpose}用的。mock 样片可以不靠它出，但正式出片需要。`);
}

export function judgeDir({id, title, shown, writable, inside}) {
  if (!writable) {
    return item(id, title, true, false, `${shown} 不可写`, '给这个文件夹写权限，或换一个你有权限的目录。数据目录用 --data-dir 或环境变量 LESSON_DATA_DIR；出片目录用 --out-dir 或 LESSON_OUT_DIR。');
  }
  if (inside) {
    return item(id, title, true, false, `${shown} 在安装文件夹里面`, '成片和角色档案不能放在安装文件夹里。请在解压文件夹里打开命令行，默认会写到上一级；也可以用 --data-dir / --out-dir 指到文件夹外面。');
  }
  return item(id, title, true, true, `${shown} 可写，且在安装文件夹外面`, '');
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '未知';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function judgeDisk(entries, minBytes = MIN_FREE_BYTES) {
  const list = Array.isArray(entries) ? entries : [];
  const unknown = list.length === 0 || list.some((entry) => !Number.isFinite(entry.bytes));
  if (unknown) {
    return item('disk', '磁盘剩余空间', true, false, '读不到剩余空间', '确认出片目录所在的磁盘能正常访问，留出至少 1 GB 再出片。');
  }
  const ok = list.every((entry) => entry.bytes >= minBytes);
  const detail = `${list.map((entry) => `${entry.label}剩余 ${formatBytes(entry.bytes)}`).join('，')}（至少需要 ${formatBytes(minBytes)}）`;
  return item('disk', '磁盘剩余空间', true, ok, detail, '清出一些磁盘空间后再出片。一支课大约几十到几百 MB，浏览器第一次下载约 110 MB。');
}

export function overallOk(items) {
  return items.every((entry) => !entry.required || entry.ok);
}

export function exitCode(items) {
  return overallOk(items) ? 0 : 1;
}

export function formatReport(items) {
  const lines = [];
  for (const entry of items) {
    const mark = entry.ok ? '✓' : '✗';
    const tag = entry.required ? '' : '（可选项）';
    lines.push(`${mark} ${entry.title}${tag}：${entry.detail}`);
    if (!entry.ok && entry.fix) lines.push(`  修法：${entry.fix}`);
  }
  if (overallOk(items)) {
    const optionalMiss = items.some((entry) => !entry.required && !entry.ok);
    lines.push(optionalMiss ? '结果：必需项都通过。可选项没过不影响出片，出片时会说明。' : '结果：必需项都通过。');
  } else {
    lines.push('结果：有必需项没通过。按上面的修法处理后再跑一次。');
  }
  return lines.join('\n');
}
