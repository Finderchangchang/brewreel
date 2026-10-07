# 精酿 · BrewReel — DeepSeek Harness plugin

[中文](README.md) | English

Let a DeepSeek model write one storyboard JSON, then get a vertical promo video (1080x1920, 15–45 s) from a single tool call.

Author: 柳伟杰 / Liu Weijie (Finderchangchang) · License: Apache-2.0 · Main repository: <https://github.com/Finderchangchang/brewreel>

Package name `dsh-brewreel`. From 0.2.0 the plugin follows the project's new name (formerly `dsh-distill-video`; the project was formerly promo-video-skill / Distill Video). Upgrading from the old package: see ["Upgrading from dsh-distill-video"](#upgrading-from-dsh-distill-video).

## What it does and does not do

- **Does**: the model only writes `storyboard.json` (pick shots, fill in text); ready-made Remotion shot components draw the frames; the validator blocks rule violations and Chinese advertising-law / industry compliance problems; one call runs validation → machine checks → music → render → layout checks → delivery manifest. The same skill also covers two more jobs: pictures on a talking-head video (when there is a `talk.mp4`, write only `broll.json` and run `scripts/talk.mjs`), and the style factory (describe a look in one sentence, read `docs/style-factory.md`, run `scripts/broll/new-style.mjs`).
- **Does not**: generate arbitrary video, or decide compliance grey areas for the user (human-review items are handed to the user as they are).
- The plugin is "7 tools + one skill": the skill teaches the model how to write a storyboard; the tools validate, render and verify, and keep output paths, child processes and environment variables in check.

## Examples

See the screenshots and sample videos in the main repository README. This README has no images; the skill snapshot inside the package carries the main repository's `docs/images/` previews (about 3.5 MB), which the image links in the style docs point to.

## Requirements

| Item | Requirement |
|---|---|
| Node.js | 22.x from 22.19, or 24 and later (the same as dsh itself) |
| DeepSeek Harness | `@deepseek-ai/dsh` 0.1.x from 0.1.7-rc.2 on (tested with 0.1.7-rc.2) |
| pnpm | `dsh plugin` installs plugins through pnpm, so pnpm must be on PATH |
| Python (optional) | 3.10+ with numpy and scipy; without them the music is silent, the video still renders |
| Disk | about 1 GB (render dependencies + Chrome Headless Shell) |
| Network | first-time setup downloads from npm and Google |

## Install

If dsh is not installed yet, install it together with pnpm (`dsh plugin` forwards its arguments to pnpm):

```sh
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm
```

Keep the version: dsh's `latest` and `next` tags on npm both point to 0.2.0-rc.2 now. This plugin has not been tested on 0.2 yet and only declares support for 0.1.x (0.1.7-rc.2 and later), so install 0.1.7-rc.2 as shown above. If dsh is already installed, check it with `dsh --version`.

The commands use the `web` profile; any profile name works. The first `dsh plugin --profile web …` creates the profile. Start it with `dsh web` afterwards; if the profile is already running, **restart** it (dsh applies bundle changes on the next boot).

**A. Link a local clone (most reliable)**

```sh
git clone https://github.com/Finderchangchang/brewreel.git
dsh plugin --profile web add ./brewreel/integrations/deepseek-harness
```

Run the second command from the folder that contains the clone (relative paths resolve against the current directory). The plugin uses the skill in that clone (`checkout` mode): render dependencies go into the clone's `template/node_modules/`, and while rendering `make.mjs` writes temporary assets and a render lock inside the clone's `template/` (both ignored by the repository's `.gitignore`). Set `stageCheckout: true` to leave the clone untouched and run from a copy in the runtime folder instead.

**B. npm (available now)**

```sh
dsh plugin --profile web add dsh-brewreel
```

`dsh-brewreel@0.5.0` on npm is the v0.7.0 snapshot.

**C. A local tgz**

If you already downloaded the release package:

```sh
dsh plugin --profile web add ./dsh-brewreel-0.3.0.tgz
```

**D. Skill only, no plugin**

Clone the repository into `~/.agents/skills/brewreel/` (or a project's `.agents/skills/`). dsh discovers the skill on its own and the model runs `node scripts/…` through its shell tool — no progress, no path guard, no structured errors. Fine for a quick try.

Uninstall: `dsh plugin --profile web remove dsh-brewreel`, then delete the runtime folder (default `~/.dsh/brewreel/`, or `~/.dsh/distill-video/` when upgraded from 0.1.x; with option A and `stageCheckout` off, the dependencies live in the clone's `template/node_modules/`).

## First-time setup

Ask the model to "check the video plugin environment"; it calls `brewreel_doctor`. If something is missing, the model asks you first and then calls `brewreel_setup`:

1. `stage`: copy the skill into the runtime folder (needed for npm / tgz installs; no download);
2. `deps`: `npm ci` in `template/` (Remotion and friends, a few hundred MB);
3. `browser`: download Chrome Headless Shell (about 110 MB).

Slow or blocked networks: set `npmRegistry` to a mirror. If the Chrome Headless Shell download fails, follow the manual steps in the main repository FAQ, place it under `template/node_modules/.remotion/chrome-headless-shell/` inside the `runtimeRoot` that doctor reports, and run setup again (present files are skipped).

Python packages are **detected, never installed**; for music, run the `python -m pip install numpy scipy` command that doctor prints.

## How to use it

Example conversation:

> **You**: Make a ~20-second promo for my expense-tracking app. Selling points: snap a receipt to log it, a warning before you overspend at month end. The brief is at promo/ledger/brief.md.
>
> **Model**: (calls `brewreel_catalog`) One clear benefit and a UI demo → the default cards style, software industry. (calls `brewreel_guide` for the cards recipes and the hook shot, writes `promo/ledger/storyboard.json`)
>
> **Model**: (calls `brewreel_validate`) Shot 3's caption is too long; shortened to two lines as suggested… validated again, passed.
>
> **Model**: (calls `brewreel_render`, background job `brewreel-1`; `job_output` shows "rendering 420/735 frames")
>
> **Model**: Done. Video: `…/promo/ledger/video.mp4` (24.5 s), contact sheet `sheet.png`. Please confirm these 2 human-review items before publishing: …

Output folder contents:

| File | Meaning |
|---|---|
| `video.mp4` | The video. **Only the path in the tool result's `video.path` counts as delivered** |
| `sheet.png` | Contact sheet of the whole video |
| `check/` | Check frames |
| `report.txt` | Full validation, machine-check and layout-check report |
| `manifest.json` | Storyboard sha256, video sha256 / duration, every check's verdict |

"Trust only the delivery line": `video` appears only when exit code 0, a final `make.mjs` line starting with the delivery marker, manifest status `delivered` and a matching file sha256 all hold. A leftover `video.rejected.mp4` only shows what broke and must never be delivered. `stills` (single-frame previews) are never a video.

## Tools

| Tool | Purpose | Writes files | Background |
|---|---|---|---|
| `brewreel_doctor` | Environment check (Node, skill files, dependencies, Chrome, Python, output folder, render lock) | no | no |
| `brewreel_setup` | One-time setup: stage / deps / browser | runtime folder | default yes |
| `brewreel_catalog` | List styles, industries, color themes | no | no |
| `brewreel_guide` | Read the skill, style recipes, industry recipes, shot notes, examples | no | no |
| `brewreel_validate` | Validate a storyboard: errors / warnings / human items, each with a fix | no | no |
| `brewreel_render` | Render (about 3–10 min, depending on the machine) with progress; `stills` renders single frames only | output folder | default yes |
| `brewreel_verify` | Check that the video still matches the current storyboard | no | no |

If the same validation error survives 3 rounds in a row, `validate` flags it in `stuck` and tells the model to stop and ask you — no endless loops with cheap models.

## Configuration

Edit it in the Web UI plugin settings (the form comes from the config schema) or in your profile's `cordis.patch.yml`:

```yaml
- id: brewreel
  config:
    outputRoot: promo
    npmRegistry: https://registry.npmmirror.com
    renderTimeoutMin: 40
```

Note: a patch **replaces the row's whole `config`**; restate every key you want to keep.

| Key | Default | Meaning |
|---|---|---|
| `skillRoot` | `''` | A BrewReel clone to use; empty = auto-detect (the clone two levels up → the bundled snapshot) |
| `stageCheckout` | `false` | Copy a clone into the runtime folder before running instead of rendering inside it |
| `runtimeDir` | `''` | Empty = `$DSH_HOME/brewreel` (`~/.dsh/brewreel`); when only the `~/.dsh/distill-video` left by 0.1.x exists, that one is reused |
| `outputRoot` | `promo` | Output root, relative to the session workspace |
| `extraWriteRoots` | `[]` | Extra absolute folders the tools may read from and write to |
| `renderInBackground` | `true` | Render as a background job by default |
| `maxConcurrentRenders` | `1` | Render processes this plugin runs at once (1–4) |
| `renderTimeoutMin` | `30` | Hard timeout per render (minutes); the whole process tree is terminated |
| `queueTimeoutMin` | `20` | Maximum wait for the render lock (minutes) |
| `bgm` | `true` | Generate music by default |
| `autoSetup` | `false` | Let a render run setup (downloads) when dependencies are missing. Off so you stay informed |
| `npmRegistry` | `''` | npm registry used by setup; must be https |
| `python` / `ffmpeg` | `''` | Python / ffmpeg executables |
| `registerSkill` | `true` | Register the skill instructions |
| `skillLang` | `zh` | Register the Chinese or English SKILL; also the language of tool results |
| `maxResultChars` | `16000` | Upper bound on text one tool result gives the model |
| `envPassthrough` | `[]` | Extra environment variable names for child processes; credential-looking names (KEY/TOKEN/SECRET/PASSWORD/AUTH/COOKIE) are rejected |

To confirm every render yourself, set `brewreel_render` to "ask" with dsh's tool approval policy (`tools/pre-execute`).

## Security

- **Writes**: only the output folder in the session workspace (default `promo/<name>/`), `extraWriteRoots`, and the plugin's runtime folder. The output folder cannot be the workspace root, `outputRoot` itself, your home folder or a drive root; `make.mjs` clears fixed product file names when it starts (`video.mp4`, `report.txt`, `layout.json`, `manifest.json`, `check/*.png` and so on), so a folder holding someone else's `storyboard.json`, or any of those names without a `manifest.json` from `make.mjs` or the plugin's marker file `.brewreel-out.json` (or `.distill-video-out.json` written by 0.1.x), is refused. Paths are compared after resolving real paths, so symlinks and junctions cannot escape.
- **Reads**: storyboards and briefs must be in the workspace; assets referenced by a storyboard cannot leave its folder or the workspace.
- **No arbitrary commands**: the plugin only starts the current Node on fixed scripts inside the skill (validate.mjs, make.mjs, the Remotion CLI, npm), Python for a fixed detection command, and on Windows `taskkill` for its own process trees. make.mjs itself additionally runs Python to generate the music and, when configured, ffmpeg. Always `shell: false` with fixed argument arrays; model input reaches argv only as a verified absolute path or a verified number.
- **Environment whitelist**: child processes get basic variables such as PATH, TEMP, HOME, LANG; the DeepSeek key and other credentials never reach the render process. The one exception is voice-over: the render process (`make.mjs`) also gets a fixed set of variables — MiniMax (`MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, `MINIMAX_BASE_URL`), Alibaba Cloud (`DASHSCOPE_API_KEY`, `DASHSCOPE_WORKSPACE_ID`, `DASHSCOPE_REGION`, `DASHSCOPE_TTS_URL`), Volcengine (`VOLCENGINE_TTS_API_KEY`, `VOLCENGINE_TTS_APP_ID`, `VOLCENGINE_TTS_ACCESS_TOKEN`, `VOLCENGINE_TTS_BASE_URL`) and `BREWREEL_TTS_CACHE` (the voice cache folder); validate, doctor and setup processes never see them, no other key is passed, and `envPassthrough` cannot add one. `make.mjs` only sends the key to the matching voice service in the request header; it never writes it to a file, log or `manifest.json`, and error messages leave it out. Storyboards without `meta.voice` never use it.
- **Plainly**: render processes **do not run inside dsh's shell sandbox**; they run with your user's permissions and the plugin restrains itself with the rules above. Setup downloads Remotion and Chrome Headless Shell from npm and Google.

## Troubleshooting

| Symptom | What to do |
|---|---|
| "Render dependencies are not installed" | Call `brewreel_doctor`, then `brewreel_setup` once you agree |
| Exit 1 (`invalid`) | Validation failed; fix `validation.errors` one by one |
| Exit 3 (`rejected`) | A layout / blank-frame check failed: remove items or shorten text, validate, render again |
| Exit 4 (`render-failed`) | Usually a missing Chrome Headless Shell or low memory; run doctor |
| Exit 5 (`queue-timeout`) | Another render holds the lock; wait or raise `queueTimeoutMin` |
| Exit 6 (`internal`) | Attach `report.txt` to an issue on the repository |
| `killed` | Past `renderTimeoutMin` or cancelled; the process tree is gone and the next render reclaims the lock |
| Silent music | Python lacks numpy / scipy; run the command doctor prints |
| Chrome download fails | Set `npmRegistry`; place Chrome manually as the main FAQ describes |
| Windows paths with Chinese characters | Supported, spaces too; save storyboards and briefs as UTF-8 |

## Relation to the main repository, versions

- The repository root is the only source. The `skill/` folder inside npm / tgz packages is a snapshot generated at pack time by `scripts/sync-skill.mjs`; `skill/.distill-source.json` records the skill version, repository commit and file hash, and `brewreel_doctor` shows them.
- The plugin has its own version. 0.1.0 (package `dsh-distill-video`) shipped with v0.3.0; from 0.2.0 the package is `dsh-brewreel`, shipped with v0.4.0; 0.3.0 ships with v0.5.x (the 0.3.0 on npm is a v0.5.1 snapshot) and passes the voice-over variables to the render process: keys and hosts for MiniMax, Alibaba Cloud and Volcengine, plus the voice cache folder (see "Security"). The exact skill version and commit inside a package's snapshot are whatever `skill/.distill-source.json` records (doctor shows them too).
- Upgrading: reinstall and restart the profile; the new snapshot is staged in a new runtime subfolder, downloaded dependencies are reused when the dependencies in `package-lock.json` are unchanged (a new name or version of the template package does not count), and only the two latest copies are kept.

## Upgrading from dsh-distill-video

From 0.2.0 the plugin follows the project's new name, 精酿 · BrewReel; the package, tool and skill names changed:

| Item | 0.1.x (old) | 0.2.0 on |
|---|---|---|
| npm package | `dsh-distill-video` | `dsh-brewreel` |
| 7 tools | `distill_video_doctor` etc. | `brewreel_doctor` etc.; suffixes unchanged (doctor / setup / catalog / guide / validate / render / verify) |
| Registered skill name | `promo-video-skill` | `brewreel` (the `name` in SKILL.md) |
| Plugin row in `cordis.patch.yml` | `id: distill-video` | `id: brewreel` |
| Default runtime folder | `~/.dsh/distill-video/` | `~/.dsh/brewreel/` |
| Output folder marker | `.distill-video-out.json` | `.brewreel-out.json` |
| Env var to pack with uncommitted changes | `DISTILL_SYNC_ALLOW_DIRTY` | `BREWREEL_SYNC_ALLOW_DIRTY` |

Steps: `dsh plugin --profile web remove dsh-distill-video`, install `dsh-brewreel` as in "Install" above, restart the profile.

- **What you change**: the old tool names are no longer registered. Replace `distill_video_*` with `brewreel_*` in tool approval policies (`tools/pre-execute`), your own prompts and scripts; if your profile's `cordis.patch.yml` overrides the plugin row, change its `id` to `brewreel` (a row with the old id no longer matches this plugin).
- **What keeps working**: output folders marked `.distill-video-out.json` are still recognised, so you can keep rendering into them; when only the old runtime folder `~/.dsh/distill-video/` exists it is reused, so dependencies and Chrome Headless Shell are not downloaded again; `DISTILL_SYNC_ALLOW_DIRTY` still works.
- The GitHub repository moved to <https://github.com/Finderchangchang/brewreel>; the old address redirects. Point an existing clone at it with `git remote set-url origin https://github.com/Finderchangchang/brewreel.git` (pulling works without it too).

## Developers

```sh
cd integrations/deepseek-harness
npm test                  # unit tests, no dependencies, no dsh needed
npm run smoke -- --runtime-dir <dir> --work <dir> --setup [--full]   # smoke test calling the tool functions directly
npm run sync              # build the skill/ snapshot (prepack runs it and refuses uncommitted changes; BREWREEL_SYNC_ALLOW_DIRTY=1 overrides)
dsh plugin --profile dev add .   # link for local debugging
```

Publishing (done by the author): check the npm name is free → `npm pack --dry-run` to review the file list → `npm publish` → add the `dsh-plugin` topic to the GitHub repository.

## License and third parties

- Plugin and skill: Apache-2.0, see `LICENSE` and `NOTICE`.
- Remotion has its own license; companies may need a commercial license — see `THIRD_PARTY_LICENSES.md` in the main repository.
- Font and other third-party licenses are listed in `THIRD_PARTY_LICENSES.md` as well.

## Disclaimer

The validation rules summarize public regulations and platform rules for self-checking only; they are not legal advice. You confirm the pre-publish checklist yourself.
