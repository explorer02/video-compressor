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
```

Add dependencies with `npx expo install <pkg>`. Native config belongs in [app.json](app.json) via
config plugins, not in the generated `ios/` and `android/` folders.

## Conventions

- TypeScript `strict`; no `any` in new code.
- Keep compression, media-library, and metadata work in small typed modules; screens stay thin.
- Media work never blocks the JS thread.
