# journey style · draft spec

> Status: **skeleton** (`status: skeleton`). Anonymized summary of a breakdown of a character-journey short video (4:5, about 30 s). No reference footage, stills, characters, brands or URLs are in this repo; only our own notes. The style owner completes this page. The Chinese `STYLE.md` has the full tables.

A mascot rides a vehicle left to right through a flat-illustrated city in one continuous take. Each district is a content category, roadside billboards carry a representative title, the sky goes from day to night, and the film lands on the product screen with a stat card.

1. **Basics**: 4:5 (1080×1350) by default, 9:16 supported; 30 fps; 120 BPM. No cuts except a final zoom-out. Each district is exactly 8 beats (4 s). No voice-over: speech bubbles and sound words only.
2. **Structure**: 2 s hook → 4–6 districts → about 1.3 s number wrap-up → about 2.7 s zoom into the product screen. Inside a district: beat 0 sign passes and the category pill switches; beats 1–3 billboard overhead; beats 3–6 the district's gag with a slowdown; beats 6–7 back to cruise. Gag types rotate (obstacle, help, show, buddy, glitch).
3. **Visual system**: flat fills, one dark outline color (4px characters and props, 3px foreground, none mid-ground), one main color per district, night palette with warm windows and two neon colors. Type sizes scaled about 1.4× from the reference to meet our floors (billboard 56, sign 56, bubble 40, source 28). We draw our own 2–3 mascots and 3 vehicles; we do not use the reference's mascot-plus-paper-plane pairing.
4. **Camera**: mascot fixed at about 35% from the left, floating ±16px every 2 s; three parallax layers (far 0, mid 0.72×, near 1.0× at about 553 px/s); gags slow to 0.52–0.7× cruise; the only scale change is a 0.3 s zoom to 0.72 into our own product-screen frame.
5. **Motion**: hook pop 0.17 s from 0.45×; bubble in 0.1 s, hold 0.65–0.9 s; sound word in 0.07 s, hold 0.3–0.45 s; category pill swap 0.13 s; sky lerp about 2.2 s; counter 1.0 s ease-out. No typewriter.
6. **Components (planned, 12)**: mascotRider, hookTitle, billboard, districtSign, categoryHud, speechBubble, burst, districtProps, groundCards, skyCycle, counterCard, browserOutro. Recommended implementation: one style `Film` that treats each district shot as data and back-solves world coordinates from gag times. The current `district` shot is a plumbing placeholder.
7. **Sound**: two drops aligned with visual climaxes, a near-silent breakdown between them, fade at the end; effects on off-beats, one per sound word.
8. **Variable vs fixed**: the model fills the hook number, each district's category and title, a gag from an enum, the closing stat, brand, slogan and call to action. 11 strings make a 22 s film.
9. **Rules** (to be validated): 4–6 districts on whole beats; frame 0 shows scene, mascot and hook; length limits (hook ≤6, category ≤6, title ≤18 after scaling, bubble ≤10, sound word ≤5); no repeated gag in adjacent districts; no URL on the end card; billboards never change text while leaving; closing numbers must come from `meta.facts`.

**9:16 adaptation**: billboards move into the former caption band; horizon at y≈1560 (`layout916` in tokens).

**Good fit**: content platforms, feature-rich software, multi-store or multi-category businesses, course catalogs. **Poor fit**: single-benefit or process-driven products (use cards).
