# -*- coding: utf-8 -*-
"""
参数化原创配乐：乐器、和声、旋律、混音、母带全部脚本内合成，不依赖外部素材库。

  python scripts/make_bgm.py --duration 27.5 --bpm 120 --theme warm-emotion \
      --cues "[0,2.5,8.5,12,16,20,23.5]" [--moods "[0.85,0.9,...]"] [--types "[\"hook\",\"chat\",...]"] --out bgm.wav

  --cues   各镜起点秒（JSON 数组，也接受 0,2.5,8.5 这种逗号写法）；make.mjs 会自动传
  --moods  各镜情绪 0..1（可省，默认 0.5）；--types 各镜类型（可省）
  --theme  决定调性（整体移调）和音色配比
每一镜是一个段落，按「位置 + 情绪」选风格：
  intro   第 1 镜（钩子）：拨弦动机 + 薄 pad（情绪高时加心跳）
  tension 情绪 ≥ 0.7：Am–Em、低音脉冲渐强、心跳
  lift    紧张段（或钩子）之后的第一段：F–G–C 解决、轻踩镲、琶音
  groove  其余段落：C–G–Am–F 主歌律动 + 马林巴旋律
  peak    片尾前一镜（情绪不高时）：四踩、开镲、旋律加 lead
  end     最后一镜：Cadd9 收束、鼓渐隐、拨弦上行
所有音符落在整拍/半拍；每个镜头切换处有镲或加花（进入律动段前还有 2 拍上扬）。
只依赖 numpy / scipy；响度用 ffmpeg ebur128 校到 -16 LUFS（找不到 ffmpeg 就按 RMS 近似）。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict

import numpy as np
from scipy import signal as ss
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d


def parse_list(s, conv):
    if s is None:
        return None
    s = s.strip()
    if not s:
        return []
    if s.startswith('['):
        return [conv(x) for x in json.loads(s)]
    return [conv(x.strip()) for x in s.split(',') if x.strip()]


ap = argparse.ArgumentParser(description='参数化原创配乐')
ap.add_argument('--duration', '--dur', dest='duration', type=float, required=True, help='总时长（秒）')
ap.add_argument('--bpm', type=float, default=120)
ap.add_argument('--theme', default='warm-emotion')
ap.add_argument('--cues', default='[0]', help='各镜起点秒，JSON 数组')
ap.add_argument('--moods', default=None)
ap.add_argument('--types', default=None)
ap.add_argument('--out', required=True)
ap.add_argument('--seed', type=int, default=20260925)
ap.add_argument('--lufs', type=float, default=-16.0)
args = ap.parse_args()

SR = 44100
DUR = max(3.0, float(args.duration))
N = int(SR * DUR)
BEAT = 60.0 / max(60.0, min(200.0, args.bpm))
S = BEAT / 0.5  # 原脚本按 120 BPM 写的秒数 → 按当前速度缩放
# 默认用 Remotion 自带的 ffmpeg（跨平台、免装系统 ffmpeg，通过 `npx remotion ffmpeg` 调用）；
# FFMPEG 环境变量可指定系统 ffmpeg 可执行文件覆盖。
_FFMPEG_ENV = os.environ.get('FFMPEG')
if _FFMPEG_ENV:
    FFMPEG_CMD = [_FFMPEG_ENV]
else:
    _npx = shutil.which('npx') or 'npx'
    FFMPEG_CMD = [_npx, 'remotion', 'ffmpeg']
CEIL_DBTP = -1.5
rng = np.random.default_rng(args.seed)

cues = parse_list(args.cues, float) or [0.0]
n_seg = len(cues)
moods = parse_list(args.moods, float) or [0.5] * n_seg
types = parse_list(args.types, str) or (['hook'] + ['x'] * max(0, n_seg - 2) + (['endCard'] if n_seg > 1 else []))
moods = (moods + [0.5] * n_seg)[:n_seg]
types = (types + ['x'] * n_seg)[:n_seg]

# 主题：整体移调（半音）+ 各声部增益（dB）
THEMES = {
    'warm-emotion': (0, {}),
    'tech-dark': (-3, {'ep': -4, 'pulse': 3, 'mallet': -2, 'lead': 2, 'hats': 1, 'heart': -3, 'pad': 1}),
    'fresh-light': (2, {'pluck': 3, 'mallet': 1, 'kick': -3, 'snare': -3, 'heart': -4, 'pulse': -2}),
    'business-blue': (-2, {'ep': 1, 'pad': -1, 'heart': -4, 'lead': -2}),
    'festival-red': (3, {'mallet': 2, 'snare': 2, 'crash': 2, 'hats': 1, 'heart': -4}),
    'mono-premium': (-5, {'kick': -6, 'snare': -7, 'hats': -6, 'crash': -4, 'ep': 2, 'pad': 1, 'pluck': 1, 'lead': -30, 'heart': -3}),
}
TR, THEME_GAIN = THEMES.get(args.theme, THEMES['warm-emotion'])


def adsr(gate, a, d, s, r):
    """Linear-ish attack, exponential decay to sustain, exponential release."""
    ng = max(1, int(gate * SR))
    nr = max(1, int(r * SR))
    t = np.arange(ng) / SR
    tau = max(d, 1e-4) / 3.0
    env = s + (1 - s) * np.exp(-np.maximum(t - a, 0) / tau)
    if a > 0:
        m = t < a
        env[m] = np.sin(0.5 * np.pi * t[m] / a)
    v = env[-1]
    tr = np.arange(nr) / SR
    rel = v * np.exp(-5 * tr / r) * (1 - tr / r)
    return np.concatenate([env, rel])


def mtof(m):
    return 440.0 * 2 ** ((m + TR - 69) / 12)


def lp(fc, order=2):
    return ss.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')


def hp(fc, order=2):
    return ss.butter(order, fc, 'high', fs=SR, output='sos')


def bp(lo, hi, order=2):
    return ss.butter(order, [lo, hi], 'band', fs=SR, output='sos')


def filt(sos, x):
    return ss.sosfilt(sos, x, axis=-1)


def saw_blep(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    y[m2] -= x * x + x + x + 1
    return y


# ---------------------------------------------------------------- buses
BUS_NAMES = ['kick', 'heart', 'snare', 'hats', 'crash', 'bass', 'pulse', 'pad', 'ep', 'pluck', 'mallet', 'lead', 'fx']
bus = {k: np.zeros((2, N)) for k in BUS_NAMES}
kick_times = []  # (time, vel) 给侧链压缩用


def pan_gains(p):
    th = (p + 1) * np.pi / 4
    return np.cos(th) * np.sqrt(2), np.sin(th) * np.sqrt(2)


def add(name, sig, t0, pan=0.0, gain=1.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    if i < 0:
        sig = sig[..., -i:]
        i = 0
    if sig.ndim == 1:
        sig = sig[:N - i]
        gl, gr = pan_gains(pan)
        bus[name][0, i:i + len(sig)] += sig * gain * gl
        bus[name][1, i:i + len(sig)] += sig * gain * gr
    else:
        sig = sig[:, :N - i]
        bus[name][:, i:i + sig.shape[1]] += sig * gain


def hum(t, amt=0.004):
    return t + rng.normal(0, amt)


def hv(v, amt=0.06):
    return v * (1 + rng.uniform(-amt, amt))


# ---------------------------------------------------------------- instruments（原样保留）
def kick(vel=1.0, f0=165.0, f1=52.0, pdec=0.04):
    env = adsr(0.12, 0.001, 0.5, 0.0, 0.3)
    n = len(env)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / pdec)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR)
    cl_env = np.zeros(n)
    ce = adsr(0.003, 0.0005, 0.008, 0.0, 0.006)
    cl_env[:len(ce)] = ce
    click = filt(bp(1200, 5000), rng.standard_normal(n)) * cl_env * 0.35
    s = np.tanh(1.6 * (body * env + click)) / np.tanh(1.6)
    return s * vel


def heartbeat(vel=1.0):
    env = adsr(0.08, 0.002, 0.3, 0.0, 0.2)
    n = len(env)
    t = np.arange(n) / SR
    f = 58 + (120 - 58) * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = np.tanh(2.2 * body * env) / np.tanh(2.2)
    return filt(lp(320), s) * vel


def clap(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for k, off in enumerate([0.0, 0.010, 0.021, 0.031]):
        tau = 0.004 if k < 3 else 0.085
        m = t >= off
        env[m] += np.exp(-(t[m] - off) / tau) * (0.8 if k < 3 else 1.0)
    shape = np.zeros(n)
    sh = adsr(0.05, 0.0005, 0.4, 0.0, 0.3)[:n]
    shape[:len(sh)] = sh
    noise = filt(bp(900, 4200), rng.standard_normal(n))
    return noise * env * shape * vel * 0.8


def snare(vel=1.0):
    env_t = adsr(0.03, 0.001, 0.2, 0.0, 0.08)
    env_n = adsr(0.05, 0.001, 0.35, 0.0, 0.12)
    n = max(len(env_t), len(env_n))
    t = np.arange(n) / SR
    f = 165 + 40 * np.exp(-t / 0.02)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    tone[:len(env_t)] *= env_t
    tone[len(env_t):] = 0
    noise = filt(bp(1400, 7000), rng.standard_normal(n))
    noise[:len(env_n)] *= env_n
    noise[len(env_n):] = 0
    return (0.55 * tone + 0.6 * noise) * vel


HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def hat(vel=1.0, open_=False):
    env = adsr(0.01, 0.0005, 0.12 if not open_ else 0.55, 0.0, 0.03 if not open_ else 0.15)
    n = len(env)
    t = np.arange(n) / SR
    metal = sum(np.sign(np.sin(2 * np.pi * f * 1.7 * t + rng.random() * 6.28)) for f in HAT_FREQS) / 6
    noise = rng.standard_normal(n)
    s = filt(hp(7000, 4), 0.6 * noise + 0.5 * metal)
    return s * env * vel


def crash(vel=1.0):
    env = adsr(0.02, 0.004, 2.2, 0.0, 0.4)
    n = len(env)
    t = np.arange(n) / SR
    metal = sum(np.sign(np.sin(2 * np.pi * f * 2.3 * t + rng.random() * 6.28)) for f in HAT_FREQS) / 6
    s = filt(hp(3500, 2), 0.7 * rng.standard_normal(n) + 0.4 * metal)
    s = filt(lp(9000, 2), s)
    return s * env * vel


def riser(length):
    """进入律动段前的上扬：带通噪声，音量和亮度一起升上去。"""
    n = max(1, int(length * SR))
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    lo = filt(bp(800, 3000), noise)
    hi = filt(hp(3000), noise)
    return (lo * (1 - t) + hi * t) * t ** 2.2


def bass(m, dur, vel=1.0):
    f = mtof(m)
    env = adsr(dur, 0.006, 0.45, 0.72, 0.07)
    n = len(env)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t + 0.3)
    s = np.tanh(1.8 * s) / np.tanh(1.8)
    s += 0.18 * saw_blep(f, n) * np.exp(-t / 0.06)
    return s * env * vel


def pulse(m, dur, vel=1.0):
    f = mtof(m)
    env = adsr(dur, 0.004, 0.14, 0.35, 0.06)
    n = len(env)
    t = np.arange(n) / SR
    saw = 0.5 * (saw_blep(f, n, rng.random()) + saw_blep(f * 1.004, n, rng.random()))
    s = 0.8 * np.sin(2 * np.pi * f * t) + 0.6 * filt(lp(380, 2), saw)
    return s * env * vel


def pad_chord(notes, dur, vel, cutoff, attack=0.3, rel=0.9):
    env = adsr(dur, min(attack, dur * 0.6), 0.6, 0.85, rel)
    n = len(env)
    L = np.zeros(n)
    R = np.zeros(n)
    det = [-14, -6, 0, 6, 14]
    pans = [-0.9, -0.45, 0.0, 0.45, 0.9]
    for m in notes:
        for d, p in zip(det, pans):
            s = saw_blep(mtof(m) * 2 ** (d / 1200), n, rng.random())
            gl, gr = pan_gains(p)
            L += s * gl
            R += s * gr
    st = np.vstack([L, R]) / np.sqrt(len(notes) * len(det))
    st = filt(lp(cutoff, 4), st)
    return st * env * vel


def ep_note(m, dur, vel=1.0):
    f = mtof(m)
    env = adsr(dur, 0.003, 2.5, 0.25, 0.4)
    n = len(env)
    t = np.arange(n) / SR
    idx = (0.4 + 1.6 * vel) * np.exp(-t / 0.35) + 0.25
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    s += 0.12 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.5)
    return s * env * vel


def ks_pluck(m, dur, vel=1.0, t60=1.5, bright=0.55):
    f = mtof(m)
    env = adsr(dur, 0.002, 0.1, 1.0, 0.3)
    n_out = len(env)
    Nd = max(2, int(round(SR / f - 0.5)))
    fp = SR / (Nd + 0.5)
    ratio = f / fp
    n_src = int(n_out * ratio) + Nd + 4
    g = 10 ** (-3 / (f * t60))
    y = np.zeros(n_src)
    a = 0.15 + 0.6 * (1 - bright)
    exc = ss.lfilter([1 - a], [1, -a], rng.uniform(-1, 1, Nd + 1))
    exc -= exc.mean()
    y[:Nd + 1] = exc
    pos = Nd + 1
    while pos < n_src:
        end = min(pos + Nd, n_src)
        y[pos:end] = g * 0.5 * (y[pos - Nd:end - Nd] + y[pos - Nd - 1:end - Nd - 1])
        pos = end
    out = np.interp(np.arange(n_out) * ratio, np.arange(n_src), y)
    return out * env * vel * 1.6


def mallet(m, dur, vel=1.0):
    f = mtof(m)
    gate = max(dur, 0.15)
    parts = [(1.0, 1.0, 1.5), (4.0, 0.2, 0.28), (10.0, 0.05, 0.07), (2.0, 0.06, 0.4)]
    out = None
    t = None
    for ratio, amp, dec in parts:
        if f * ratio > 10000:
            continue
        env = adsr(gate, 0.0015, dec, 0.0, 0.25)
        if out is None:
            out = np.zeros(len(env))
            t = np.arange(len(env)) / SR
        out += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 0.2) * env
    ce = adsr(0.002, 0.0003, 0.006, 0.0, 0.004)
    click = filt(lp(3000), rng.standard_normal(len(ce))) * ce * 0.15
    out[:len(click)] += click
    return out * vel


def lead(m, dur, vel=1.0):
    f = mtof(m)
    env = adsr(dur, 0.012, 0.25, 0.7, 0.15)
    n = len(env)
    t = np.arange(n) / SR
    vib = 1 + (2 ** (12 / 1200) - 1) * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    L = saw_blep(f * vib * 2 ** (-7 / 1200), n, rng.random())
    R = saw_blep(f * vib * 2 ** (7 / 1200), n, rng.random())
    st = filt(lp(2200, 2), np.vstack([L, R]))
    return st * env * vel


# ---------------------------------------------------------------- harmony（原脚本的配置）
PADV = {
    'Cmaj7': [48, 55, 59, 64], 'Fmaj7': [53, 57, 60, 64],
    'Am': [57, 60, 64, 69], 'Em': [55, 59, 64, 67],
    'F': [57, 60, 65, 69], 'G': [55, 59, 62, 67], 'C': [55, 60, 64, 67],
    'Cadd9': [48, 55, 60, 62, 64, 67],
}
EPV = {
    'Am7': [57, 60, 64, 67], 'Em7': [55, 59, 62, 64],
    'F': [57, 60, 65, 69], 'G': [55, 59, 62, 67], 'C': [55, 60, 64, 67],
    'Am': [57, 60, 64, 67], 'Cend': [48, 55, 60, 64, 67],
}
ARPV = {
    'Cmaj7': [60, 64, 67, 71], 'Fmaj7': [65, 69, 72, 76],
    'F': [60, 65, 69, 72], 'G': [62, 67, 71, 74], 'C': [60, 64, 67, 72],
    'Am': [60, 64, 69, 72], 'Em': [59, 64, 67, 71],
}
ROOT = {'C': 36, 'G': 43, 'Am': 45, 'F': 41, 'Em': 40, 'Cmaj7': 36, 'Fmaj7': 41, 'Cadd9': 36}
EP_OF = {'Am': 'Am', 'Em': 'Em7', 'Cmaj7': 'C', 'Fmaj7': 'F', 'Cadd9': 'Cend'}

# 原片前两小节的拨弦动机（拍, 音高）
INTRO_PL = {
    'Cmaj7': [(0, 60), (1, 67), (1.5, 71), (2.5, 72), (3, 76)],
    'Fmaj7': [(0, 65), (1, 69), (1.5, 72), (2.5, 76), (3.5, 72)],
}
# 原片主歌旋律，按和弦拆成可复用的一小节（拍, 音高, 拍长, 力度）
MEL_GROOVE = {
    'C': [(0, 76, .5, .9), (.5, 79, .5, .75), (1, 81, .5, .85), (1.5, 79, 1.5, .8), (3, 76, .5, .75), (3.5, 74, .5, .7)],
    'G': [(0, 74, 1.5, .85), (2, 71, .5, .7), (2.5, 74, .5, .75), (3, 79, 1, .85)],
    'Am': [(0, 76, .5, .9), (.5, 79, .5, .75), (1, 81, .5, .85), (1.5, 84, 1.5, .9), (3, 83, .5, .75), (3.5, 81, .5, .7)],
    'F': [(0, 81, 1, .85), (1, 79, .5, .7), (1.5, 77, .5, .7), (2, 76, 1, .8), (3, 74, .5, .7), (3.5, 72, .5, .7)],
}
# 原片高潮两小节，按半小节拆
MEL_PEAK = {
    'F': [(0, 81, .5, .95), (.5, 84, .5, .85), (1, 81, .5, .85), (1.5, 79, .5, .8)],
    'G': [(0, 79, .5, .9), (.5, 83, .5, .85), (1, 86, .5, .9), (1.5, 83, .5, .8)],
    'Am': [(0, 84, .5, .95), (.5, 81, .5, .85), (1, 76, .5, .8), (1.5, 81, .5, .85)],
    'G2': [(0, 83, .5, .9), (.5, 79, .5, .8), (1, 83, .5, .85), (1.5, 86, .5, .9)],
}
STYLE_CYCLE = {
    'intro': (4, ['Cmaj7', 'Fmaj7']),
    'tension': (4, ['Am', 'Em']),
    'lift': (2, ['F', 'G', 'C', 'C']),
    'groove': (4, ['C', 'G', 'Am', 'F']),
    'peak': (2, ['F', 'G', 'Am', 'G2']),
    'end': (64, ['Cadd9']),
}


def chord_name(c):
    return 'G' if c == 'G2' else c


def ep_chord(name, t0, dur, vel):
    for m in EPV[EP_OF.get(name, name)]:
        add('ep', ep_note(m, dur, hv(vel)), hum(t0, 0.006), pan=0.0)


def arp(name, t0, n8, vel, pattern=(0, 1, 2, 3), step=0.5, ring=0.7, limit=None):
    tones = ARPV[chord_name(name)]
    for k in range(n8):
        b = k * step
        if limit is not None and b >= limit:
            break
        add('pluck', ks_pluck(tones[pattern[k % len(pattern)]], ring * S, hv(vel)), hum(t0 + b * BEAT), pan=0.3)


def kick_at(t, vel):
    add('kick', kick(vel), t)
    kick_times.append((t, vel))


def melody(notes, t0, beats, with_lead=False):
    for b, m, d, v in notes:
        if b >= beats:
            continue
        d = min(d, beats - b)
        add('mallet', mallet(m, d * BEAT, hv(v, 0.04)), hum(t0 + b * BEAT, 0.003), pan=-0.1)
        if with_lead:
            add('lead', lead(m - 12, d * BEAT * 0.9, hv(v, 0.04)), hum(t0 + b * BEAT, 0.003))


# ---------------------------------------------------------------- 段落
def style_of(i, prev):
    """段落风格：沿用原片「钩子 → 紧张 → 解决 → 主歌律动 → 高潮 → 收束」的走向。"""
    m = moods[i]
    if n_seg > 1 and i == n_seg - 1:
        return 'end'
    if i == 0:
        return 'intro'
    if m >= 0.7:
        return 'tension'
    if i == n_seg - 2 and n_seg >= 4:
        return 'peak'
    if prev in ('intro', 'tension'):
        return 'lift'  # 紧张之后先来一段 F–G–C 解决
    return 'groove'


def chunk(style, ch, t0, nb, seg_prog, mood, k_in_style):
    """一个和弦块：t0 起 nb 拍。seg_prog = 本块在段落里的进度 0..1。"""
    L = nb * BEAT
    c = chord_name(ch)
    if style == 'intro':
        add('pad', pad_chord(PADV[c], L, 0.8, 900, attack=0.6 * S), t0)
        for b, m in INTRO_PL[c]:
            if b < nb:
                add('pluck', ks_pluck(m, 1.2 * S, hv(1.25), t60=1.8), hum(t0 + b * BEAT), pan=0.3)
        if mood >= 0.7:
            for b in (0, 2):
                if b < nb:
                    add('heart', heartbeat(0.6), t0 + b * BEAT)
    elif style == 'tension':
        add('pad', pad_chord(PADV[c], L, 0.85, 650, attack=0.3 * S), t0)
        ep_chord(c, t0, min(1.2 * S, L), 0.5)
        if nb > 2.5:
            ep_chord(c, t0 + 2.5 * BEAT, min(1.0 * S, L - 2.5 * BEAT), 0.42)
        for q in range(int(nb * 2)):
            prog = min(1.0, seg_prog + q / max(1, nb * 2) * 0.25)
            add('pulse', pulse(ROOT[c] if c != 'Em' else 40, 0.2 * S, 0.55 + 0.45 * prog), t0 + q * 0.5 * BEAT)
        for b in (0, 2):
            if b < nb:
                add('heart', heartbeat(0.9), t0 + b * BEAT)
                add('heart', heartbeat(0.55), t0 + b * BEAT + 0.17 * S)
                kick_times.append((t0 + b * BEAT, 0.5))
    elif style == 'lift':
        add('pad', pad_chord(PADV[c], L, 0.85, 1300, attack=0.15 * S, rel=0.6), t0)
        ep_chord(c, t0, min(0.9 * S, L), 0.6)
        arp(c, t0, int(nb * 2), 0.7, limit=nb)
        add('bass', bass(ROOT[c], L * 0.95, 0.7), t0)
        for q in range(int(nb * 2)):
            add('hats', hat(hv(0.45 if q % 2 == 0 else 0.3)), hum(t0 + q * 0.5 * BEAT, 0.003), pan=0.25)
    elif style == 'groove':
        add('pad', pad_chord(PADV[c], L, 1.0, 1900, attack=0.05, rel=0.5), t0)
        r = ROOT[c]
        ep_chord(c, t0, min(0.9 * S, L), 0.7)
        for b, d, v in [(1.5, 0.35, 0.5), (2.5, 0.8, 0.62)]:
            if b < nb:
                ep_chord(c, t0 + b * BEAT, min(d * S, L - b * BEAT), v)
        for off, iv, d, v in [(0, 0, 0.6, 1.0), (1.5, 0, 0.2, 0.8), (2, 0, 0.45, 0.9), (3, 12, 0.2, 0.75), (3.5, 7, 0.2, 0.8)]:
            if off < nb:
                add('bass', bass(r + iv, d * S, hv(v, 0.04)), hum(t0 + off * BEAT, 0.002))
        for b in (0, 1.5, 2):
            if b < nb:
                kick_at(t0 + b * BEAT, 1.0 if b in (0, 2) else 0.8)
        for b in (1, 3):
            if b < nb:
                add('snare', clap(hv(0.9)), t0 + b * BEAT)
                add('snare', snare(hv(0.55)), t0 + b * BEAT)
        for q in range(int(nb * 4)):
            v = [0.55, 0.18, 0.38, 0.18][q % 4]
            sw = 0.012 * S if q % 2 == 1 else 0.0
            add('hats', hat(hv(v)), hum(t0 + q * 0.25 * BEAT + sw, 0.002), pan=0.25)
        if k_in_style >= 2:
            arp(c, t0, int(nb * 2), 0.55, pattern=(0, 1, 2, 3, 2, 3, 1, 2), limit=nb)
        melody(MEL_GROOVE[c], t0, nb)
    elif style == 'peak':
        add('pad', pad_chord(PADV[c], L, 1.4, 2800, attack=0.03, rel=0.4), t0)
        ep_chord(c, t0, min(0.45 * S, L), 0.85)
        if nb > 1:
            ep_chord(c, t0 + BEAT, 0.2 * S, 0.45)
        if nb > 1.5:
            ep_chord(c, t0 + 1.5 * BEAT, 0.35 * S, 0.6)
        r = ROOT[c]
        for q, (iv, v) in enumerate([(0, 1.0), (12, 0.8), (0, 0.9), (12, 0.8)] * 2):
            if q * 0.5 < nb:
                add('bass', bass(r + iv, 0.2 * S, hv(v, 0.04)), hum(t0 + q * 0.5 * BEAT, 0.002))
        arp(c, t0, int(nb * 2), 0.85, limit=nb)
        for b in range(int(nb)):
            kick_at(t0 + b * BEAT, 1.0)
            if (k_in_style * 2 + b) % 2 == 1 or seg_prog > 0.6:
                v = 1.0 if (k_in_style * 2 + b) % 2 == 1 else 0.75
                add('snare', clap(hv(0.9 * v)), t0 + b * BEAT)
                add('snare', snare(hv(0.6 * v)), t0 + b * BEAT)
        for q in range(int(nb * 4)):
            if q % 4 == 2:
                add('hats', hat(hv(0.45), open_=True), hum(t0 + q * 0.25 * BEAT, 0.002), pan=0.25)
            else:
                v = [0.6, 0.25, 0.0, 0.25][q % 4]
                add('hats', hat(hv(v)), hum(t0 + q * 0.25 * BEAT + (0.01 * S if q % 2 else 0), 0.002), pan=0.25)
        melody(MEL_PEAK[ch], t0, nb, with_lead=True)


def end_section(t0, nb):
    L = nb * BEAT
    hold = min(L, 7.2 * S)
    add('pad', pad_chord(PADV['Cadd9'], hold, 1.0, 1500, attack=0.08, rel=1.2), t0)
    ep_chord('Cadd9', t0, min(3.0 * S, L), 0.7)
    add('bass', bass(36, min(3.2 * S, L), 0.9), t0)
    add('mallet', mallet(84, min(3, nb) * BEAT, 0.95), t0, pan=-0.1)
    kick_at(t0, 1.0)
    if nb > 2:
        kick_at(t0 + 2 * BEAT, 0.55)
    for b, v1, v2 in [(1, 0.6, 0.35), (3, 0.35, 0.0)]:
        if b < nb:
            add('snare', clap(v1), t0 + b * BEAT)
            if v2:
                add('snare', snare(v2), t0 + b * BEAT)
    for q in range(min(8, int(nb * 2))):
        add('hats', hat(0.5 * (1 - q / 8) ** 1.5 + 0.03), hum(t0 + q * 0.5 * BEAT, 0.003), pan=0.25)
    add('crash', crash(0.75), t0, pan=-0.2)
    b0 = 4 if nb >= 6 else max(1, nb - 2)
    for k, m in enumerate([72, 76, 79, 84]):
        if b0 + k * 0.5 < nb:
            add('pluck', ks_pluck(m, 1.5 * S, 0.5, t60=2.0), hum(t0 + (b0 + k * 0.5) * BEAT), pan=0.3)


segs = []
_prev = None
for i, c0 in enumerate(cues):
    c1 = cues[i + 1] if i + 1 < n_seg else DUR
    if c1 - c0 < BEAT * 0.5 or c0 >= DUR:
        continue
    _prev = style_of(i, _prev)
    segs.append((i, c0, min(c1, DUR), _prev, moods[i], types[i]))

counters = defaultdict(int)
prev_style = None
plan = []
for i, a, b, style, mood, typ in segs:
    nb = max(1, int(round((b - a) / BEAT)))
    plan.append(f'{a:6.2f}s  {typ:<10} mood={mood:.2f}  → {style}')
    # ---- 切换处：镲 / 加花 / 上扬 ----
    if i > 0:
        if style in ('groove', 'peak', 'end'):
            add('crash', crash(0.8 if style != 'groove' else 0.65), a, pan=-0.2)
            if prev_style not in ('groove', 'peak'):
                rl = min(2 * BEAT, a)
                add('fx', riser(rl), a - rl)
        elif style == 'tension' and prev_style != 'tension':
            kick_at(a, 0.9)
            add('crash', crash(0.45), a, pan=-0.2)
        else:
            add('crash', crash(0.4), a, pan=0.2)
        if prev_style in ('lift', 'groove'):
            add('snare', snare(0.35), a - 0.5 * BEAT)
            add('snare', snare(0.5), a - 0.25 * BEAT)
        elif prev_style == 'peak':
            for k, v in enumerate([0.45, 0.6, 0.75, 0.9]):
                add('snare', snare(v), a - BEAT + k * 0.25 * BEAT)
    if style == 'end':
        end_section(a, nb)
    else:
        step, cyc = STYLE_CYCLE[style]
        k = 0
        while k < nb:
            ln = min(step, nb - k)
            ch = cyc[counters[style] % len(cyc)]
            chunk(style, ch, a + k * BEAT, ln, k / nb, mood, counters[style])
            counters[style] += 1
            k += ln
    prev_style = style

print('段落：\n  ' + '\n  '.join(plan))

# ---------------------------------------------------------------- bus processing（原样保留）
t_axis = np.arange(N) / SR


def duck_env(depth):
    env = np.ones(N)
    Ld = int(0.45 * SR)
    tt = np.arange(Ld) / SR
    shape = np.minimum(1, tt / 0.003) * np.exp(-tt / 0.11)
    for t0, v in kick_times:
        i = int(round(t0 * SR))
        if i >= N:
            continue
        seg = env[i:i + Ld]
        seg *= 1 - depth * v * shape[:len(seg)]
    return env


bus['pad'] = filt(hp(120), bus['pad']) * duck_env(0.45)
bus['bass'] = filt(hp(35), filt(lp(1100), bus['bass'])) * duck_env(0.3)
bus['ep'] = filt(hp(90), filt(lp(5000), bus['ep'])) * duck_env(0.18)
trem = 0.18 * np.sin(2 * np.pi * (1.6 / BEAT) * t_axis * 0.5)
bus['ep'][0] *= 1 + trem
bus['ep'][1] *= 1 - trem
bus['pluck'] = filt(hp(150), bus['pluck']) * duck_env(0.15)
D = int(0.75 * BEAT * SR)  # 3/16 乒乓延迟
dry = bus['pluck'].copy()
mono = filt(lp(3500), dry.mean(axis=0))
for k in range(1, 4):
    if k * D >= N:
        break
    g = 0.32 ** k
    ch = 1 if k % 2 == 1 else 0
    bus['pluck'][ch, k * D:] += mono[:N - k * D] * g
bus['pulse'] = filt(hp(40), bus['pulse'])
bus['kick'] = filt(hp(30), bus['kick'])
bus['snare'] = filt(lp(9000), filt(hp(120), bus['snare']))
bus['hats'] = filt(lp(12500), bus['hats'])
bus['mallet'] = filt(hp(200), bus['mallet'])
bus['lead'] = filt(hp(200), bus['lead'])
bus['fx'] = filt(hp(300), bus['fx'])


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def active_rms_db(x):
    """只在这件乐器「在演奏」的地方量 RMS（原脚本是按固定时间窗量的）。"""
    e = uniform_filter1d((x ** 2).mean(axis=0), size=int(0.4 * SR), mode='nearest')
    if e.max() <= 1e-14:
        return None
    m = e > e.max() * 10 ** (-30 / 10)
    return 10 * np.log10(e[m].mean() + 1e-20)


TARGET = {
    'kick': -18, 'bass': -20, 'snare': -22.5, 'hats': -30, 'pad': -22.5, 'ep': -23,
    'pluck': -27, 'mallet': -19.5, 'lead': -24, 'pulse': -20, 'heart': -24, 'crash': -31, 'fx': -33,
}
for k, tgt in TARGET.items():
    cur = active_rms_db(bus[k])
    if cur is None:
        continue
    bus[k] *= 10 ** ((tgt + THEME_GAIN.get(k, 0) - cur) / 20)

SEND = {'pad': .35, 'ep': .3, 'pluck': .35, 'mallet': .3, 'lead': .3, 'snare': .25, 'hats': .08, 'crash': .3, 'pulse': .1, 'fx': .3}


def make_ir(rt60=1.7, pre=0.02, length=2.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        noise = rng.standard_normal(n)
        lo = filt(lp(3000), noise)
        hi = noise - lo
        ir = lo * np.exp(-6.9 * t / rt60) + 0.4 * hi * np.exp(-6.9 * t / (rt60 * 0.4))
        ir *= np.minimum(1, t / 0.01)
        ir = np.concatenate([np.zeros(int(pre * SR)), ir])
        ir = filt(hp(180), ir)
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


send = sum(bus[k] * v for k, v in SEND.items())
irs = make_ir()
wet = np.vstack([ss.fftconvolve(send[c], irs[c])[:N] for c in range(2)])
dry = sum(bus.values())
mix = dry + 0.38 * wet
mix = filt(hp(28), mix)
mix = filt(lp(16000, 1), mix)

fi = int(0.004 * SR)
mix[:, :fi] *= np.linspace(0, 1, fi)
fo = int(min(1.5, DUR * 0.1) * SR)
x = np.linspace(0, 1, fo)
mix[:, -fo:] *= 0.5 * (1 + np.cos(np.pi * x))


# ---------------------------------------------------------------- mastering（原样保留）
def measure(path):
    r = subprocess.run(
        [*FFMPEG_CMD, '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
        capture_output=True,
    )
    err = r.stderr.decode('utf-8', 'replace')
    summ = err[err.rfind('Summary:'):]
    I = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summ).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', summ).group(1))
    return I, tp


def limit(x, ceil_db=CEIL_DBTP, win_ms=12):
    c = 10 ** (ceil_db / 20)
    up = ss.resample_poly(x, 4, 1, axis=1)
    pk = np.abs(up[:, :4 * N]).reshape(2, N, 4).max(axis=2).max(axis=0)
    greq = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    W = int(win_ms / 1000 * SR)
    g = minimum_filter1d(greq, size=2 * W + 1, mode='nearest')
    g = uniform_filter1d(g, size=2 * W + 1, mode='nearest')
    return x * g, 20 * np.log10(g.min())


tmpdir = tempfile.mkdtemp(prefix='bgm-')
tmp_wav = os.path.join(tmpdir, 'measure.wav')
gain = 1.0
try:
    _probe = subprocess.run([*FFMPEG_CMD, '-version'], capture_output=True, timeout=30)
    use_ff = _probe.returncode == 0
except Exception:  # noqa: BLE001
    use_ff = False
if not use_ff:
    gain = 10 ** ((args.lufs - 2 - rms_db(mix)) / 20)
y = mix
for it in range(5):
    y, gr = limit(mix * gain)
    if not use_ff:
        print(f'没找到 ffmpeg，按 RMS 近似：RMS={rms_db(y):.2f} dBFS')
        break
    wavfile.write(tmp_wav, SR, y.T.astype(np.float32))
    try:
        I, tp = measure(tmp_wav)
    except Exception as e:  # noqa: BLE001
        print('响度测量失败，按当前增益输出：', e)
        break
    print(f'iter {it}: gain {20 * np.log10(gain):+.2f} dB  I={I:.2f} LUFS  TP={tp:.2f} dBTP  maxGR={gr:.2f} dB')
    if abs(I - args.lufs) < 0.15:
        break
    gain *= 10 ** ((args.lufs - I) / 20)
try:
    os.remove(tmp_wav)
    os.rmdir(tmpdir)
except OSError:
    pass

d = rng.random(y.shape) - rng.random(y.shape)  # TPDF dither -> int16
pcm = np.clip(np.round(y * 32767 + d), -32768, 32767).astype(np.int16)
out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, pcm.T.copy())
print(f'written {out}  {DUR:.2f}s  {60 / BEAT:.0f} BPM  theme={args.theme} (移调 {TR:+d})')
sys.exit(0)
