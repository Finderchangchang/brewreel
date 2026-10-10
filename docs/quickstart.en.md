# Install and get started

[← Back to README](../README.en.md) · [中文](quickstart.md)

## Platform support

| Way to use it | Status | Notes |
|---|---|---|
| AI coding assistants that read `SKILL.md`: Claude Code, Codex, opencode and others | ✅ Ready | Install the repo as a skill; the assistant follows `SKILL.md` to write the storyboard, validate and render |
| DeepSeek Harness plugin `dsh-brewreel` | ⚠️ Published on npm | 7 tools validate, render and verify; not yet tested against a real DeepSeek model |
| Agent-free script `scripts/llm_make.py` | ✅ Ready | Calls an OpenAI-compatible endpoint (DeepSeek by default): brief in, video out, validator errors fed back automatically |

| Environment | Requirement |
|---|---|
| OS | Windows (x64 only) / macOS ≥ 15 / Linux (glibc ≥ 2.35, plus shared libs like `libnss3` / `libgbm` / `libasound2`; Alpine and NixOS are not supported) |
| Node.js | ≥ 18 (20 LTS or newer recommended; this repo is tested on Node 22); the DeepSeek Harness plugin needs 22.x from 22.19, or 24+ |
| Python | 3.10+; the music script needs `numpy` / `scipy`, `llm_make.py` uses only the standard library |
| First download | A few hundred MB of render dependencies, plus about 110 MB for Chrome Headless Shell; for talking-head B-roll, the first transcription also downloads the SenseVoice speech model, about 240 MB (once) |

Output is 1080×1920 (journey defaults to 1080×1350), 30 fps, with music and sound effects.

## Quick start

**1. Install dependencies.**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

`npm install` installs the rendering engine (the lockfile includes Remotion compositor packages for 7 platforms, so switching platforms just works); `npx remotion browser ensure` downloads Chrome Headless Shell once, for headless rendering.

**2. Run a sample to check the setup.**

```bash
node scripts/validate.mjs examples/en-focus.json
node scripts/make.mjs examples/en-focus.json --out ../brewreel-out/en-focus
```

If the first command passes, your setup is good. The second renders the video in a few minutes; the last terminal line is `交付：<mp4 path>` ("delivered"). The output folder holds `video.mp4`, the contact sheet `sheet.png`, check frames in `check/`, `report.txt` and the delivery manifest `manifest.json`. `--out` must not point inside the repo.

**3. Let the AI write the storyboard.** Pick one:

- **As a skill**: clone the whole repo into `~/.claude/skills/brewreel/` (Claude Code) or `~/.agents/skills/brewreel/` (a common convention), or point your tool's own skill-install command at this repository. Then hand the assistant a brief (template: [`brief-template.md`](../brief-template.md); English templates per industry are in `industries/<id>/brief-template.en.md`) and let it follow `SKILL.md`.
- **Headless script**: no agent needed; see ["Running it with a cheap model"](#running-it-with-a-cheap-model) below.
- **DeepSeek Harness**: with the plugin installed the model validates and renders through tools; see ["Use it in DeepSeek Harness"](#use-it-in-deepseek-harness).

### Running it with a cheap model

`scripts/llm_make.py` calls an OpenAI-compatible endpoint directly: brief in, video out, with validator errors fed back to the model verbatim on retry (up to 3 times).

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic   # only needed if wiring DeepSeek into Claude Code
export ANTHROPIC_AUTH_TOKEN=<your DeepSeek API key>
export ANTHROPIC_MODEL=deepseek-flash[1m]

# or call the headless script directly, without going through Claude Code:
export LLM_API_KEY=<your DeepSeek API key>
export LLM_BASE_URL=https://api.deepseek.com
export LLM_MODEL=deepseek-flash
python scripts/llm_make.py path/to/brief.md
```

On Windows PowerShell use `$env:LLM_API_KEY="..."` instead of `export`. All of the values above are placeholders; swap in your own key, and never commit a key or paste one into an issue. You may also put these variables into your AI assistant's own global config (e.g. `~/.claude/settings.json`); that's optional, and this repo never changes any global config for you. With `--dry-run` it calls no API and reads no key; it only writes out the assembled prompt and estimates its token count. Pass `--skip-readthrough-gate` to only warn about read-through problems and still render; by default those problems block rendering.

### Revise

When a promo storyboard, a lesson, or a talk's `broll.json` already exists and you only want to change one thing:

```bash
node scripts/revise.mjs path/to/storyboard.json "slow the third shot down, and open with a question"
```

For a lesson, pass `lesson.json`. For a talk, pass the project's `broll.json`. The cheap model returns a patch list only, and the file is written back only after validation passes. The original is copied to `<name>.bak.json` first; the next edit uses `.bak.1.json`. `--dry-run` prints the patch and does not write. A promo prints stills of the changed shots only. A lesson or a talk only prints the original render command (a lesson already rerenders just the changed pages, and motion B-roll is free). If a talk edit would regenerate AI pictures, the script says that costs money and does not render unless you pass `--render`. `--render` renders the whole film.

### Talking-head B-roll (experimental)

Use this when you already have a talking-head video and want explanatory pictures on the lines about steps or numbers. Put only the talk, `talk.mp4`, in a project folder, then run one command:

```bash
node scripts/talk.mjs path/to/project --out ../brewreel-out/talk
```

It transcribes the talk on your machine, asks DeepSeek to pick the lines and write `broll.json` (set `DEEPSEEK_API_KEY`), and renders: free motion clips are drawn for real, and AI clips start as solid-color stand-ins at no cost. The first transcription downloads a speech model of about 240 MB. If you are upgrading from v0.8, run `npm install` in `template` again first. Talking-head B-roll needs a full ffmpeg; the `imageio-ffmpeg` in the install step above is for it (the slim build bundled with Remotion is not enough). AI clips come in three regular styles (wood blocks, clay stop-motion, layered paper) whose reference images ship with the repo; ink sketch is experimental, has no reference images yet and only works as a stand-in preview. Real AI clips, price and review: [Talking-head B-roll](broll.en.md).

### Style factory

One sentence drafts an AI-picture style for a talk. Leave off `--yes` to print the requests that would be sent, and call nothing:

```bash
node scripts/broll/new-style.mjs --id demo-watercolor --name 水彩绘本 --desc "水彩晕染、纸纹、柔和暖色"
```

A person approves the style. Cost and the vision rules: [Style factory](style-factory.en.md).

### Use it in DeepSeek Harness

This repository ships a DeepSeek Harness (dsh) plugin in [`integrations/deepseek-harness/`](../integrations/deepseek-harness/README.en.md), package name `dsh-brewreel` (formerly `dsh-distill-video`; to upgrade from it, see "Upgrading from dsh-distill-video" in the plugin README). With it installed, the model writes the storyboard by following the skill, and validates, renders and verifies through the plugin's tools instead of assembling `node scripts/…` commands. Rendering runs in the background with progress, and the plugin restricts output paths and the environment variables child processes receive.

It needs **dsh 0.1.7-rc.2 or later** within 0.1.x. dsh's `latest` tag on npm still points to the older 0.1.5-rc.3, so pin the version when installing. You also need Node.js 22.x from 22.19, or 24 and later, plus pnpm (`dsh plugin` installs plugins through pnpm). Install from npm:

```bash
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm    # if dsh is not installed yet
dsh plugin --profile web add dsh-brewreel
dsh web
```

`web` can be any profile name; if the profile is already running, restart it for the change to apply. On first use, ask the model to "check the video plugin environment": it calls doctor, and after you agree, calls setup to install the render dependencies (a few hundred MB, plus about 110 MB for Chrome Headless Shell). To use unreleased code from the repository, clone it and run `dsh plugin --profile web add ./brewreel/integrations/deepseek-harness` from the folder that contains the clone. The plugin has not yet been tested against a real DeepSeek model; please open an issue if you hit problems.

<details>
<summary><b>The 7 tools, license note and security notes</b></summary>

- `brewreel_doctor` checks the environment, `brewreel_setup` installs dependencies and the browser, `brewreel_catalog` lists styles, industries and color themes, `brewreel_guide` reads the skill and the style, industry and shot docs, `brewreel_validate` validates a storyboard and says how to fix each problem, `brewreel_render` renders in the background, and `brewreel_verify` checks that a video still matches the current storyboard.
- License note: the plugin and the skill are Apache-2.0, but the rendering engine Remotion is not open source: **for-profit organizations with 4 or more people must purchase Remotion's Company License** (see ["Copyright and license"](../README.en.md#copyright-and-license) and `THIRD_PARTY_LICENSES.md`). The plugin does not change that.
- Render child processes do not go through dsh's shell sandbox; they run with the current user's permissions.
- Configuration, security notes and troubleshooting are in the plugin's [README](../integrations/deepseek-harness/README.en.md).

</details>
