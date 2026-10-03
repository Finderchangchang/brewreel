# FAQ

[← Back to README](../README.en.md) · [中文](faq.md)


<details>
<summary><b>Where does the background music come from?</b></summary>

`scripts/make_bgm.py` synthesizes it on the spot with numpy / scipy: instruments, harmony, melody, mixing and mastering are all in the script, with no external sample library. `make.mjs` passes it the start time of every shot; each shot is one section, and its writing is picked by position and mood (hook, tension, lift, groove, peak, ending). Notes land on whole or half beats, and every shot change gets a cymbal or a fill, so the music follows the cuts. Loudness is normalized to -16 LUFS with ffmpeg's ebur128 (approximated by RMS if ffmpeg can't be found).

Because it is synthesized on the spot, there are no copyright issues. When you publish on a platform such as Douyin, you can also swap in music from the platform's own library: render a silent version with `--no-bgm`, then add music on the platform.

</details>

<details>
<summary><b>Is there a voice-over?</b></summary>

Yes. v0.5.0 added MiniMax text-to-speech, and from v0.5.1 you can also use Alibaba Cloud (Model Studio CosyVoice) or Volcengine (Doubao speech). Write `meta.voice` and a `vo` per shot, set the matching environment variable (`MINIMAX_API_KEY` / `DASHSCOPE_API_KEY` / `VOLCENGINE_TTS_API_KEY`), and render. Shot lengths follow the narration, subtitles light up word by word, and the music ducks under speech. Without a key, add `--voice-provider mock` to preview the rhythm with a placeholder voice. Without `meta.voice` there is no voice-over, as before. When you publish with an AI voice, tick the platform's AI-generated content declaration as it requires.

</details>

<details>
<summary><b>Why illustrations instead of real footage?</b></summary>

The project does not generate images that look like "real photography". Without merchant material, the video falls back to components and simple line-drawn illustrations and labels them clearly, rather than passing them off as real photos. With the merchant's real photos (store, finished product, price list), use the real-photo shots; the result is far more convincing. Whether a photo is authorized goes on the human-review list.

</details>

<details>
<summary><b>Can I publish the video as rendered?</b></summary>

Not yet recommended. Treat the video as a first draft: watch the whole thing, fix awkward copy and repeated selling points, then publish. For industry videos, check every price, condition, date, opening hour and distance on screen against the brief, one by one. See ["Known limitations"](limitations.en.md) for test results.

</details>

<details>
<summary><b>Does it cost anything?</b></summary>

The project is free and open source. Model calls use your own API key and are billed by the provider for what you use; the project handles no money. Rendering runs on your own computer. The rendering engine Remotion charges for-profit organizations with 4 or more people; see the next question.

</details>

<details>
<summary><b>Does Remotion need a license? What about upgrading to 5.0?</b></summary>

Remotion is source-available, not open source: free for individuals, for-profit companies with 3 or fewer people, and non-profits (including commercial use); **for-profit organizations with 4 or more people must purchase Remotion's Company License**, see <https://www.remotion.dev/license>. This repo's Apache-2.0 license does not change Remotion's own license terms; details in `THIRD_PARTY_LICENSES.md`.

This repo pins `remotion` / `@remotion/cli` to `4.0.529`. After upgrading to 5.0, Remotion's free tier requires passing a `licenseKey` in config (individuals / companies with ≤3 people / non-profits use `"free-license"`); see the [Remotion license page](https://www.remotion.dev/license). Read `THIRD_PARTY_LICENSES.md` before upgrading.

</details>

<details>
<summary><b>Anything to watch for on Windows?</b></summary>

- x64 only.
- Set environment variables the PowerShell way, `$env:LLM_API_KEY="..."`, not `export`.
- `--props` fails with "neither valid JSON": the Windows shell mangles quotes inside JSON strings, so storyboards are always passed as a file path (`--props=./storyboard.json`), never as an inline JSON string. `make.mjs` / `llm_make.py` already do it the file-path way.
- `make.mjs` calls `python` on Windows and `python3` on macOS / Linux; if yours lives elsewhere, point the `PYTHON` environment variable at it.

</details>

<details>
<summary><b>Do I need a system ffmpeg?</b></summary>

No. The contact sheet `sheet.png` is rendered by Remotion's `Sheet` composition (one frame per second of the video, tiled as thumbnails, each labelled with its time and shot number). The check frames `check/*.png` are extracted from the video with Remotion's bundled ffmpeg, and any frame that can't be extracted is rendered as a Remotion still instead. If you set `FFMPEG=/path/to/ffmpeg`, the sheet is tiled with its `tile` filter first and falls back to the `Sheet` composition if that fails. A missing sheet never affects `video.mp4`; the terminal prints the reason.

</details>

<details>
<summary><b>A platform's compositor package is missing from the lockfile after <code>npm install</code>?</b></summary>

`package-lock.json` should contain 7 `@remotion/compositor-*` platform packages (win32-x64-msvc / darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-x64-musl / linux-arm64-gnu / linux-arm64-musl). If the one for your platform is missing, delete `template/node_modules` and `template/package-lock.json` and re-run `npm install` on the target platform (a known npm optional-dependency quirk: a lockfile generated on one platform doesn't always include every platform).

</details>

<details>
<summary><b>Chrome Headless Shell fails to download?</b></summary>

`npx remotion browser ensure` may not be able to reach Google's download endpoint from some networks. Download it manually and point to a local Chrome / Chromium install with `--browser-executable` (rendering results may differ slightly between Chrome versions).

</details>

<details>
<summary><b>Why the name "BrewReel" (精酿, "craft brew")?</b></summary>

Good beer comes from a good recipe, even with ordinary ingredients. A strong model first gets a video style right; its layout, motion, pacing and rules are then written down as a "recipe": ready-made components plus a validator. A low-cost model like DeepSeek is the ordinary ingredient: it follows the recipe, fills in a storyboard, and brews a video at the same level. The docs use the same words throughout: style pack = recipe, deriving a style from a reference video = crafting a recipe, rendering = brewing. Paths and fields such as `styles/`, `meta.style` and `distill/` keep their original names.

</details>
