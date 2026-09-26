# phone screenshot + callouts

A centered phone frame holding a real screenshot or screen recording. 1–3 spots get circled one beat at a time, each with a short caption. The screenshot only lives inside the phone frame — it never zooms to full screen or shakes around.

Three callout styles:
- `zoom` magnifier (default): that region pops out of the phone into a large card so detail is visible; when the next callout appears it shrinks back, leaving a numbered box in place
- `box` highlight: outlines that region with a numbered border and a label next to it
- `arrow` a large arrow outside the phone points at the region, with a label next to it

The currently-circled region is lit; the rest of the screen dims.

## When to use

- You have a **real screenshot or screen recording** and want to say "look, it does this." More credible than mockApp.
- One shot, 1–3 visible feature points.

## When not to use

- No screenshot: use mockApp instead.
- You just want to show one image with nothing called out: don't. Without callouts there's no new information on screen — this is exactly what got v1 criticized as "just a picture moving back and forth."
- The screenshot shows a URL, QR code, account name, phone number, a real person's name, or a third-party app's logo: blur it or swap the image first.

## Params

| Field | Required | Notes |
|---|---|---|
| src | Yes | Path to the screenshot or recording, relative to the folder holding storyboard.json. Supports png / jpg / jpeg / webp / mp4. A portrait phone screenshot works best (e.g. 1080×2340) |
| focus | Yes | 1–3 callouts, one appears every 2 beats (1s) |
| focus[].area | Yes | Which of the screenshot's 5 equal horizontal bands, top to bottom: `top` / `upper` / `middle` / `lower` / `bottom` |
| focus[].label | Yes | What this callout says, **≤10 chars** (Latin letters count as half), e.g. "Auto-generates a summary" |
| focus[].style | No | `zoom` (default) / `box` / `arrow` |
| videoStart | No | What second the recording starts playing from, defaults to 0. Not used for still screenshots |

## Tips

- Write the label as "what the user gets," not the button's name: "share with a teammate in one tap," not "the share button."
- Use `zoom` on the single most important callout. At most 2 `zoom`s per shot; use `box` or `arrow` for a third.
- Circle top to bottom (top → bottom) — it reads more naturally.
- Duration: 1 callout 2.5–3s, 2 callouts 4s, 3 callouts 5s. Too short speeds everything up.

## Examples

```json
{"type": "phone", "dur": 4, "caption": "Open it up,\n{the highlights are already circled}", "mood": 0.3,
 "params": {"src": "shots/home.png",
   "focus": [
     {"area": "upper", "label": "Today's summary, already written"},
     {"area": "lower", "label": "To-dos sync in one tap", "style": "box"}
   ]}}
```

Screen recording:

```json
{"type": "phone", "dur": 5, "caption": "Order in\n{two taps}", "mood": 0.2,
 "params": {"src": "shots/order.mp4", "videoStart": 2,
   "focus": [{"area": "middle", "label": "Pick the options"}, {"area": "bottom", "label": "One-tap checkout", "style": "arrow"}]}}
```
