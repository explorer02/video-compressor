# iOS parity plan

The route from "Android ships first" to full feature parity on iOS, as promised by
[product.md](product.md). This is a working plan, not product documentation: product.md stays the
source of truth for what the app _does_, and each phase below updates it (plus
[CHANGELOG.md](CHANGELOG.md)) in the same change that lands the feature.

> **Status (2026-08-04):** the code for Phases 1–3 and Phase 4's calibration/copy items has
> landed — the Swift module is implemented, capabilities read true, the save report refactor and
> the background-task strategy are in, and typecheck/lint pass. What remains is everything that
> needs a Mac and a device: the Phase 0 walk (prebuild, pods, full-flow audit), Phase 4's device
> matrix (iCloud, HDR/Dolby Vision, orientation, speed target), and the §12 acceptance run. The
> Risks table is now the checklist for that verification — especially the `ph://` id round-trip,
> the `fileSize` KVC read, and `manual`-mode bitrates through the iOS exporter.

## Where iOS stands today

The app was built for this port. Every platform gap sits behind
`mediaToolsCapabilities` ([modules/media-tools/index.ts](modules/media-tools/index.ts)) — callers
branch on the answer, never on `Platform.OS` — and the iOS module
([modules/media-tools/ios/MediaToolsModule.swift](modules/media-tools/ios/MediaToolsModule.swift))
honestly reports every capability as `false`. Flipping those flags with real implementations is
most of the work; the JS above them lights up on its own.

**Already cross-platform (needs device verification, not new code):**

- The entire JS app: browser, date sorts, length filter, selection mode, tier picker + estimates,
  compression pipeline, preview/comparison players, batch compression, workspace + interrupted-job
  recovery ([src/app/FlowRouter.tsx](src/app/FlowRouter.tsx)), toasts, hardware-back handling.
- Compression itself: react-native-compressor drives VideoToolbox on iOS — §7's hardware-only rule
  is the library's native path on both platforms.
- The iOS audio patch is already in
  [patches/react-native-compressor+2.0.3.patch](patches/react-native-compressor+2.0.3.patch)
  (AAC 256 kbps / 48 kHz instead of 128/44.1 — §5's "audio never degraded").
- Delete flows: `useDeleteVideos` already treats iOS like Android 11+ (the system dialog is the
  only confirmation), and outcome verification via `assetExists` is platform-neutral.
- Limited access: `presentPermissionsPicker` in
  [src/core/videoLibrary/permissions.ts](src/core/videoLibrary/permissions.ts) is the iOS Limited
  Photos picker; the §4 banner and permission gate need only verification.
- Native config: [app.json](app.json) already carries the bundle id and both
  `NSPhotoLibrary*UsageDescription` strings; the media-tools podspec and
  `expo-module.config.json` already register the Apple module (iOS floor: 16.4).

**Stubbed on iOS (the actual work):**

| Capability             | Android today                       | iOS implementation to write               |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| `videoProperties`      | MediaMetadataRetriever + MediaStore | `PHAsset` + `AVAsset` track inspection    |
| `assetSizes`           | One MediaStore cursor per batch     | `PHAssetResource` per asset, no file I/O  |
| `librarySave`          | MediaStore insert + MP4 atom stamp  | `PHAssetCreationRequest` with dates + GPS |
| `captureDateWriteBack` | DATE_TAKEN/DATE_MODIFIED columns    | `PHAssetChangeRequest.creationDate`       |
| `locationWriteBack`    | `false` forever (columns removed)   | `true` — `location` on the change request |
| `foregroundService`    | CompressionForegroundService        | Stays `false` by design — see Phase 3     |

Plus one gap outside media-tools: §7's iOS background continuation
(`activateBackgroundTask` / `deactivateBackgroundTask`) is specified in product.md but not yet
wired into [src/core/background/index.ts](src/core/background/index.ts).

## The contract every phase honors

1. **Same TS surface on both platforms.** No caller learns about iOS; they keep branching on
   capabilities and reports.
2. **Honest reporting over plausible values.** Where iOS genuinely cannot do something (settable
   modification date, folders), the report says so with a reason — exactly as Android does for GPS.
3. **Docs move with the code.** Each phase edits product.md's relevant sections (the §4/§8/§7
   "iOS: …when implemented" clauses) and adds a CHANGELOG entry, in the same commit.
4. **`typecheck`, `lint`, `format` before every finish**, per [AGENTS.md](AGENTS.md).

---

## Phase 0 — boot the app on iOS and audit the baseline

Goal: the existing capability-gated app runs end to end on an iPhone, degraded exactly as
designed — before any new native code muddies the diagnosis.

1. `npm run prebuild` + `npm run ios` (dev client; Expo Go will not work). Fix anything the iOS
   build surfaces: pod install, Swift version, signing, patch-package applying to the pod's
   sources (it patches `node_modules/react-native-compressor/ios/…`, which is what the pod
   compiles — verify the patched 256 kbps line is in the built app).
2. Walk the full flow on device: permission gate (full + Limited), browse 1,000+ videos at 60 fps,
   date sorts both directions, length filter, thumbnails and inline playback (`ph://` sources),
   selection mode + bulk delete (system dialog, honest "3 of 5" reporting), compress each tier,
   preview comparison, **Save as copy (fresh metadata)** — the one save mode that works without
   media-tools — Replace original, Discard, low-storage failure, cancel, kill-mid-compression
   recovery toast.
3. Audit expected degradations, so later phases have a clean before/after: size sort and filter
   hidden, header shows count only, "Keep original metadata" absent (both Preview and Batch
   setup), frame rate assumed 30, folder line absent, background job dies when backgrounded.
4. File platform bugs found here as their own fixes — this phase adds no features, so it may not
   need a product.md edit beyond corrections.

Exit: §12 criteria 1–4 pass on iOS in their degraded form; a written list of everything observed
broken that is not on this plan.

## Phase 1 — media-tools reads: `videoProperties` + `assetSizes`

The read half of the Swift module. No JS changes expected — flipping the two capability flags
switches `assetSizeReader` to the native reader and `readSourceVideo` to real properties.

**Shared plumbing first:** one helper that turns the JS asset id into a `PHAsset`. expo-media-library
hands the app `ph://…` ids on iOS (they double as image/player sources); the Swift side strips the
scheme and calls `PHAsset.fetchAssets(withLocalIdentifiers:)`. Every result map **must be keyed by
the exact input id string**, not the localIdentifier — Android does the same via its `byRowId`
mapping, and the size index's `Map` keys depend on it.

**`readAssetSizes(ids)`** — what unlocks §4's size sort, filter, and header total:

- Batch-fetch the `PHAsset`s, then per asset `PHAssetResource.assetResources(for:)`, pick the
  original video resource (`.video`; for slow-mo prefer `.fullSizeVideo` when present), and read
  `value(forKey: "fileSize")`. This is metadata-only — no file I/O, no iCloud download — which is
  what lets the index build for a 5,000-video library at background priority. The JS side already
  feeds batches of 24 (`sizeIndex` `BATCH_SIZE`) and treats missing entries as "unknown, sort
  last", so partial answers are fine.
- The `fileSize` KVC key is not formal API (see Risks); guard it (`responds`/optional cast) and
  omit the asset on failure rather than throwing.

**`readVideoProperties(id)`** — feeds §8 metadata carry-over and real-frame-rate bitrate scaling:

- From `PHAsset` directly: `creationDate` → `capturedAtMs`, `location` → `{latitude, longitude}`.
- From the AVAsset (`PHImageManager.requestAVAsset`, network access allowed — this call happens
  once per compression, which needs the bytes anyway): video track `nominalFrameRate`,
  `estimatedDataRate` → bitrate, `preferredTransform` → rotation normalized to 0/90/180/270.
- `folder`: `nil` by design — iOS albums are not directories. `readSourceVideo` already carries a
  null folder and `saveTargetFor` omits it.
- `sizeBytes`: same resource read as above.
- Slow-motion sources come back as `AVComposition`, not `AVURLAsset`; read what the tracks offer
  and return `nil` fields rather than guessing — JS falls back to `ASSUMED_FRAME_RATE` and the
  file-stat size.

**Capabilities:** `videoProperties: true`, `assetSizes: true`.

**Lights up without JS changes:** size sort + "Indexing sizes…" + instant re-sorts, size filter,
header total bytes, unknown-size exclusion, 60 fps bitrate scaling in estimates, GPS shown on the
preview details. Verify each against §4/§12, plus index pruning after a replace.

**Watch out:** `useVideoDetails` reads through `readVideoProperties` for the Selected screen — on
iOS that now touches `requestAVAsset`. If profiling shows it heavy for iCloud-offloaded videos,
split the PHAsset-only facts (dates, GPS, size) from the AVAsset facts and defer the latter to
compression time. Decide on evidence, not up front.

Exit: §12.1 fully green on iOS ("size-sort instant after one-time indexing"), estimates use real
frame rates, and a 1,000+ library indexes without jank.

## Phase 2 — media-tools writes: `librarySave` + metadata write-back

The save half, plus the one JS refactor this plan requires.

**`saveVideo(options)`**:

- `PHPhotoLibrary.performChanges` with `PHAssetCreationRequest.forAsset()`;
  `addResource(with: .video, fileURL:, options:)` with `shouldMoveFile = true` (halves peak disk
  use; `workspace.discard` already tolerates the file being gone).
- `creationDate` and `location` set **in the same change block** — the iOS analogue of Android's
  "dates set in the insert itself". No MP4 atom stamping needed: Photos stores this metadata in
  its own database and does not re-derive it from the file the way MediaStore's scan does.
- `folder` ignored by design; `modifiedAtMs` not settable on iOS (`PHAsset.modificationDate` is
  system-owned) — reported skipped, never faked.
- Resolve with the new asset's id **in the same `ph://` shape the library queries return**, so the
  refreshed list and the size index agree on identity.
- **New input field:** `SaveVideoOptions` gains optional `latitude`/`longitude`
  (TS + both natives). Android was allowed to omit GPS from the save path because it can never
  write it; iOS carries it at creation. `saveTargetFor` in
  [src/features/outcome/saveOutcome.ts](src/features/outcome/saveOutcome.ts) passes
  `source.location` on keep-original saves, gated on `locationWriteBack`. Android's `saveVideo`
  reports a supplied location as skipped, same reason it uses today.

**`applyAssetMetadata(id, metadata)`** — the fallback/write-back path: `PHAssetChangeRequest`
setting `creationDate`/`location`, verified by refetching the asset and comparing, mirroring
Android's read-back verification. `modifiedAt` → skipped with an honest reason.

**The JS refactor — a truthful save report.** `saveWithMetadata` currently hardcodes
`{ applied: ['capturedAt', 'modifiedAt'] }` whenever `saveCarriesMetadata` is true. That claim
becomes a lie on iOS, where a save carries capture date + GPS but never the modified date. Per
AGENTS.md ("refactor when a change makes an existing shape wrong"):

- `MediaTools.saveVideo` resolves `{ assetId, report: AppliedMetadataReport }` on both platforms.
  Android folds its existing `assertDates`/`readColumns` verification into the report; iOS reports
  what the change block actually set.
- `saveToLibrary` returns both; `saveOutcome` forwards the native report instead of synthesizing
  one; the `saveCarriesMetadata` constant disappears. `savedMessage` already renders partial
  application honestly ("Saved with the original capture date").
- This touches the Android happy path — regression-test §8's date verification on an Android
  device before merging.

**Capabilities:** `librarySave: true`, `captureDateWriteBack: true`, `locationWriteBack: true`.

**Lights up:** "Keep original metadata" appears on the Preview screen and Batch setup
(`canKeepOriginalMetadata`). Two copy tweaks while there: the hint "Keeps the original dates"
should read "Keeps the original dates and location" when `locationWriteBack` is true
([src/screens/PreviewScreen.tsx](src/screens/PreviewScreen.tsx)); and §3.4's Replace wording
("free up 190 MB") oversells on iOS, where deletes sit in Recently Deleted for ~30 days — soften
per platform and note it in product.md §10.

Exit: §12.4 and §12.5 green on iOS — all three save outcomes, capture date + GPS verified in the
Photos app, replace flow with system dialog and after-the-fact verification.

## Phase 3 — background continuation (§7 iOS)

iOS keeps `foregroundService: false` — that is the design, not a gap. Instead the job wraps the
compressor's own background task.

- Restructure [src/core/background/index.ts](src/core/background/index.ts) from
  "foreground service or inert" into two strategies behind the unchanged `beginBackgroundSession`
  call sites (single job + batch): the Android foreground-service session as today, and an iOS
  session that calls `activateBackgroundTask` on begin and `deactivateBackgroundTask` on end,
  with `update()` a no-op (no notification surface on iOS by design). Verify the exact callback
  signatures against react-native-compressor's TS definitions.
- **Suspension handling, per §7:** `activateBackgroundTask`'s expiration callback is the signal
  that iOS is out of time. On expiry: cancel the encode through the existing `cancel` path and
  mark the job journal (`workspace`) so the next foreground/launch shows the existing interrupted
  recovery ("A compression was interrupted — you can start it again") instead of a silent hang.
  The app-killed-while-suspended case already works: `recoverOnLaunch` + the FlowRouter toast.
- If device testing shows a third state — app alive, encoder silently dead after resume — add an
  AppState foreground listener on the compressing screens that treats "no progress event within a
  few seconds of resume" as failure-with-retry. Build it only if observed; the failure path and
  copy already exist.
- Batch: one background session per batch (same rule as Android's one-service-per-batch). iOS
  grants roughly 30 s–3 min; a long batch will not finish in background. That is §7's accepted
  reality — recover on foreground, never corrupt state or leak temp files. product.md §7 gets the
  concrete behavior spelled out.

Exit: §12.6 green on iOS — backgrounding mid-compression either completes within the OS window or
recovers gracefully with one-tap retry; temp files never leak (workspace empties on launch).

## Phase 4 — calibration, iOS-specific edge cases, acceptance run

**Estimate calibration (§6):** iOS re-encodes audio at 256 kbps (our patch), so the tiers'
`audioKbps: 128` understates every iOS estimate by ~1 MB/min. Make the estimate's audio term
platform-aware in [src/core/compression/tiers.ts](src/core/compression/tiers.ts) (one documented
constant — `Platform.select({ ios: 256, default: 128 })` — is acceptable here: this is arithmetic
about a platform fact, not a capability seam). Then use the existing `[estimate]` drift logs on
device to confirm ±20% holds for all three tiers; check `auto`-mode (WhatsApp tier) behaves like
the same envelope on iOS.

**iOS-only edge cases, in §10's spirit (each lands with its product.md edit):**

- **iCloud / "Optimize iPhone Storage":** an offloaded video has no local bytes;
  `resolveLocalPath` (`Asset.getUri()`) triggers a download that can take minutes or fail
  offline. `readSourceVideo` runs on the Selected screen's compress tap and per batch item — both
  need a visible "Preparing video…" state and a clear offline failure, not a frozen button.
  Slow-mo assets additionally export a new file there (already documented in
  `expoMediaLibrary.ts`); same UX covers both.
- **HDR / Dolby Vision:** iPhones record HDR by default; §10 demands playable SDR H.264 out.
  Verify tone-mapping through the library's exporter with HLG + DV clips; escalate to a patch if
  output is broken (see Risks).
- **Orientation:** portrait/landscape round-trips via `preferredTransform` — verify no sideways
  outputs.
- **Buffering caps:** confirm expo-video's `bufferOptions` map sanely to AVPlayer (the OOM they
  fix is ExoPlayer-specific; on iOS they must merely do no harm).
- **Speed target:** log-verify ≥ 2× real-time (§7) on a mid-range 2023+ iPhone; VideoToolbox
  should clear it comfortably.
- **Tablet:** `supportsTablet: true` is currently declared. Either verify the portrait phone UI is
  acceptable on iPad or flip it to false — decide, don't drift.

**Full §12 acceptance pass** on two devices (iOS 16.4 floor + current iOS), 1,000+ video library,
including Limited Photos, batch compression with mixed Copy/Replace, and kill/recover.

Exit: every §12 criterion green on iOS; product.md's "Status" paragraph (Android-first) deleted —
the doc then describes one product on two platforms.

---

## Risks and open questions

| Risk                                                                                    | Mitigation                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PHAssetResource` `fileSize` is KVC on a non-formal key                                 | Industry-standard and long-stable, but guard defensively; fallback is "size unknown" (sorts last, excluded from filters) — the UI already handles it    |
| `ph://` id shape differs somewhere (queries vs `Asset.create` vs our module)            | Normalize in one Swift helper + one round-trip test early in Phase 1; a mismatch silently breaks size-index keys                                        |
| Background task window too short for real encodes                                       | Accepted by §7; the deliverable is clean recovery, not miracles. Set expectations in product.md                                                         |
| react-native-compressor iOS: `manual` bitrate / `maxSize` semantics differ from Android | The `[estimate]`/`[speed]` logs make drift measurable on day one; patch via patch-package if the exporter misbehaves (we already maintain an iOS patch) |
| HDR→SDR through the exporter washes out or fails                                        | Test early (Phase 0 walk); if broken, patch the exporter's color properties — contained in `patches/`                                                   |
| iCloud download latency mistaken for a hang                                             | The "Preparing video…" state plus explicit offline error in Phase 4                                                                                     |
| Save-report refactor regresses Android's verified dates                                 | It rearranges the module's proven verification into a return value; re-run the §8 device checks on Android before merge                                 |

## Explicitly not iOS work

- **No foreground service / progress notification on iOS** — no such OS concept; `update()` is a
  deliberate no-op there.
- **No folder placement on save** — albums are not directories; `folder` stays ignored by design.
- **No settable modified date on iOS** — reported skipped, honestly.
- **No GPS write-back on Android** — unchanged; the columns are gone since Android 10.
- **No new JS dependencies expected** — the port is Swift inside `modules/media-tools`, one
  background-session strategy, and two small JS refactors named above.

## Sequencing and size

Phases are ordered by dependency and ship independently behind capability flags: 0 (S) → 1 (M) →
2 (L — two natives + the report refactor) → 3 (M) → 4 (M). After Phase 1 an iOS build is already
visibly better (size sort, real estimates); after Phase 2 it reaches feature parity for every save
mode; Phase 3 closes §7; Phase 4 closes §12.
