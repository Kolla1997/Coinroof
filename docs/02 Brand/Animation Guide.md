---
type: guide
status: draft
owner: Dinesh
updated: 2026-11-15
issues: [10, 66, 200, 324]
tags: [brand, motion]
---
# Animation Guide

The Coinroof logo animation is **Ripple**, with its files in `brand/coinroof/animation/` (below). The Tallyn-era leaves animation and its Lottie files are in `brand/archive/tallyn/animation/`.

Always show the last frame instead of animating when the user prefers reduced motion. See [[Brand Guide]].

## Coinroof logo (#200)
Dinesh picked **A. Ripple**: the tile's frame pops in, the arcs spread out of the top-right corner one by one (green, green, green, red, red, green, green), the level stripes slide in from the left, then COINROOF rises letter by letter. About 2 seconds, ending on the exact logo. Loop: each arc brightens in turn, like a ripple.

| Use | File in `brand/coinroof/animation/` |
|---|---|
| Web app loading (#66) | `SVG/coinroof-mark-animated-light.svg` and `-dark.svg` in `web/src/components/CoinroofLoader.jsx` |
| Website, intro | `SVG/coinroof-lockup-animated-*.svg` |
| Preview in a browser (click to replay) | `HTML/coinroof-logo-intro-*.html` |
| Social, presentations | `GIF/coinroof-logo-intro-*.gif` |

> [!todo] No video or Lottie yet
> The MP4 and Lottie files that Coinroof has need ffmpeg and python-lottie, which weren't available. Make them before the phone apps need a splash.

## When filters change (#87)
Dinesh picked option A with count-up numbers. Code: `web/src/lib/motion.js`, `web/src/components/CountUp.jsx`.

| What | Effect |
|---|---|
| Data loading from the server (Transactions filters) | After 150ms (never for fast answers): card content dims to 45% and a thin Clay bar slides along each card's top; `aria-busy` on the area. New content fades in (250ms, ease-out, 3px rise) |
| Instant switches (Accounts person and bank chips, Home Yours / Everyone and its tabs) | The cards that change fade in (250ms) |
| Totals (Spent, Money in, net worth, have / owe, balances) | Count to the new value in 600ms, easing out. Screen readers get only the final value |
| Bars (net worth, credit cards) | Slide to their new sizes (300ms) |

Reduced motion: no sliding bar, rise or counting; a plain 200ms fade only.

## Debts page (#27)
| What | Effect |
|---|---|
| Rings, on first show | Tracks grow in one after another (80ms apart), arcs fill (1.1s, slight overshoot), the total counts up from 0, the legend slides in and its bars fill |
| Pointing at a ring or legend row | That ring glows, the others fade to 28%; the middle shows its amount and share |
| Notched gauges | Filled notches light up one by one (28ms apart) when shown |

Reduced motion: everything appears at once.

