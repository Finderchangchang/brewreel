# -*- coding: utf-8 -*-
"""
无 agent 模式：简报 → 便宜模型写分镜 → 校验（报错原文回喂，最多重试 3 次）→ 通读检查 → make.mjs 出片。

  python scripts/llm_make.py <brief.md> [--out <输出目录>] [--example <样例.json>] [--retries 3]
      [--no-render] [--dry-run] [--voice minimax|aliyun|volcengine|mock]
      [--style cards|quiz|journey] [--lang zh|en] [--skip-readthrough-gate]

接口（OpenAI 兼容 /chat/completions），运行时从环境变量读：
  LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
  LLM_BASE_URL  默认 https://api.deepseek.com
  LLM_MODEL     默认 deepseek-flash
产物：
  <简报目录>/<简报名>.storyboard.json   模型写的分镜（素材路径相对简报目录）
  <输出目录>（默认 <简报目录>/<简报名>_out/）  video.mp4、sheet.png、check/、llm_log.json
--dry-run：不调接口、不读密钥，只把拼好的提示写到 <输出目录>/prompt.txt 并估算 token 数。
--voice：可选开启配音。模型会写 meta.voice（provider 就是这里给的值）和每镜一句 vo；出片要对应的环境变量（minimax = MINIMAX_API_KEY，
  aliyun = DASHSCOPE_API_KEY，volcengine = VOLCENGINE_TTS_API_KEY），
  没有 key 先用 --voice mock（不联网的占位音，只看节奏，不能交付）。不给 --voice 就不配音，和以前一样。
--style：指定配方。不写时从简报识别；简报没写或认不出，就用 cards（和 SKILL.md「拿不准就用 cards」一致）。
--skip-readthrough-gate：通读检查有问题只警告，仍出片。默认拦下、不出片。
"""
import argparse
import http.client
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES_SRC = os.path.join(ROOT, 'template', 'src', 'styles')
DEFAULT_STYLE = 'cards'
# 短中文名。完整中英文名从 style.json 的 name 读。目标 id 不在稳定列表里就不注册。
_SHORT_ALIASES = (
    ('卡片', 'cards'),
    ('答题', 'quiz'),
    ('漫游', 'journey'),
    ('旅程', 'journey'),
)
_LABEL_LINE = re.compile(
    r'(?im)^[ \t]*(?:(?:[-*+]|\d+\.)[ \t]+)?'
    r'(?:\*\*|__)?(?:配方|recipe|meta\.style)(?:\*\*|__)?'
    r'[ \t]*[:：=][ \t]*(.+?)\s*$'
)
_HEADING_LINE = re.compile(r'^[ \t]*#{1,6}[ \t]+(.*)$')
_SKIP_VALUE_PREFIX = ('不写', '不要', '写了才', '没写', '请写', '例：', '例:', 'example:', 'e.g.')
_SECRET_RE = re.compile(r'(?i)(bearer\s+)\S+|\bsk-[A-Za-z0-9_-]{8,}')


class LlmError(Exception):
    """接口失败、返回体不是 JSON、或缺少 choices。消息里不含密钥。"""


class BadLlmResponse(LlmError):
    """返回体不是 JSON，或没有 choices / message.content。按网络错误同样重试。"""


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().lstrip('\ufeff')


def write(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def est_tokens(text):
    """粗估：中日韩字符约 0.7 token/字，其余约 3.5 字符/token。"""
    cjk = sum(1 for ch in text if '\u2e80' <= ch <= '\u9fff' or '\uff00' <= ch <= '\uffef' or '\u3000' <= ch <= '\u303f')
    return int(cjk * 0.7 + (len(text) - cjk) / 3.5)


def redact(text):
    def repl(m):
        return 'Bearer [redacted]' if m.group(1) else 'sk-[redacted]'
    return _SECRET_RE.sub(repl, str(text))


def load_stable_styles():
    """从 template/src/styles/<id>/style.json 读 status 为 stable 的配方。跳过 _ 开头的目录。"""
    found = {}
    if not os.path.isdir(STYLES_SRC):
        return found
    for name in sorted(os.listdir(STYLES_SRC)):
        if name.startswith('_') or name.startswith('.'):
            continue
        manifest_path = os.path.join(STYLES_SRC, name, 'style.json')
        if not os.path.isfile(manifest_path):
            continue
        try:
            data = json.loads(read(manifest_path))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get('status') != 'stable':
            continue
        found[name] = data
    return found


STABLE_MANIFESTS = load_stable_styles()
STABLE_IDS = set(STABLE_MANIFESTS)


def build_alias_table(manifests):
    table = {}
    for sid, man in manifests.items():
        table[sid.lower()] = sid
        name = man.get('name') if isinstance(man, dict) else None
        values = []
        if isinstance(name, dict):
            values = [v for v in name.values() if isinstance(v, str)]
        elif isinstance(name, str):
            values = [name]
        for v in values:
            key = v.strip().lower()
            if key:
                table[key] = sid
    for zh, sid in _SHORT_ALIASES:
        if sid in manifests:
            table[zh.lower()] = sid
    return table


STYLE_ALIASES = build_alias_table(STABLE_MANIFESTS)


def _clean_value(value):
    v = (value or '').strip().strip('`"*')
    v = re.sub(r'（[^）]*）|\([^)]*\)', ' ', v)
    v = re.split(r'[；;，,。]', v, maxsplit=1)[0]
    return v.strip().strip('`"*')


def _find_ids(text, table):
    keys = sorted(table, key=len, reverse=True)
    s = text or ''
    found = []
    while s:
        low = s.lower()
        hit = next((k for k in keys if low.startswith(k)), None)
        if hit:
            sid = table[hit]
            if sid not in found:
                found.append(sid)
            s = s[len(hit):]
        else:
            s = s[1:]
    return found


def _is_instruction(raw):
    low = raw.lower()
    return raw.startswith(_SKIP_VALUE_PREFIX) or low.startswith(_SKIP_VALUE_PREFIX)


def parse_brief_style(brief_text, table=None, stable_ids=None):
    """从简报里认配方。返回 (id 或 None, warnings)。认不出、多个互相矛盾时 id 为 None，并带警告。"""
    table = STYLE_ALIASES if table is None else table
    stable_ids = STABLE_IDS if stable_ids is None else stable_ids
    text = brief_text or ''
    names = '、'.join(sorted(stable_ids)) or '（没有 status=stable 的配方）'
    picks = []
    warns = []
    poison = False

    def unknown(token):
        nonlocal poison
        poison = True
        shown = (token or '').strip().replace('\n', ' ')
        if len(shown) > 40:
            shown = shown[:40] + '…'
        warns.append(f'简报写了配方「{shown}」，但认不出（可用：{names}）。')

    for m in _LABEL_LINE.finditer(text):
        cleaned = _clean_value(m.group(1))
        ids = _find_ids(cleaned, table)
        if len(ids) == 1:
            picks.append(ids[0])
        elif len(ids) > 1:
            poison = True
            warns.append(f'简报这一行写了多个配方（{"、".join(ids)}），没有采用。')
        elif cleaned.strip():
            unknown(cleaned)

    lines = text.splitlines()
    i = 0
    while i < len(lines):
        hm = _HEADING_LINE.match(lines[i])
        if not hm or not re.search(r'配方|recipe', hm.group(1), re.I):
            i += 1
            continue
        j = i + 1
        while j < len(lines):
            if _HEADING_LINE.match(lines[j]):
                break
            raw = lines[j].strip()
            j += 1
            if not raw or _is_instruction(raw) or _LABEL_LINE.match(raw):
                continue
            if len(raw) > 40:
                continue
            ids = _find_ids(_clean_value(raw), table)
            if len(ids) >= 2:
                continue
            if len(ids) == 1:
                picks.append(ids[0])
                break
            unknown(raw)
            break
        i = j

    if poison:
        return None, warns
    uniq = []
    for sid in picks:
        if sid not in uniq:
            uniq.append(sid)
    if len(uniq) > 1:
        warns.append(f'简报里写了不止一个配方（{"、".join(uniq)}），没有采用。')
        return None, warns
    if len(uniq) == 1:
        return uniq[0], warns
    return None, warns


def resolve_style(brief_text, style_arg):
    """命令行 --style 优先。都没写成稳定 id 时用 cards，并留下警告。"""
    brief_pick, warns = parse_brief_style(brief_text)
    chosen = (style_arg or '').strip().lower()
    if chosen:
        if chosen not in STABLE_IDS:
            names = '、'.join(sorted(STABLE_IDS))
            raise SystemExit(f'不认识的配方 {chosen}。只能是 {names}。')
        if brief_pick and brief_pick != chosen:
            warns.append(f'简报里的配方是 {brief_pick}，这次用命令行 --style {chosen}。')
        return chosen, warns
    if brief_pick:
        return brief_pick, warns
    return DEFAULT_STYLE, warns


def style_mismatch_error(sb, chosen):
    """meta.style 没写按 cards 算。和指定配方不一致就返回一条可回喂的校验错误。"""
    if not isinstance(sb, dict):
        return None
    meta = sb.get('meta')
    if not isinstance(meta, dict):
        meta = {}
    got = meta.get('style')
    if isinstance(got, str) and got.strip():
        actual = got.strip()
        shown = got.strip()
    else:
        actual = DEFAULT_STYLE
        shown = '（没写，按 cards 算）'
    if actual == chosen:
        return None
    fix = f'把 meta.style 改成 "{chosen}"' if chosen != DEFAULT_STYLE else '删掉 meta.style，或写成 "cards"'
    return {
        'where': 'meta.style',
        'problem': f'meta.style 是「{shown}」，这次指定的配方是 {chosen}',
        'fix': fix,
    }


def load_style_pack(style, lang):
    folder = os.path.join(ROOT, 'styles', style)
    if lang == 'en' and os.path.isfile(os.path.join(folder, 'STYLE.en.md')):
        style_name = 'STYLE.en.md'
    else:
        style_name = 'STYLE.md'
    recipes_name = 'recipes.md'
    if lang == 'en':
        if os.path.isfile(os.path.join(folder, 'recipes.en.md')):
            recipes_name = 'recipes.en.md'
        else:
            print(f'提示：配方 {style} 没有 recipes.en.md，这次仍用中文 recipes.md（未翻译）。')
    chunks = []
    for name in (style_name, recipes_name):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            raise SystemExit(f'找不到配方说明：{path}')
        chunks.append(f'======== styles/{style}/{name} ========\n' + read(path))
    return '\n\n'.join(chunks)


def load_shot_notes(style, lang):
    """配方自己的镜头说明。没有就不附（cards 的镜头目录是仓库根上的 shots.md，不在这里）。"""
    folder = os.path.join(ROOT, 'styles', style)
    names = ('shots.en.md', 'shots.md') if lang == 'en' else ('shots.md',)
    for name in names:
        path = os.path.join(folder, name)
        if os.path.isfile(path):
            return f'======== styles/{style}/{name} ========\n' + read(path)
    return ''


def pick_example(style, voice, explicit=None):
    """--example 优先。cards 固定用 examples/ledger.json。其它配方用 styles/<id>/examples/ 里的第一份，--voice 时优先带 voice 的那份。"""
    if explicit:
        return explicit
    if style == DEFAULT_STYLE:
        return os.path.join(ROOT, 'examples', 'ledger.json')
    folder = os.path.join(ROOT, 'styles', style, 'examples')
    names = []
    if os.path.isdir(folder):
        names = sorted(n for n in os.listdir(folder) if n.endswith('.json') and not n.startswith('_'))
    voiced = [n for n in names if 'voice' in n.lower()]
    plain = [n for n in names if 'voice' not in n.lower()]
    if voice and voiced:
        return os.path.join(folder, voiced[0])
    if plain:
        return os.path.join(folder, plain[0])
    if voiced:
        return os.path.join(folder, voiced[0])
    print(f'警告：配方 {style} 没有自己的样例，改用 examples/ledger.json。')
    return os.path.join(ROOT, 'examples', 'ledger.json')


def build_messages(brief_text, example_text, example_name, lang='zh', voice=None, style=None):
    style = style or DEFAULT_STYLE
    skill = read(os.path.join(ROOT, 'SKILL.md'))
    intro = [
        '你是竖版产品宣传短片的分镜编剧。下面是你要遵守的说明书（SKILL.md）'
        + ('和镜头目录（shots.md）。' if style == DEFAULT_STYLE else f'和配方 {style} 的写法说明。'),
        '现在是「无 agent 模式」：你不能运行任何命令、不能看图，只输出 storyboard.json 的内容。'
        '校验和出片由程序代劳；校验不通过时，程序会把报错原文发给你，你按「怎么改」修改后输出完整的新 JSON。',
        '输出要求：只输出一个 JSON 对象（最外层 {"meta": {...}, "shots": [...]}），不要 Markdown 代码块，不要任何解释文字。',
    ]
    if style == DEFAULT_STYLE:
        intro.append('素材路径（截图、logo）照抄简报里给的相对路径；简报没给截图就不要用 phone 镜头，用 mockApp。')
        intro.append(
            'meta.action 必填：一句话写清楚「用户做什么 → 产品给出什么」（核心动作），并且要有至少一镜演示类镜头（chat/phone/mockApp/photoShot）'
            '的按钮/输入/完成提示/面板等文字体现这个动作的关键词。'
        )
    else:
        intro.append('素材路径（截图、logo）照抄简报里给的相对路径。')
        intro.append('meta.action 必填：一句话写清楚「用户做什么 → 产品给出什么」（核心动作）。')
    if lang == 'en':
        intro.append(
            '这次要输出英文版：meta.lang 写 "en"，所有字幕（caption）、口号（slogan）等上屏文字都写成英文（自然地道，不要逐字翻译中文习惯说法）。'
            '英文字幕按拉丁字符数估宽：每行最多约 22 个字符，最多 2 行；不要用中文的“每行 12 个汉字”规则去卡英文。'
            '不要用 best / #1 / guaranteed / 100% / forever 这类绝对化用词。'
        )
    if voice:
        voice_line = (
            f'这次要配音（见 SKILL.md「配音」一节）：meta 里写 "voice": {{"provider": "{voice}", "subtitles": "karaoke"}}'
            '（音色 voiceId 按 SKILL.md 的推荐选一个合适的，拿不准就不写；speed 不写或写 1–1.15；不要写 model）。'
            '每镜写一个 vo 字段 = 这一镜要念的一句话：口语化、说给人听，一镜一句、只讲一件事，不换行；'
            '字数按每秒 4–5 个汉字（英文每秒 2.5 个词）估，不超过「这种镜头的最长秒数 − 0.5」秒能念完的量，推荐一句 8–20 字；'
            'vo 里带单位的数字必须能在 meta.facts 里找到，不用极限词和绝对化用语，{} 强调每句最多 1 处。'
        )
        if style == DEFAULT_STYLE:
            voice_line += 'cards 里 hook 照样写 caption（封面标题），其他镜头有 vo 就可以不写 caption（字幕由 vo 自动生成）；endCard 的 vo 带上产品名。'
        else:
            voice_line += (
                f'{style} 的字幕层是 none：不要写 caption。'
                'vo 就是这一镜要念的话，显示在该配方自己的字幕条上；字数上限以该配方 recipes 里「有配音时」为准。'
                '结尾那一镜的 vo 带上产品名。'
            )
        voice_line += '有 vo 的镜头时长由配音决定，dur / beats 照常写个大概即可。'
        intro.append(voice_line)
    else:
        intro.append('这次不配音：不要写 meta.voice，也不要写 vo 字段。')
    if style == DEFAULT_STYLE:
        intro.append(
            '这次用配方 cards。没在命令行或简报里指定别的配方时，默认就是 cards，不要改成 quiz 或 journey，也不要写 blueprint。'
            'meta.style 可以不写；写了就必须是 "cards"。'
        )
    else:
        intro.append(
            f'这次指定配方是 {style}。meta.style 必须写 "{style}"。'
            '镜头类型、顺序和字段以下面这份配方说明为准，不要改用别的配方，也不要写 blueprint。'
        )
    system = '\n'.join(intro)
    system += '\n\n======== SKILL.md ========\n' + skill
    if style == DEFAULT_STYLE:
        shots = read(os.path.join(ROOT, 'shots.md'))
        system += '\n\n======== shots.md ========\n' + shots
    system += '\n\n' + load_style_pack(style, lang)
    notes = load_shot_notes(style, lang)
    if notes:
        system += '\n\n' + notes
    tail = '请按 SKILL.md 的流程第 3–7 步，为这个产品写 storyboard.json。只输出 JSON。'
    if style != DEFAULT_STYLE:
        tail += f'\nmeta.style 必须是 "{style}"。'
    user = (
        f'参考样例（{example_name}，结构和写法可以学，内容不要照抄）：\n{example_text}\n\n'
        f'======== 简报 ========\n{brief_text}\n\n'
        + tail
    )
    return [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]


# ---- 通读检查：校验通过后，再让模型（同一接口）把全片文案按播放顺序读一遍，查规则查不出来的逻辑/语义问题 ----
# 不上屏、纯技术字段不参与通读，避免把图标名当文案念
_TRANSCRIPT_EXCLUDE_KEYS = {'icon', 'src', 'kind', 'visual', 'tone', 'chart', 'from', 'higherIs', 'type', 'mode',
                            'area', 'style', 'layout', 'source', 'tag', 'x', 'y', 'month', 'retouched', 'keepAudio',
                            'speed', 'trimStart', 'trimEnd', 'showFrom', 'quote', 'max', 'value_num'}


def _collect_strings(v, out):
    if isinstance(v, str):
        if v.strip():
            out.append(v)
    elif isinstance(v, list):
        for x in v:
            _collect_strings(x, out)
    elif isinstance(v, dict):
        for k, x in v.items():
            if k in _TRANSCRIPT_EXCLUDE_KEYS:
                continue
            _collect_strings(x, out)
    return out


def build_transcript(sb):
    """把 storyboard 按播放顺序串成一份「全片文案脚本」：每镜一行，caption + 关键 params 文字。"""
    lines = []
    for i, shot in enumerate(sb.get('shots') or []):
        if not isinstance(shot, dict):
            continue
        t = shot.get('type', '?')
        texts = []
        cap = shot.get('caption')
        if isinstance(cap, str):
            texts.append(cap)
        elif isinstance(cap, list):
            texts.extend(x for x in cap if isinstance(x, str))
        texts.extend(_collect_strings(shot.get('params', {}) or {}, []))
        clean = ' / '.join(x.replace('\n', ' ').replace('\\n', ' ') for x in texts if isinstance(x, str) and x.strip())
        lines.append(f'{i + 1}. [{t}] {clean}')
    return '\n'.join(lines)


def build_readthrough_messages(sb, brief_text, lang):
    transcript = build_transcript(sb)
    action = (sb.get('meta') or {}).get('action', '')
    if lang == 'en':
        system = (
            'You are proofreading the full on-screen script of a short vertical product-promo video, in play order. '
            'You did not write it; you are checking it, not rewriting it. '
            'Check it against this list and reply with ONLY a JSON object {"issues": ["..."]} (empty array if none):\n'
            '(a) Does each suggested chat reply actually respond to what the other person just said, from my side (not a copy of their complaint)?\n'
            '(b) Is there anything contradictory, off-topic, or ungrammatical across the whole script?\n'
            '(c) Is every caption addressed to the viewer (describing their situation or the payoff), not a stage/animation direction?\n'
            '(d) Does the demo shot actually show the core action named in meta.action?\n'
            '(e) Any spelling mistakes, or numbers that do not match the brief?\n'
            'Each issue string should be short and say which line number it is about. Output only the JSON object.'
        )
        user = f'Brief:\n{brief_text}\n\nmeta.action: {action}\n\nOn-screen script, in play order:\n{transcript}'
    else:
        system = (
            '你在给一支竖版产品宣传短片的全片文案做「通读检查」，按播放顺序整体读一遍，这不是你写的分镜，只负责挑问题。'
            '按下面的清单核对，只回答一个 JSON 对象 {"issues": ["..."]}（没问题就给空数组）：\n'
            '(a) 每一条推荐回复是不是真的在接对方刚才说的话（站在"我"的立场回，不是复述对方的诉求）；\n'
            '(b) 全片有没有前后矛盾、跑题、读不通顺的地方；\n'
            '(c) 每句字幕是不是说给观众听的话（讲处境或好处），不是写给剪辑师看的镜头/动画说明；\n'
            '(d) 演示镜有没有真的演出 meta.action 里说的核心动作；\n'
            '(e) 有没有错别字，或者数字和简报对不上。\n'
            '每条问题写清楚是第几行、哪里不对，尽量简短。只输出这个 JSON 对象，不要任何其他文字。'
        )
        user = f'简报：\n{brief_text}\n\nmeta.action：{action}\n\n全片文案（按播放顺序，格式「序号. [镜头类型] 文字」）：\n{transcript}'
    return [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]


def readthrough_gate(reason, skip):
    """通读失败时的决定。skip 为真只警告、不拦；否则 blocked，不出片。"""
    if skip:
        return False, f'{reason}。已带 --skip-readthrough-gate，只警告，仍出片。'
    return True, f'{reason}。通读检查未通过，不出片。'


def is_retryable_llm_error(err):
    if isinstance(err, urllib.error.HTTPError):
        return err.code in (429, 500, 502, 503, 504)
    if isinstance(err, urllib.error.URLError):
        return True
    if isinstance(err, (TimeoutError, ConnectionResetError, http.client.IncompleteRead, json.JSONDecodeError, BadLlmResponse)):
        return True
    return False


def call_llm(messages, key, base, model):
    url = base.rstrip('/') + '/chat/completions'  # https://api.deepseek.com 和 .../v1 两种写法都行
    body = json.dumps({
        'model': model,
        'messages': messages,
        'temperature': 0.7,
        'response_format': {'type': 'json_object'},
    }, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + key,
    })
    last = None
    for attempt in range(3):
        detail = ''
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                raw_bytes = r.read()
            try:
                data = json.loads(raw_bytes.decode('utf-8'))
            except json.JSONDecodeError:
                raise
            if not isinstance(data, dict):
                raise BadLlmResponse('接口返回不是 JSON 对象')
            choices = data.get('choices')
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                raise BadLlmResponse('接口返回里没有 choices')
            msg = choices[0].get('message')
            content = msg.get('content') if isinstance(msg, dict) else None
            if not isinstance(content, str):
                raise BadLlmResponse('接口返回里没有 message.content')
            usage = data.get('usage') if isinstance(data.get('usage'), dict) else {}
            return content, usage
        except Exception as e:
            last = e
            if isinstance(e, urllib.error.HTTPError):
                try:
                    detail = e.read().decode('utf-8', 'replace')[:500]
                except Exception:
                    detail = ''
            if is_retryable_llm_error(e) and attempt < 2:
                wait = 3 * (attempt + 1) if isinstance(e, urllib.error.HTTPError) else 3
                label = f'HTTP {e.code}' if isinstance(e, urllib.error.HTTPError) else type(e).__name__
                print(f'  接口 {label}，{wait} 秒后重试…')
                time.sleep(wait)
                continue
            if isinstance(e, urllib.error.HTTPError):
                raise LlmError(redact(f'接口报错 HTTP {e.code}：{detail}')) from None
            raise LlmError(redact(f'接口调用失败：{type(e).__name__}: {e}')) from None
    raise LlmError(redact(f'接口调用失败：{last}'))


def extract_json(text):
    t = text.strip()
    t = re.sub(r'^```(?:json)?\s*', '', t)
    t = re.sub(r'\s*```$', '', t)
    a, b = t.find('{'), t.rfind('}')
    return t[a:b + 1] if a >= 0 and b > a else t


def validate(sb_path, brief_path=None):
    # 传 --brief：校验会核对 meta.facts 里的数字和 quote 是否真在简报里（防止模型自己编 fact）
    extra = ['--brief', brief_path] if brief_path else []
    p = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'validate.mjs'), sb_path, '--json', *extra],
                       capture_output=True, encoding='utf-8', errors='replace')
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        return {'ok': False, 'errors': [{'where': '校验脚本', 'problem': (p.stdout + p.stderr)[-800:], 'fix': '检查 JSON 格式'}]}


def validate_with_style(sb_path, brief_path, chosen):
    r = validate(sb_path, brief_path)
    if not r.get('ok'):
        return r
    try:
        sb = json.loads(read(sb_path))
    except json.JSONDecodeError:
        return r
    err = style_mismatch_error(sb, chosen)
    if not err:
        return r
    return {**r, 'ok': False, 'errors': [err, *list(r.get('errors') or [])]}


def write_llm_log(path, model, entries):
    payload = {'model': model or '', 'entries': entries}
    write(path, json.dumps(payload, ensure_ascii=False, indent=2) + '\n')


def _note_gate(log, round_name, reason, skip, extra=None):
    blocked, msg = readthrough_gate(reason, skip)
    print('  ' + msg)
    item = {'round': round_name, 'error': reason, 'blocked': blocked}
    if extra:
        item.update(extra)
    log.append(item)
    return blocked


def main(argv=None):
    ap = argparse.ArgumentParser(description='简报 → 分镜 → 校验 → 出片（无 agent 模式）')
    ap.add_argument('brief', help='简报 .md（格式见 brief-template.md）')
    ap.add_argument('--out', help='输出目录，默认 <简报目录>/<简报名>_out')
    ap.add_argument('--example', default=None, help='喂给模型的样例分镜。不写时：cards 用 examples/ledger.json，其它配方用 styles/<id>/examples/ 里的第一份（--voice 优先带 voice 的那份）')
    ap.add_argument('--retries', type=int, default=3, help='校验失败后回喂重试的次数（默认 3）')
    ap.add_argument('--no-render', action='store_true', help='只出分镜，不渲染')
    ap.add_argument('--dry-run', action='store_true', help='不调接口：只写 prompt.txt 并估算 token')
    ap.add_argument('--lang', choices=['zh', 'en'], default='zh', help='字幕/文案语言，默认 zh；en 会要求模型写 meta.lang="en" 和英文字幕')
    ap.add_argument('--voice', choices=['minimax', 'aliyun', 'volcengine', 'mock'], help='可选开启配音：模型写 meta.voice 和每镜 vo。minimax 要 MINIMAX_API_KEY、aliyun 要 DASHSCOPE_API_KEY、volcengine 要 VOLCENGINE_TTS_API_KEY；没有 key 用 mock（占位音，只看节奏）')
    ap.add_argument('--style', choices=sorted(STABLE_IDS), help='指定配方。不写时从简报识别；认不出或没写就用 cards')
    ap.add_argument('--skip-readthrough-gate', action='store_true', help='通读检查有问题只警告，仍出片。默认拦下、不出片')
    a = ap.parse_args(argv)

    brief_path = os.path.abspath(a.brief)
    brief_dir = os.path.dirname(brief_path)
    stem = os.path.splitext(os.path.basename(brief_path))[0]
    out_dir = os.path.abspath(a.out or os.path.join(brief_dir, stem + '_out'))
    sb_path = os.path.join(brief_dir, stem + '.storyboard.json')
    brief_text = read(brief_path)
    style, warns = resolve_style(brief_text, a.style)
    for w in warns:
        print('警告：' + w)
    example_path = pick_example(style, a.voice, a.example)
    if not os.path.isfile(example_path):
        raise SystemExit(f'找不到样例：{example_path}')
    example_name = os.path.basename(example_path)
    messages = build_messages(brief_text, read(example_path), example_name, a.lang, a.voice, style)

    if a.dry_run:
        prompt_file = os.path.join(out_dir, 'prompt.txt')
        text = '\n\n'.join(f'##### {m["role"]} #####\n{m["content"]}' for m in messages)
        write(prompt_file, text)
        n = est_tokens(text)
        gate = '只警告' if a.skip_readthrough_gate else '有问题不出片'
        print(f'[dry-run] 提示已写到 {prompt_file}')
        print(f'[dry-run] 共 {len(text)} 字符，估算约 {n} 输入 token（system {est_tokens(messages[0]["content"])} + user {est_tokens(messages[1]["content"])}）')
        print(f'[dry-run] 每轮输出约 1500–3000 token；最多 1 + {a.retries} 轮，通过后再最多 2 轮通读检查。语言：{a.lang}。配音：{a.voice or "不配音"}。配方：{style}。样例：{example_name}。通读门禁：{gate}。未调用任何接口。')
        return 0

    key = os.environ.get('LLM_API_KEY') or os.environ.get('DEEPSEEK_API_KEY')
    if not key:
        print('没有找到 LLM_API_KEY / DEEPSEEK_API_KEY 环境变量。先设置再运行，或用 --dry-run 只看提示。')
        return 2
    base = os.environ.get('LLM_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('LLM_MODEL', 'deepseek-flash')
    print(f'模型 {model} @ {base}')
    print(f'配方：{style}。样例：{example_name}。')

    log = []
    ok = False
    blocked = False
    code = 1
    raw = ''
    try:
        for rnd in range(1 + max(0, a.retries)):
            print(f'第 {rnd + 1} 轮：请模型写分镜…')
            content, usage = call_llm(messages, key, base, model)
            raw = extract_json(content)
            write(sb_path, raw + '\n')
            r = validate_with_style(sb_path, brief_path, style)
            log.append({'round': rnd + 1, 'usage': usage, 'ok': r.get('ok'), 'errors': r.get('errors', [])})
            if r.get('ok'):
                ok = True
                print(f'  校验通过：{len(r.get("slots", []))} 镜，共 {r.get("total", 0):.1f} 秒')
                break
            errs = r.get('errors', [])
            print(f'  校验未通过：{len(errs)} 个问题')
            for e in errs[:8]:
                print(f'   - {e.get("where")}：{e.get("problem")}')
            feedback = '\n'.join(f'{k + 1}. {e.get("where")}：{e.get("problem")}\n   → 怎么改：{e.get("fix")}' for k, e in enumerate(errs))
            messages = messages + [
                {'role': 'assistant', 'content': raw},
                {'role': 'user', 'content': f'校验未通过，共 {len(errs)} 个问题（原文）：\n{feedback}\n\n请逐条按「怎么改」修改，其余内容保持不变，输出完整的新 JSON。只输出 JSON。'},
            ]

        # 校验通过后做通读。改稿后校验失败、通读解析失败、通读接口报错，默认都拦下不出片。
        # --skip-readthrough-gate：上述情况只警告，用最后一份能过校验的分镜出片。
        if ok:
            max_rt_fixes = 2
            for rt_round in range(max_rt_fixes + 1):
                print(f'通读检查第 {rt_round + 1} 轮…')
                try:
                    sb_now = json.loads(raw)
                except json.JSONDecodeError:
                    if _note_gate(log, f'readthrough-{rt_round + 1}', '分镜不是合法 JSON，通读检查无法进行', a.skip_readthrough_gate):
                        blocked = True
                    break
                rt_messages = build_readthrough_messages(sb_now, read(brief_path), a.lang)
                try:
                    rt_content, rt_usage = call_llm(rt_messages, key, base, model)
                    rt_obj = json.loads(extract_json(rt_content))
                    issues = rt_obj.get('issues', []) if isinstance(rt_obj, dict) else []
                    if not isinstance(issues, list):
                        issues = []
                except (LlmError, json.JSONDecodeError, TypeError, ValueError) as e:
                    if _note_gate(log, f'readthrough-{rt_round + 1}', f'通读结果解析失败或通读接口报错：{redact(e)}', a.skip_readthrough_gate):
                        blocked = True
                    break
                log.append({'round': f'readthrough-{rt_round + 1}', 'usage': rt_usage, 'issues': issues})
                if not issues:
                    print('  通读检查：没发现问题')
                    break
                print(f'  通读检查发现 {len(issues)} 个问题：')
                for it in issues[:8]:
                    print(f'   - {it}')
                if rt_round == max_rt_fixes:
                    if _note_gate(log, f'readthrough-{rt_round + 1}-leftover', f'已达通读检查最多重写次数（{max_rt_fixes}），问题还在', a.skip_readthrough_gate, {'issues': issues}):
                        blocked = True
                    break
                feedback = '\n'.join(f'{k + 1}. {it}' for k, it in enumerate(issues))
                fix_prompt = (
                    f'A read-through found {len(issues)} issue(s) (not a schema error, a content/logic issue):\n{feedback}\n\n'
                    'Fix each one, keep everything else the same, and output the complete new JSON. Output only JSON.'
                    if a.lang == 'en' else
                    f'通读检查发现 {len(issues)} 个问题（不是格式错误，是内容/逻辑问题，原文）：\n{feedback}\n\n请针对每条问题修改分镜，其余内容保持不变，输出完整的新 JSON。只输出 JSON。'
                )
                rt_fix_messages = messages + [{'role': 'assistant', 'content': raw}, {'role': 'user', 'content': fix_prompt}]
                try:
                    content, usage = call_llm(rt_fix_messages, key, base, model)
                except LlmError as e:
                    if _note_gate(log, f'readthrough-{rt_round}-revalidate', f'按通读问题改稿时接口报错：{redact(e)}', a.skip_readthrough_gate):
                        blocked = True
                    break
                new_raw = extract_json(content)
                write(sb_path, new_raw + '\n')
                rv = validate_with_style(sb_path, brief_path, style)
                log.append({'round': f'readthrough-{rt_round}-revalidate', 'usage': usage, 'ok': rv.get('ok'), 'errors': rv.get('errors', [])})
                if rv.get('ok'):
                    raw = new_raw
                    messages = rt_fix_messages
                else:
                    write(sb_path, raw + '\n')
                    if _note_gate(log, f'readthrough-{rt_round}-revert', '按通读问题改完后没能通过校验，已回退上一份能通过校验的分镜', a.skip_readthrough_gate):
                        blocked = True
                    break

        if not ok:
            code = 1
        elif blocked:
            code = 1
        else:
            code = 0
    except LlmError as e:
        msg = redact(str(e))
        print(msg)
        log.append({'error': msg})
        code = 1
        ok = False
    finally:
        try:
            write_llm_log(os.path.join(out_dir, 'llm_log.json'), model, log)
        except Exception as e:
            print(f'写 llm_log.json 失败：{e}')

    log_path = os.path.join(out_dir, 'llm_log.json')
    if not ok:
        wrote_round = any(isinstance(item, dict) and item.get('round') for item in log)
        if wrote_round:
            print(f'重试 {a.retries} 次仍未通过，分镜留在 {sb_path}，报错见 {log_path}')
        else:
            print(f'没有得到能通过校验的分镜。记录见 {log_path}')
        return 1
    if blocked:
        print(f'通读问题没有改完，不出片。分镜留在 {sb_path}，记录见 {log_path}')
        return 1
    print(f'分镜：{sb_path}')
    if a.no_render or code != 0:
        return code
    p = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'make.mjs'), sb_path, '--out', out_dir, '--brief', brief_path])
    return p.returncode


if __name__ == '__main__':
    sys.exit(main())
