// 配乐是可选项。没装 Python 或缺 numpy / scipy 时不出配乐，但必须把原因说清楚。
import {spawnSync} from 'node:child_process';

export function pythonBin(env = process.env, platform = process.platform) {
  return env.PYTHON || (platform === 'win32' ? 'python' : 'python3');
}

export function voiceNotice(hasVoice) {
  return hasVoice ? '配音仍在，不是静音交付。' : '本片没有配音，成片是无声画面，不是漏音未说明。';
}

export function redactLocalPaths(text) {
  return String(text || '')
    .replace(/[A-Za-z]:[\\/][^\s"'`]*/g, '（本地路径）')
    .replace(/\/(?:Users|home)\/[^\s"'`]*/g, '（本地路径）');
}

function tailOf(text) {
  return redactLocalPaths(text).trim().split(/\r?\n/).filter(Boolean).slice(-2).join(' | ');
}

export function judgePythonProbe(raw = {}, options = {}) {
  const hasVoice = options.hasVoice !== false;
  const error = String(raw.error || '');
  const stderr = String(raw.stderr || '');
  const stdout = String(raw.stdout || '');
  const blob = `${error}\n${stderr}\n${stdout}`;
  const notice = voiceNotice(hasVoice);
  if (/ENOENT|not found|不是内部或外部命令/i.test(error)) {
    return {ok: false, kind: 'no-python', message: `本片没有配乐：没找到 Python。${notice}修法：安装 Python 3.10 或更高，在解压目录执行 pip install -r requirements.txt，然后重新出片。`};
  }
  if (/No module named ['"]?(numpy|scipy)/i.test(blob)) {
    return {ok: false, kind: 'no-deps', message: `本片没有配乐：Python 已安装，但缺少 numpy 或 scipy。${notice}修法：在解压目录执行 pip install -r requirements.txt，然后重新出片。`};
  }
  if (raw.status !== 0 && raw.status != null) {
    const tail = tailOf(stderr || error || stdout);
    return {ok: false, kind: 'broken', message: `本片没有配乐：Python 配乐环境检查没通过。${notice}${tail ? `原因：${tail}` : ''}`.trim()};
  }
  return {ok: true, kind: 'ready', message: ''};
}

export function judgeBgmRun(raw = {}, options = {}) {
  const hasVoice = options.hasVoice !== false;
  if (raw.status === 0 && raw.fileExists) {
    return {ok: true, kind: 'generated', message: '已生成配乐，并在有旁白的地方把配乐压低。'};
  }
  const pre = judgePythonProbe(raw, {hasVoice});
  if (!pre.ok && (pre.kind === 'no-python' || pre.kind === 'no-deps')) return pre;
  const tail = tailOf(String(raw.stderr || '') || String(raw.error || ''));
  return {ok: false, kind: 'failed', message: `本片没有配乐：配乐脚本没有写出音频。${voiceNotice(hasVoice)}${tail ? `原因：${tail}` : ''}`.trim()};
}

export function skippedByFlag(hasVoice) {
  return `按 --no-bgm，本片没有配乐。${voiceNotice(hasVoice)}`;
}

export function probePythonBgm(py = pythonBin(), spawnImpl = spawnSync, options = {}) {
  let ran;
  try {
    ran = spawnImpl(py, ['-c', 'import numpy, scipy'], {encoding: 'utf8', windowsHide: true, timeout: 30000});
  } catch (e) {
    return judgePythonProbe({error: e instanceof Error ? e.message : String(e), status: -1, stderr: '', stdout: ''}, options);
  }
  return judgePythonProbe({
    error: ran?.error?.message || '',
    status: ran?.status,
    stderr: ran?.stderr || '',
    stdout: ran?.stdout || '',
  }, options);
}
