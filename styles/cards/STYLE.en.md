# cards style

The default style: a storyboard without `meta.style` uses it. Its code stays where it always was (shots in `template/src/shots/`, themes in `template/src/core/themes.json`, background and caption layers in `template/src/core/layers.tsx`). This page registers it in the nine-layer template so remixers and new-style authors have a reference.

1. **Basics**: 9:16 (1080×1920), 30 fps, 120 BPM by default (one beat = 0.5 s). 15–45 s total (20–30 s is best). Safe area: y 0–205 background only, y 260–540 caption band, y 560–1340 shot area, key content x 180–900.
2. **Structure**: hook (2–3 s, cover title on frame 0) → 3–7 middle shots (at least one demonstrates the core action, at least one of compare/steps/phone/meter) → endCard (4 s). Per-industry structures: `industries/<industry>/recipe.en.md`.
3. **Visual system**: two-color gradient background driven by `mood`, centered light or dark cards (6 themes via `meta.theme`), `meta.brandColor` replaces the accent only. Captions are white with a thick outline and hard shadow; `{}` marks the highlighted words.
4. **Camera**: fixed. Each shot has one moving hero element (needle, number, bubble, tap).
5. **Motion**: spring entrances, key actions on the beat, one new piece of information per beat, at least 0.5 s of stillness at the end. See `template/SHOT_API.md` §6.
6. **Components**: 18 shared shots, fields and length limits in `shots.en.md`.
7. **Sound**: original music generated per film by `scripts/make_bgm.py`; sound effects from each shot spec. Optional voice-over (`meta.voice` + a `vo` per shot, see "Voice-over" in `SKILL.en.md`): narration is synthesized first and shots with `vo` are retimed to it (0.15 s + narration + 0.35 s, whole beats); the caption band lights up word by word with the voice (spoken words solid, the current word in the accent color with a small lift, upcoming words dimmed), at most two lines per page, paged by time; a shot that keeps its `caption` shows the caption and the voice just reads; endCard is voiced without subtitles; the music ducks 10 dB under speech (120 ms down, 300 ms back) and is unchanged elsewhere.
8. **Variable vs fixed**: the model picks shots and writes captions, params, mood and theme; safe area, font floors, transitions and music generation are fixed.
9. **Rules**: see "Hard rules" in `SKILL.en.md` and `industries/<industry>/rules.json`.

**Good fit**: single-benefit products, how-it-works flows, UI demos, physical stores (with industry shots). **Poor fit**: "guess first, then reveal" content (use quiz) or platforms with many categories to show at once (use journey).
