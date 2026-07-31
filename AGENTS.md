# CompressHD — agent guide

On-device video compressor (iOS + Android), Expo + TypeScript, no backend.
[product.md](product.md) is the spec — read it before changing anything.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Changelog rule (mandatory)

Every feature added, changed, or removed gets an entry in the **Changelog** section of
[product.md](product.md), in the same change. Do not rewrite the existing spec sections (§1–§11).

## Commands

```bash
npm start            # dev server (dev client — Expo Go will not work)
npm run ios          # build + run iOS dev build
npm run android      # build + run Android dev build
npm run prebuild     # regenerate ios/ + android/ from app.json
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (expo config)
npm run format       # prettier --write .
```

Run `typecheck`, `lint`, and `format` before finishing a change.

Add dependencies with `npx expo install <pkg>`. Native config belongs in [app.json](app.json) via
config plugins, not in the generated `ios/` and `android/` folders.

## Conventions

- TypeScript `strict`; no `any` in new code.
- Media work never blocks the JS thread.

## Code quality (mandatory)

Write modular, extendable code that is easy to refactor:

- One responsibility per module; keep compression, media-library, metadata, and storage behind small
  typed modules with explicit interfaces. Screens stay thin — UI renders state, modules do the work.
- Depend on those interfaces, not on library internals, so a dependency can be swapped in one place.
- Extend by adding a module/variant, not by threading flags through existing code; no copy-paste
  duplication.
- Name things for intent, keep functions short, no dead code or leftover scaffolding.
- Refactor when a change makes an existing shape wrong — don't bolt onto it.

**Layered abstraction — readable top-down.** A reader should get the whole story from the top level
and only dive deeper when they want detail:

- Each function reads as a sequence of named steps at one level of abstraction; push the mechanics
  down into helpers with self-explanatory names (`compressToTier`, `readSourceMetadata`,
  `saveAsCopy`) rather than inlining them.
- Don't mix altitudes in one function — no permission checks, bitrate math, and file I/O side by side.
- Each module's public surface is the summary of what it does; keep internals unexported.
- Comment the _why_ (platform quirks, spec constraints) — the _what_ should be obvious from names.
