# chat mock chat

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "chat", "dur": 5, "caption": "They are busy?\n{Here is what to say}",
 "params": {"messages": [{"from": "peer", "text": "Busy, talk later"}, {"from": "me", "text": "Sure, no rush"}], "panel": {"title": "Reply ideas", "replies": ["Okay, take your time", "Ping me when free"]}}}
```
Only for messaging-type products: meta.action has to mention messages or replies.

A neutral-colored chat window ("me" = theme accent color, "them" = light gray, doesn't resemble any specific IM app). Messages pop in one beat at a time → optionally "me" types in the input box → optionally the product's floating button lights up and a panel pops up (verdict + tags + candidate replies) → the first candidate reply flies into the input box on "fill in".

## When to use

Social, customer service, sales scripts, AI assistants, collaboration tools — any "use the product inside a conversation" scenario. It can also just show messages, to play out a pain point.

## Params

| Field | Required | Notes |
|---|---|---|
| peer | No | Header name (≤6 chars), defaults to "them"/generic. Don't use a real account name |
| messages | Yes | 1–4 items `{from: "me"/"peer", text ≤18 chars}`, put the most important one last |
| typing | No | What "me" types in the input box when there's no panel (≤16 chars), typewriter effect + key sounds. Leave unset when there's a panel (the panel fills the first reply into the box); if you must set it, it has to match `replies[0]` exactly or validation fails |
| panel.title | Required if panel exists | Panel title (≤8 chars), e.g. "AI analysis" |
| panel.icon | No | Floating-button icon, defaults to `sparkle` |
| panel.verdict | No | Panel's big-text verdict (≤12 chars) |
| panel.tone | No | Verdict color: `bad` / `warn` (default) / `good` / `accent` |
| panel.tags | No | Up to 3 small tags, ≤6 chars each |
| panel.replies | No | Up to 3 candidate replies (≤16 chars each), the first one gets "filled in". These are what the product suggests **"me"** sends to the other person — write them from me's point of view. Bad example: I said I have to work overtime, and the suggested reply is "stop working overtime, spend time with me" — that's the other person's voice, not mine, so the demo shows the wrong thing |

## How long to make it

Messages only: 3–4s. Messages + panel: 6s. Messages + typing + panel + 3 replies: 8–10s. Too short just speeds everything up (nothing breaks, it just feels rushed).

## Good example

```json
{"type": "chat", "dur": 9, "caption": "Before you hit send,\n{they just want to know you care}", "mood": 0.95,
 "params": {"peer": "them",
   "messages": [{"from": "me", "text": "I made plans to play ball with friends this weekend"}, {"from": "peer", "text": "You weren't around last weekend either"}, {"from": "peer", "text": "You just don't get it"}],
   "panel": {"title": "AI analysis", "verdict": "They want to know you care", "tone": "bad", "tags": ["Wants reassurance", "Acknowledge first"],
             "replies": ["I haven't been paying enough attention to how you feel", "Sorry, I was short with you earlier", "Tell me what I'm missing"]}}}
```

## How long to make it

The content itself runs about 7s (3 messages + typing + panel + 3 replies). If you give it more, the extra time is split between "reading the verdict after the panel pops up" (~55%) and "before tapping fill-in" (~30%) — only a small pause is left at the end, so it never just sits there idle. For emotional storylines, 9–10s works well.
