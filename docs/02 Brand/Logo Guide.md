---
type: guide
status: draft
owner: Dinesh
updated: 2026-11-15
issues: [10, 25, 195, 200, 324]
tags: [brand, logo]
---
# Logo Guide

> [!todo] Unknown. Ask Dinesh
> The wordmark font **Monr** (and Monare) came as personal-use demo licences. A commercial licence is needed before Coinroof goes public. The font file is not in the repo; the wordmark is vector outlines only.

## The mark
A striped tile: coin-rim arcs in green and red rising from the top-right corner, with level stripes across it. Beside it, **COINROOF** in Monr. From Dinesh's Canva design (2026-10-29, #195). Palette: green #067B00, red #CB0900, ink #1B1B1B.

## Files
Always use the files in `brand/coinroof/`, never retype the wordmark. Never redraw, recolour or stretch the logo.

| Need | File in `brand/coinroof/logo/` |
|---|---|
| In the app (sign-in, rail, phone header) | `svg/coinroof-lockup-plain-light.svg` and `-dark.svg` (#200) |
| Lockup on a coloured bar | `svg/coinroof-lockup-red-fade.svg`, `-green-fade.svg`, `-black.svg`, `-white.svg` |
| Square spaces | `svg/coinroof-lockup-stacked-light.svg` and `-dark.svg` |
| Mark only | `svg/coinroof-mark.svg`; small sizes `coinroof-mark-small.svg`; outline `coinroof-mark-outline.svg` |
| One colour | `svg/coinroof-mark-mono-black.svg` and `-mono-white.svg` |
| Wordmark only | `svg/coinroof-wordmark-ink.svg` and `-white.svg` |
| PNG copies | `png/` (lockups 2000px wide, stacked 1600px, mark 1024px) |

App icons are in `brand/coinroof/icons/`, social images in `brand/coinroof/social/`, animations in `brand/coinroof/animation/` ([[Animation Guide]]).

## Rules
* Do not stretch, rotate, recolour, outline or add shadows and effects.
* Use the plain lockup on app screens; the bar versions are for marketing and social.
* When a lockup gets too small to read, use the mark only.

> [!todo] Unknown. Ask Dinesh
> Clear space and minimum sizes for the Coinroof logo haven't been set.

## Decisions
| Date | Decision | Why |
|---|---|---|
| 2026-10-29 | Logo is Dinesh's Canva striped tile + COINROOF in Monr; kit in `brand/coinroof/` (#195) | Rename to Coinroof (market name clash) |
| 2026-10-29 | The app uses the plain lockup (no bar); logo animation is Ripple (#200) | Dinesh picked A from drafts |
| 2026-11-15 | Tallyn logo, colours, animation, icons and social files moved to `brand/archive/tallyn/` (#324) | So nobody uses the old logo by mistake; kept as history |

## Tallyn era (history)
Before the rename, the mark was a dot above two leaves (Sage and Clay) with a Jedira wordmark. Its files are in `brand/archive/tallyn/`. Old decisions:

| Date | Decision | Why |
|---|---|---|
| 2026-10-08 | Wordmark set in Jedira with a Clay "y" | Elegant and premium, a swash "a" gives it character |
| 2026-10-12 | Wordmark minimum 20px tall; the page footer uses the wordmark file, not retyped text | Dinesh chose it for the footer (#25); keeps the logo exact at small sizes |
| 2026-10-08 | Tagline in Montserrat Medium, +6% tracking | Matches body text |
| 2026-10-08 | Primary app icon is the dark one | Strongest at small sizes |

Back to [[Brand Guide]].
