# -*- coding: utf-8 -*-
"""
无 agent 模式：简报 → 便宜模型写分镜 → 校验（报错原文回喂，最多重试 3 次）→ make.mjs 出片。

  python scripts/llm_make.py <brief.md> [--out <输出目录>] [--example examples/ledger.json] [--retries 3] [--no-render] [--dry-run]

接口（OpenAI 兼容 /chat/completions），运行时从环境变量读：
  LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
  LLM_BASE_URL  默认 https://api.deepseek.com
  LLM_MODEL     默认 deepseek-chat
产物：
  <简报目录>/<简报名>.storyboard.json   模型写的分镜（素材路径相对简报目录）
  <输出目录>（默认 <简报目录>/<简报名>_out/）  video.mp4、sheet.png、check/、llm_log.json
--dry-run：不调接口、不读密钥，只把拼好的提示写到 <输出目录>/prompt.txt 并估算 token 数。
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().lstrip('﻿')


def write(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def est_tokens(text):
    """粗估：中日韩字符约 0.7 token/字，其余约 3.5 字符/token。"""
    cjk = sum(1 for ch in text if '⺀' <= ch <= '鿿' or '＀' <= ch <= '￯' or '　' <= ch <= '〿')
    return int(cjk * 0.7 + (len(text) - cjk) / 3.5)


def build_messages(brief_text, example_text, example_name, lang='zh'):
    skill = read(os.path.join(ROOT, 'SKILL.md'))
    shots = read(os.path.join(ROOT, 'shots.md'))
    system = (
        '你是竖版产品宣传短片的分镜编剧。下面是你要遵守的说明书（SKILL.md）和镜头目录（shots.md）。\n'
        '现在是「无 agent 模式」：你不能运行任何命令、不能看图，只输出 storyboard.json 的内容。'
        '校验和出片由程序代劳；校验不通过时，程序会把报错原文发给你，你按「怎么改」修改后输出完整的新 JSON。\n'
        '输出要求：只输出一个 JSON 对象（最外层 {"meta": {...}, "shots": [...]}），不要 Markdown 代码块，不要任何解释文字。\n'
        '素材路径（截图、logo）照抄简报里给的相对路径；简报没给截图就不要用 phone 镜头，用 mockApp。\n'
        'meta.action 必填：一句话写清楚「用户做什么 → 产品给出什么」（核心动作），并且要有至少一镜演示类镜头（chat/phone/mockApp/photoShot）'
        '的按钮/输入/完成提示/面板等文字体现这个动作的关键词。\n'
    )
    if lang == 'en':
        system += (
            '这次要输出英文版：meta.lang 写 "en"，所有字幕（caption）、口号（slogan）等上屏文字都写成英文（自然地道，不要逐字翻译中文习惯说法）。'
            '英文字幕按拉丁字符数估宽：每行最多约 22 个字符，最多 2 行；不要用中文的“每行 12 个汉字”规则去卡英文。'
            '不要用 best / #1 / guaranteed / 100% / forever 这类绝对化用词。\n'
        )
    system += '\n======== SKILL.md ========\n' + skill + '\n\n======== shots.md ========\n' + shots
    user = (
        f'参考样例（{example_name}，结构和写法可以学，内容不要照抄）：\n{example_text}\n\n'
        f'======== 简报 ========\n{brief_text}\n\n'
        '请按 SKILL.md 的流程第 3–7 步，为这个产品写 storyboard.json。只输出 JSON。'
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
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read().decode('utf-8'))
            return data['choices'][0]['message']['content'], data.get('usage', {})
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:500]
            if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                print(f'  接口 {e.code}，{3 * (attempt + 1)} 秒后重试…')
                time.sleep(3 * (attempt + 1))
                continue
            raise SystemExit(f'接口报错 HTTP {e.code}：{msg}')
        except urllib.error.URLError as e:
            if attempt < 2:
                time.sleep(3)
                continue
            raise SystemExit(f'连不上接口 {url}：{e}')


def extract_json(text):
    t = text.strip()
    t = re.sub(r'^```(?:json)?\s*', '', t)
    t = re.sub(r'\s*```$', '', t)
    a, b = t.find('{'), t.rfind('}')
    return t[a:b + 1] if a >= 0 and b > a else t


def validate(sb_path):
    p = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'validate.mjs'), sb_path, '--json'],
                       capture_output=True, encoding='utf-8', errors='replace')
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        return {'ok': False, 'errors': [{'where': '校验脚本', 'problem': (p.stdout + p.stderr)[-800:], 'fix': '检查 JSON 格式'}]}


def main():
    ap = argparse.ArgumentParser(description='简报 → 分镜 → 校验 → 出片（无 agent 模式）')
    ap.add_argument('brief', help='简报 .md（格式见 brief-template.md）')
    ap.add_argument('--out', help='输出目录，默认 <简报目录>/<简报名>_out')
    ap.add_argument('--example', default=os.path.join(ROOT, 'examples', 'ledger.json'), help='喂给模型的样例分镜')
    ap.add_argument('--retries', type=int, default=3, help='校验失败后回喂重试的次数（默认 3）')
    ap.add_argument('--no-render', action='store_true', help='只出分镜，不渲染')
    ap.add_argument('--dry-run', action='store_true', help='不调接口：只写 prompt.txt 并估算 token')
    ap.add_argument('--lang', choices=['zh', 'en'], default='zh', help='字幕/文案语言，默认 zh；en 会要求模型写 meta.lang="en" 和英文字幕')
    a = ap.parse_args()

    brief_path = os.path.abspath(a.brief)
    brief_dir = os.path.dirname(brief_path)
    stem = os.path.splitext(os.path.basename(brief_path))[0]
    out_dir = os.path.abspath(a.out or os.path.join(brief_dir, stem + '_out'))
    sb_path = os.path.join(brief_dir, stem + '.storyboard.json')

    messages = build_messages(read(brief_path), read(a.example), os.path.basename(a.example), a.lang)

    if a.dry_run:
        prompt_file = os.path.join(out_dir, 'prompt.txt')
        text = '\n\n'.join(f'##### {m["role"]} #####\n{m["content"]}' for m in messages)
        write(prompt_file, text)
        n = est_tokens(text)
        print(f'[dry-run] 提示已写到 {prompt_file}')
        print(f'[dry-run] 共 {len(text)} 字符，估算约 {n} 输入 token（system {est_tokens(messages[0]["content"])} + user {est_tokens(messages[1]["content"])}）')
        print(f'[dry-run] 每轮输出约 1500–3000 token；最多 1 + {a.retries} 轮，通过后再最多 2 轮通读检查。语言：{a.lang}。未调用任何接口。')
        return 0

    key = os.environ.get('LLM_API_KEY') or os.environ.get('DEEPSEEK_API_KEY')
    if not key:
        print('没有找到 LLM_API_KEY / DEEPSEEK_API_KEY 环境变量。先设置再运行，或用 --dry-run 只看提示。')
        return 2
    base = os.environ.get('LLM_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('LLM_MODEL', 'deepseek-chat')
    print(f'模型 {model} @ {base}')

    log = []
    ok = False
    for rnd in range(1 + max(0, a.retries)):
        print(f'第 {rnd + 1} 轮：请模型写分镜…')
        content, usage = call_llm(messages, key, base, model)
        raw = extract_json(content)
        write(sb_path, raw + '\n')
        r = validate(sb_path)
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

    # 校验通过后，再做一次「通读」：规则查不出来的逻辑/语义问题（回复答非所问、字幕像镜头说明、数字和简报对不上…），
    # 有问题就把问题原文回喂重写，最多 2 轮；每轮重写后要重新过校验，校验没过就放弃这次通读修改、保留上一份能过校验的分镜
    if ok:
        max_rt_fixes = 2  # 最多回喂重写 2 次；检查轮数 = 修回轮数 + 1（最后一轮只检查、不再改）
        for rt_round in range(max_rt_fixes + 1):
            print(f'通读检查第 {rt_round + 1} 轮…')
            try:
                sb_now = json.loads(raw)
            except json.JSONDecodeError:
                print('  分镜不是合法 JSON，跳过通读检查')
                break
            rt_messages = build_readthrough_messages(sb_now, read(brief_path), a.lang)
            try:
                rt_content, rt_usage = call_llm(rt_messages, key, base, model)
                rt_obj = json.loads(extract_json(rt_content))
                issues = rt_obj.get('issues', []) if isinstance(rt_obj, dict) else []
                if not isinstance(issues, list):
                    issues = []
            except Exception as e:
                print(f'  通读检查调用或解析失败，跳过本轮（{e}）')
                log.append({'round': f'readthrough-{rt_round + 1}', 'error': str(e)})
                break
            log.append({'round': f'readthrough-{rt_round + 1}', 'usage': rt_usage, 'issues': issues})
            if not issues:
                print('  通读检查：没发现问题')
                break
            print(f'  通读检查发现 {len(issues)} 个问题：')
            for it in issues[:8]:
                print(f'   - {it}')
            if rt_round == max_rt_fixes:
                print(f'  已达通读检查最多重写次数（{max_rt_fixes}），保留当前分镜继续出片')
                break
            feedback = '\n'.join(f'{k + 1}. {it}' for k, it in enumerate(issues))
            fix_prompt = (
                f'A read-through found {len(issues)} issue(s) (not a schema error, a content/logic issue):\n{feedback}\n\n'
                'Fix each one, keep everything else the same, and output the complete new JSON. Output only JSON.'
                if a.lang == 'en' else
                f'通读检查发现 {len(issues)} 个问题（不是格式错误，是内容/逻辑问题，原文）：\n{feedback}\n\n请针对每条问题修改分镜，其余内容保持不变，输出完整的新 JSON。只输出 JSON。'
            )
            rt_fix_messages = messages + [{'role': 'assistant', 'content': raw}, {'role': 'user', 'content': fix_prompt}]
            content, usage = call_llm(rt_fix_messages, key, base, model)
            new_raw = extract_json(content)
            write(sb_path, new_raw + '\n')
            rv = validate(sb_path)
            log.append({'round': f'readthrough-{rt_round}-revalidate', 'usage': usage, 'ok': rv.get('ok'), 'errors': rv.get('errors', [])})
            if rv.get('ok'):
                raw = new_raw
                messages = rt_fix_messages
            else:
                print('  按通读问题改完后没能通过校验，放弃这次修改，保留上一份能通过校验的分镜')
                write(sb_path, raw + '\n')  # 回退到修改前那份（已知能过校验）
                break

    write(os.path.join(out_dir, 'llm_log.json'), json.dumps(log, ensure_ascii=False, indent=2))
    if not ok:
        print(f'重试 {a.retries} 次仍未通过，分镜留在 {sb_path}，报错见 {os.path.join(out_dir, "llm_log.json")}')
        return 1
    print(f'分镜：{sb_path}')
    if a.no_render:
        return 0
    p = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'make.mjs'), sb_path, '--out', out_dir])
    return p.returncode


if __name__ == '__main__':
    sys.exit(main())
