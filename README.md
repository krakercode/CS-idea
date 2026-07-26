# CS Training Widget

A desktop app (Tauri + React) that pulls Counter-Strike stats from [Leetify](https://leetify.com)'s
public API and collates ranks, rating breakdown, recent matches, rating trends over time, and
rules-based training suggestions in one place.

Data Provided by Leetify — this project is not affiliated with or endorsed by Leetify.

## Features

- Look up any player by Steam64 ID (or Leetify profile ID)
- Current ranks + rating breakdown (aim, positioning, utility, clutch, opening, CT/T side)
- Recent match history
- Local rating trend charts, built from snapshots taken each time you look a profile up
- Rules-based training suggestions derived from the weakest rating dimensions

## Setup

```sh
npm install
npm run tauri dev
```

Optionally grab a Leetify API key at https://leetify.com/app/developer and paste it into
Settings — requests work without one, just at stricter rate limits.

## Notes on the Leetify API

This app talks to Leetify's public API (`api-public.cs-prod.leetify.com`), documented at
https://api-public-docs.cs-prod.leetify.com/. The exact response schema wasn't directly
verifiable while building this (docs page returned 403 from this environment), so the Rust
client passes through raw JSON and the frontend reads fields defensively. If Leetify's response
shape differs from what's assumed here, adjust the field lookups in `src/lib/leetify.ts` and
`src-tauri/src/db.rs`/`suggestions.rs` after checking a real response.
