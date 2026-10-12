// 按屏的 narration 合成旁白。复用三家和 mock 的缓存，不走分镜的 runVoiceStep。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PROVIDERS, synthesizeCached, voiceConfigOf} from '../lib/tts/index.mjs';
import {TtsError} from '../lib/tts/minimax.mjs';
import {DUCK, LEAD_SEC, TAIL_SEC, normalizeWav} from '../lib/tts/pipeline.mjs';
import {plainOf, shiftWordsToSpeech} from '../lib/tts/timing.mjs';
import {decodeWav} from '../lib/tts/wav.mjs';

export {DUCK, LEAD_SEC, TAIL_SEC};

/**
 * 成片整体响度对齐 -16 LUFS，真峰值不超过 -1.5 dBTP（宣传片人声峰值上限）。
 * 已经落在 ±1 LU 且峰值合格时返回 0。峰值顶到上限时少加增益。
 */
export function loudnessGainDb(integratedLufs, truePeakDb, target = -16, tolerance = 1, peakCap = -1.5) {
  const integrated = Number(integratedLufs);
  const peak = Number(truePeakDb);
  if (!Number.isFinite(integrated) || !Number.isFinite(peak)) return 0;
  if (Math.abs(integrated - target) <= tolerance && peak <= peakCap + 1e-6) return 0;
  let gain = target - integrated;
  if (peak + gain > peakCap) gain = peakCap - peak;
  if (Math.abs(gain) < 0.05) return 0;
  return Math.round(gain * 10) / 10;
}

const HINT = '想先看效果，加 --voice-provider mock（占位音，不能当交付），或加 --no-voice 出无配音版';

export function voiceConfig(provider, lang = 'zh') {
  return voiceConfigOf({lang, voice: {provider, subtitles: 'karaoke'}});
}

function decodeToWav(src, dest, remotion) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', dest];
  const ran = process.env.FFMPEG
    ? spawnSync(process.env.FFMPEG, args, {encoding: 'utf8', windowsHide: true})
    : spawnSync(process.execPath, [remotion, 'ffmpeg', ...args], {encoding: 'utf8', windowsHide: true});
  return ran.status === 0 && fs.existsSync(dest);
}

/**
 * @returns {Promise<{ok: true, cfg: any, lines: any[], synthesized: number, cacheHits: number, billedCharacters: number}
 *                  | {ok: false, code: string, message: string}>}
 */
export async function speakScreens(screens, opts) {
  const provider = opts.provider;
  if (!PROVIDERS[provider]) return {ok: false, code: 'BAD_PROVIDER', message: `不认识的配音：${provider}`};
  const cfg = voiceConfig(provider, opts.lang || 'zh');
  if (!cfg) return {ok: false, code: 'BAD_PROVIDER', message: `不认识的配音：${provider}`};
  const lines = [];
  let synthesized = 0;
  let cacheHits = 0;
  let billedCharacters = 0;
  for (let index = 0; index < screens.length; index++) {
    const narration = plainOf(screens[index]?.narration || '').trim();
    if (!narration) continue;
    try {
      const got = await synthesizeCached(narration, cfg, {
        cacheDir: opts.cacheDir,
        env: opts.env,
        log: opts.log,
      });
      fs.mkdirSync(opts.workDir, {recursive: true});
      let audioPath = got.audioPath;
      const wavPath = path.join(opts.workDir, `line-${index}.wav`);
      if (!String(audioPath).toLowerCase().endsWith('.wav')) {
        if (!opts.remotion || !decodeToWav(audioPath, wavPath, opts.remotion)) {
          return {ok: false, code: 'DECODE', message: `第 ${index + 1} 屏的旁白解码失败`};
        }
        audioPath = wavPath;
      }
      const buf = fs.readFileSync(audioPath);
      const norm = normalizeWav(buf);
      fs.writeFileSync(wavPath, norm);
      audioPath = wavPath;
      const decoded = decodeWav(norm);
      const words = decoded ? shiftWordsToSpeech(got.words, decoded.samples, decoded.sampleRate) : got.words;
      if (got.cacheHit) cacheHits += 1;
      else {
        synthesized += 1;
        billedCharacters += got.usageCharacters || 0;
      }
      lines.push({
        index,
        text: narration,
        words,
        durMs: got.durMs,
        granularity: got.granularity,
        cacheHit: !!got.cacheHit,
        usageCharacters: got.cacheHit ? 0 : got.usageCharacters || 0,
        audioPath,
      });
    } catch (error) {
      if (error instanceof TtsError || error?.code) {
        const zh = error.zh || '配音失败';
        const hint = error.hint || HINT;
        return {ok: false, code: error.code || 'TTS', message: `第 ${index + 1} 屏配音失败：${zh}（${hint}）`};
      }
      throw error;
    }
  }
  return {ok: true, cfg, lines, synthesized, cacheHits, billedCharacters};
}
