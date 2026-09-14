# AGORA landing rebuild brief (owner feedback, 2026-09-15)

Owner verdict on the current landing: "AI slop". Rebuild from scratch. Real product landing, not a document.

## Non-negotiable anti-slop rules (from owner + research)
- No dark-glow background, no gradient blobs, no glassmorphism, no purple.
- No centered hero with badge/pill above H1. No all-caps eyebrow labels. No status pills in copy.
- No 3-column identical feature cards. No icon+h3+p grids. No colored left borders. No numbered step cards.
- No stat banners of made-up numbers. Only real data: MINT archive (lib/data/mint/mint-real-data.json, generatedAt 2026-06-23) and the live paper engine.
- No text walls. Every section = one scene: a product visual doing something + at most 1 headline + 1 short paragraph.
- Copy: short, concrete, human. Korean in Pretendard, letter-spacing tight, word-break keep-all. No emoji, no em dash, no marketing adjectives.
- Real product screens must appear: the arena race track / leaderboard, agent detail sheet, vault dashboard with activity feed, risk policy settings, emergency exit. These components exist in components/arena and components/vault; they may be rendered inside a device/browser frame in the landing (read-only reuse, mock/guest data). Prefer live components over screenshots.

## Narrative (scroll order = story)
1. Cold open: the problem in one line. "봇에게 API 키를 넘기는 순간, 돈은 당신 것이 아닙니다." Visual: a key sliding into a black box, or an exchange API key form being handed over. Keep it small and sharp.
2. The arena: five agents race on identical $10,000 paper capital. Show the actual RaceTrack/leaderboard in a frame, animating live.
3. MINT, 23 days: pinned scroll-scrub chapter. As the user scrolls, the equity number counts from 9,938.15 to 13,578.06, the curve draws day by day, and the trade tape reveals trades (wins and losses, including ETH-15m -7,212.98). Label: 2026-06-01 to 06-23 archived snapshot, not live, not a promise.
4. Risk next to return: MDD, win rate, losing sub-strategies (DOGE-15m -29.95%). The honesty is the feature.
5. Delegate authority, not money: the policy gate. Interactive: normal signal passes, limit-exceeding signal blocked, kill switch stops. Then the actual vault dashboard + settings screen in a frame.
6. Where we are: what runs today vs what is next (paper engine, Sui testnet vault tx builders, FastAPI agent registry; DEX fills and Walrus memory next). Plain table, no cards.
7. Close: one CTA "아레나 열기" to https://thezonebio.com/agora, secondary GitHub https://github.com/TheZoneAgora.

## Motion
- Connected: elements from one scene carry into the next (the orange line of MINT's curve becomes the track, the policy gate token becomes the vault dot). Use framer-motion useScroll/useTransform, pinned sections (position sticky), spring counters. 60fps: transforms/opacity only.
- Reduced motion and the nav "모션 정지" toggle (document.documentElement.dataset.agoraPaused, event 'agora-motion-change') must freeze all loops.
- Mobile first-class: sticky chapters degrade to stacked scenes.

## Palette / type
- Base warm ivory #FFF8ED / #F4EDE3 paper, ink #11100F, single accent agora-orange #FF5A1F, data green #24C77A / red #F04F5F only for numbers. Dark is allowed ONLY inside product frames (the app is dark), which creates contrast against the ivory page.
- Pretendard Variable (already imported in landing.css). Display sizes large but never a 4-line headline. Mono for numbers with tabular-nums.

## References (study the pattern, do not copy)
- Mercury.com (finance editorial, product-in-frame scenes), Linear.app homepage (pinned scroll chapters), Ramp.com (real UI as hero), Apple product pages (scroll-scrub storytelling), Stripe Sessions pages (data-driven motion), Family.co (playful precision).

## Facts you may state
- MINT archive: start 9,938.15 (06-01), end 13,578.06 (06-23), +35.78% vs 10,000 base, daily-curve MDD -12.2%, 40 recent trades, 10 sub-strategies (best XRP-15m +280.64%, worst DOGE-15m -29.95%), Kalshi weather markets summary in json.
- Arena: 5 strategies (momentum BTC, contrarian SUI, grid ETH, breakout SOL, low-frequency SUI/BTC ratio arb), real-time prices Binance/CoinGecko, paper capital 10,000 each.
- Vault: Sui testnet, owner-only withdraw, per-trade and epoch limits, emergency exit, tx builders + 16 unit tests; DEX fill integration pending; FastAPI agent registry live.
