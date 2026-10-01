# -*- coding: utf-8 -*-
"""llm_make 的纯函数和 --dry-run。不联网，不读密钥。"""
import inspect
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout

import http.client

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm_make

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def prompt_of(style, voice=None, lang='zh', example_name='sample.json', brief='简报正文'):
    buf = io.StringIO()
    with redirect_stdout(buf):
        msgs = llm_make.build_messages(brief, '{}', example_name, lang, voice, style)
    return msgs[0]['content'] + '\n' + msgs[1]['content'], buf.getvalue()


class StyleRecognition(unittest.TestCase):
    def test_forms(self):
        cases = {
            '配方：quiz': 'quiz',
            '- 配方：quiz': 'quiz',
            '**配方**：quiz': 'quiz',
            '## 配方\nquiz': 'quiz',
            '## 配方\n\nquiz': 'quiz',
            '配方：quiz（答题）': 'quiz',
            '配方：quiz答题': 'quiz',
            '配方：答题': 'quiz',
            '配方：答题互动': 'quiz',
            '配方：卡片': 'cards',
            '配方：卡片信息流': 'cards',
            '配方：漫游': 'journey',
            '配方：旅程': 'journey',
            '配方：角色漫游': 'journey',
            '- 配方：cards；语言：zh': 'cards',
            'meta.style: Quiz': 'quiz',
            'Recipe: journey': 'journey',
        }
        for text, want in cases.items():
            got, warns = llm_make.resolve_style(text, None)
            self.assertEqual(got, want, text)
            self.assertEqual(warns, [], text)

    def test_unfilled_template_is_cards_without_warning(self):
        text = llm_make.read(os.path.join(ROOT, 'brief-template.md'))
        got, warns = llm_make.resolve_style(text, None)
        self.assertEqual(got, 'cards')
        self.assertEqual(warns, [])

    def test_filled_template_label_and_heading(self):
        text = llm_make.read(os.path.join(ROOT, 'brief-template.md'))
        labeled = text.replace('例：`配方：quiz`', '配方：quiz', 1)
        got, warns = llm_make.resolve_style(labeled, None)
        self.assertEqual(got, 'quiz', warns)
        self.assertEqual(warns, [])
        menu = 'cards 卡片 / quiz 答题 / journey 漫游\n'
        headed = text.replace(menu, menu + 'quiz\n', 1)
        got, warns = llm_make.resolve_style(headed, None)
        self.assertEqual(got, 'quiz', warns)
        self.assertEqual(warns, [])

    def test_unknown_warns_and_falls_back_to_cards(self):
        got, warns = llm_make.resolve_style('配方：card', None)
        self.assertEqual(got, 'cards')
        self.assertTrue(warns)
        self.assertIn('认不出', warns[0])

    def test_unknown_plus_a_real_id_is_not_trusted(self):
        got, warns = llm_make.resolve_style('配方：card\n配方：quiz\n', None)
        self.assertEqual(got, 'cards')
        self.assertTrue(any('认不出' in w for w in warns))

    def test_ambiguous_does_not_pick(self):
        got, warns = llm_make.resolve_style('配方：quiz / journey', None)
        self.assertEqual(got, 'cards')
        self.assertTrue(warns)
        got, warns = llm_make.resolve_style('配方：quiz\n配方：journey\n', None)
        self.assertEqual(got, 'cards')
        self.assertTrue(any('不止' in w for w in warns))

    def test_menu_line_alone_is_not_a_choice(self):
        got, warns = llm_make.resolve_style('cards 卡片 / quiz 答题 / journey 漫游', None)
        self.assertEqual(got, 'cards')
        self.assertEqual(warns, [])

    def test_cli_style_wins(self):
        got, warns = llm_make.resolve_style('配方：cards', 'quiz')
        self.assertEqual(got, 'quiz')
        self.assertTrue(any('命令行' in w for w in warns))
        got, warns = llm_make.resolve_style('没有配方', 'quiz')
        self.assertEqual(got, 'quiz')
        self.assertEqual(warns, [])

    def test_stable_ids_come_from_manifests(self):
        self.assertEqual(set(llm_make.STABLE_IDS), {'cards', 'quiz', 'journey'})
        for sid, man in llm_make.STABLE_MANIFESTS.items():
            self.assertEqual(man.get('status'), 'stable', sid)


class StyleCheck(unittest.TestCase):
    def test_missing_style_counts_as_cards(self):
        self.assertIsNone(llm_make.style_mismatch_error({'meta': {}}, 'cards'))
        self.assertIsNone(llm_make.style_mismatch_error({'meta': {'style': 'cards'}}, 'cards'))
        err = llm_make.style_mismatch_error({'meta': {}}, 'quiz')
        self.assertEqual(err['where'], 'meta.style')
        self.assertIn('quiz', err['fix'])
        err = llm_make.style_mismatch_error({'meta': {'style': 'journey'}}, 'quiz')
        self.assertIn('journey', err['problem'])


class PromptAssembly(unittest.TestCase):
    def test_quiz_does_not_carry_cards_catalog_or_ledger(self):
        name = os.path.basename(llm_make.pick_example('quiz', None, None))
        blob, _ = prompt_of('quiz', example_name=name)
        self.assertNotIn('======== shots.md ========', blob)
        self.assertNotIn('参考样例（ledger.json', blob)
        self.assertNotIn('至少一镜演示类镜头', blob)
        self.assertNotIn('就可以不写 caption', blob)
        self.assertNotIn('没给截图就不要用 phone', blob)
        self.assertNotIn('这次没有指定配方', blob)
        self.assertIn('styles/quiz/', blob)
        self.assertIn(name, blob)
        self.assertNotIn('voice', name.lower())

    def test_quiz_voice_wording_and_voice_example(self):
        path = llm_make.pick_example('quiz', 'mock', None)
        name = os.path.basename(path)
        self.assertIn('voice', name.lower())
        blob, _ = prompt_of('quiz', voice='mock', example_name=name)
        self.assertIn('不要写 caption', blob)
        self.assertNotIn('就可以不写 caption', blob)
        self.assertIn(name, blob)

    def test_journey_uses_its_own_example(self):
        name = os.path.basename(llm_make.pick_example('journey', None, None))
        blob, _ = prompt_of('journey', example_name=name)
        self.assertNotIn('======== shots.md ========', blob)
        self.assertNotIn('至少一镜演示类镜头', blob)
        self.assertIn('styles/journey/', blob)
        self.assertIn(name, blob)

    def test_cards_keeps_catalog_ledger_and_demo_rule(self):
        name = os.path.basename(llm_make.pick_example('cards', 'mock', None))
        self.assertEqual(name, 'ledger.json')
        blob, _ = prompt_of('cards', voice='mock', example_name=name)
        self.assertIn('======== shots.md ========', blob)
        self.assertIn('参考样例（ledger.json', blob)
        self.assertIn('至少一镜演示类镜头', blob)
        self.assertIn('就可以不写 caption', blob)
        self.assertIn('没给截图就不要用 phone', blob)
        self.assertNotIn('这次没有指定配方', blob)
        self.assertNotIn('选定后用 --style', blob)

    def test_explicit_example_wins(self):
        explicit = os.path.join('examples', 'ledger.json')
        self.assertEqual(llm_make.pick_example('quiz', 'mock', explicit), explicit)

    def test_english_missing_recipes_prints_a_hint(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            pack = llm_make.load_style_pack('quiz', 'en')
        hint = buf.getvalue()
        self.assertIn('recipes.en.md', hint)
        self.assertIn('recipes.md', pack)
        self.assertNotIn('recipes.en.md', pack)


class ReadthroughAndLlm(unittest.TestCase):
    def test_gate_blocks_unless_skipped(self):
        blocked, msg = llm_make.readthrough_gate('按通读问题改完后没能通过校验', False)
        self.assertTrue(blocked)
        self.assertIn('不出片', msg)
        blocked, msg = llm_make.readthrough_gate('通读结果解析失败', True)
        self.assertFalse(blocked)
        self.assertIn('只警告', msg)
        self.assertIn('仍出片', msg)

    def test_call_llm_does_not_raise_system_exit(self):
        src = inspect.getsource(llm_make.call_llm)
        self.assertNotIn('SystemExit', src)
        self.assertTrue(issubclass(llm_make.LlmError, Exception))
        self.assertFalse(issubclass(llm_make.LlmError, SystemExit))

    def test_retryable_errors(self):
        self.assertTrue(llm_make.is_retryable_llm_error(TimeoutError()))
        self.assertTrue(llm_make.is_retryable_llm_error(ConnectionResetError()))
        self.assertTrue(llm_make.is_retryable_llm_error(http.client.IncompleteRead(b'')))
        self.assertTrue(llm_make.is_retryable_llm_error(json.JSONDecodeError('x', 'y', 0)))
        self.assertTrue(llm_make.is_retryable_llm_error(llm_make.BadLlmResponse('no choices')))
        http429 = urllib.error.HTTPError('http://example.invalid/v1', 429, 'busy', None, io.BytesIO(b''))
        http400 = urllib.error.HTTPError('http://example.invalid/v1', 400, 'bad', None, io.BytesIO(b''))
        self.assertTrue(llm_make.is_retryable_llm_error(http429))
        self.assertFalse(llm_make.is_retryable_llm_error(http400))
        self.assertTrue(llm_make.is_retryable_llm_error(urllib.error.URLError('down')))
        self.assertFalse(llm_make.is_retryable_llm_error(ValueError('no')))

    def test_log_records_model(self):
        folder = tempfile.mkdtemp()
        try:
            path = os.path.join(folder, 'llm_log.json')
            llm_make.write_llm_log(path, 'deepseek-flash', [{'round': 1, 'ok': True}])
            data = json.loads(llm_make.read(path))
            self.assertEqual(data['model'], 'deepseek-flash')
            self.assertEqual(data['entries'][0]['round'], 1)
        finally:
            shutil.rmtree(folder)

    def test_main_writes_the_log_in_finally(self):
        src = inspect.getsource(llm_make.main)
        self.assertIn('finally', src)
        self.assertIn('write_llm_log', src)
        self.assertIn('skip_readthrough_gate', src)


class DryRun(unittest.TestCase):
    def test_quiz_dry_run_writes_prompt_without_network(self):
        folder = tempfile.mkdtemp()
        try:
            brief = os.path.join(ROOT, 'industries', 'food', 'test-brief.md')
            proc = subprocess.run(
                [sys.executable, os.path.join(ROOT, 'scripts', 'llm_make.py'), brief, '--dry-run', '--style', 'quiz', '--out', folder],
                capture_output=True, text=True, encoding='utf-8', errors='replace',
            )
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            out = proc.stdout + proc.stderr
            self.assertNotIn('API_KEY', out)
            self.assertNotRegex(out, r'sk-[A-Za-z0-9]')
            self.assertIn('配方：quiz', out)
            prompt_path = os.path.join(folder, 'prompt.txt')
            self.assertTrue(os.path.isfile(prompt_path))
            self.assertFalse(os.path.isfile(os.path.join(folder, 'llm_log.json')))
            prompt = llm_make.read(prompt_path)
            self.assertNotIn('======== shots.md ========', prompt)
            self.assertNotIn('参考样例（ledger.json', prompt)
            self.assertNotIn('至少一镜演示类镜头', prompt)
            self.assertIn('styles/quiz/', prompt)
        finally:
            shutil.rmtree(folder)


if __name__ == '__main__':
    unittest.main()
