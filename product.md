# PRD: CompressHD — video compressor (iOS + Android) — v3

## 1. Overview

A React Native app with a **built-in video browser**: it lists every video on the device (sortable by
file size, date created, or date modified, like a file manager). The user picks a video from this list,
chooses a quality tier with an **estimated output size shown up front**, compresses with **maximum
performance (hardware encoders) and background support**, then **previews the result** and chooses:
save as a **copy** (original or fresh metadata — user's choice) or **replace the original**.
No backend — everything on-device.

## 2. Tech stack (required)

- React Native + TypeScript via **Expo (latest SDK)** with **expo-dev-client**. Native modules are required,
  so this is a development build — **Expo Go will not work**. Use config plugins + `npx expo prebuild`.
- **react-native-compressor** — compression engine (`auto` mode replicates WhatsApp). Also use its
  `getVideoMetaData`, `getCancellationId` → `Video.cancelCompression`, and
  `activateBackgroundTask` / `deactivateBackgroundTask` APIs.
- **expo-media-library** — video enumeration for the browser AND gallery save/delete.
  (No system picker needed; selection happens in the in-app browser.)
- **expo-video** (preview player), **expo-keep-awake**.
- Virtualized list for the browser (`@shopify/flash-list` preferred, FlatList acceptable).
- Android background execution: a true **foreground service** with a progress notification
  (config plugin / small native module is acceptable).

## 3. User flow (state machine)

1. **Library (home):** the in-app video browser (see §4). Tapping a video → Selected.
2. **Selected:** large thumbnail + original stats (resolution, duration, size), back button to Library,
   plus a **quality selector** (segmented control):
   - **Full HD · 1080p** — "Best quality"
   - **HD · 720p** (default) — "WhatsApp HD"
   - Deliberately **no low-quality tier**.
     Each tier shows its **estimated output size** (see §6), e.g. "HD · 720p · ~14 MB".
3. **Compressing:** determinate progress % + rough ETA, Cancel button (`Video.cancelCompression`),
   screen kept awake; continues in background per §7 (Android shows live progress notification).
4. **Preview & decide:** inline player of the compressed file; original vs **actual** compressed size and
   % saved. Actions:
   - **Save as copy** → sub-choice: **Keep original metadata** (default: original capture date + GPS)
     or **Fresh metadata** (creation date = now, GPS stripped).
   - **Replace original** → save the compressed copy (always with original metadata), then delete the
     source asset. The OS will show a **system confirmation dialog** (Android 11+
     `MediaStore.createDeleteRequest`, iOS `PHAssetChangeRequest.deleteAssets`) — this cannot be
     bypassed. Show our own "This can't be undone" warning first.
   - **Discard** → delete temp file, back to Library.
5. **Success:** toast with destination → back to **Library, refreshed** (new copy visible / replaced
   entry updated).

## 4. Video browser (home screen)

- **Data:** all device videos via the media library (`mediaType: video`), **paginated** (~60 per page,
  cursor-based) with infinite scroll and a virtualized list. Lazy-loaded thumbnails with caching.
  Must stay smooth (target 60 fps scrolling) with libraries of 1,000+ videos.
- **Row contents:** thumbnail with duration badge, filename, file size, and the date relevant to the
  active sort (created or modified).
- **Header:** total video count (total size may be shown once known, see size index below).
- **Sorting:** toolbar with three options — **File size**, **Date created**, **Date modified**.
  Tapping the active option toggles ascending/descending. Default: Date created, newest first.
  Persist the last-used sort across launches.
- **Platform implementation notes:**
  - **Android:** MediaStore indexes `SIZE`, `DATE_ADDED`/`DATE_TAKEN`, `DATE_MODIFIED` — perform all
    sorting in the MediaStore query itself. All three sorts must feel instant.
  - **iOS:** creation/modification date sorts are supported natively by the photo-library query.
    **File size is NOT a native sort key on iOS** — build a **lazy, persistent size index**: batch-fetch
    per-asset file sizes in the background, cache by asset id + modification time, then sort
    client-side. First size-sort on a large library shows a progress indicator ("Indexing sizes…");
    afterwards it must be instant. New/changed videos update the index incrementally.
- **Refresh:** pull-to-refresh; auto-refresh after any save/replace.
- **Limited access:** if the user grants partial access (iOS Limited Photos, Android 14 "selected
  videos"), show the granted subset plus a persistent "Manage access" banner that opens the system
  re-selection UI. Empty state: "No videos found" + permission hint if relevant.

## 5. Quality tiers & compression spec

| Tier         | Long edge | Video bitrate (@30 fps) | Audio           | Implementation                    |
| ------------ | --------- | ----------------------- | --------------- | --------------------------------- |
| Full HD      | 1920 px   | ~4.5 Mbps               | AAC 128 kbps    | `manual` mode, explicit `bitrate` |
| HD (default) | 1280 px   | ~2.5 Mbps               | AAC 96–128 kbps | `auto` mode + `maxSize: 1280`     |

- Output: **MP4, H.264 + AAC** (maximum gallery compatibility). Scale video bitrate proportionally for
  60 fps sources. **Never upscale**; preserve aspect ratio and rotation.
- If the source is already at/below a tier's resolution + bitrate, disable that tier with a note; if all
  tiers are disabled, show "Already optimized" and skip. **Never produce a file larger than the source.**

## 6. Size estimate (shown BEFORE compressing)

- `estimated_MB = duration_seconds × (video_kbps + audio_kbps) ÷ 8000`, rounded, prefixed with "~".
- Hardware encoders are bitrate-targeted, so estimates should typically land within ±20% of actual.
- Show the actual size in the Preview state; log estimate vs actual for tuning.

## 7. Performance & background execution (must-have)

- **Hardware encoding only:** Android **MediaCodec** / iOS **VideoToolbox** (the paths
  react-native-compressor uses natively). Do NOT add a software/CPU encoder — the dedicated encoder
  silicon is faster and far more battery-efficient than any CPU/GPU software encode; it IS the
  maximum-performance option on mobile.
- **Pipeline:** single decode → scale → encode pass, no intermediate files, all native/off the JS
  thread; UI stays responsive during compression.
- **Browser performance:** virtualization + thumbnail caching + pagination as per §4; size indexing on
  iOS runs at background priority and never blocks the UI.
- **Background behavior:**
  - **Android:** compression runs under a **foreground service** with a live progress notification
    (unlimited duration). Tapping the notification reopens the app in the Compressing state.
  - **iOS:** wrap the job with `activateBackgroundTask` / `deactivateBackgroundTask`. iOS caps
    background execution time — if the OS suspends the job, detect it on next foreground, clean up,
    and offer one-tap retry. Never corrupt state or leave orphan temp files.
- **Speed acceptance target:** ≥ 2× real-time on a mid-range 2023+ device
  (a 60-second 4K clip → 720p in ≤ 30 seconds).

## 8. Metadata rules

- Before compressing, read from the source: creation date/time, GPS location (if present), orientation.
- **Copy + Keep original metadata (default):** the saved gallery asset must show the **original capture
  date** (not today) and original location. Write `creation_time`/location into the output MP4 and/or set
  them on the saved asset natively (iOS: `PHAssetChangeRequest.creationDate` / `.location`;
  Android: `MediaStore.Video.Media.DATE_TAKEN`). A small custom native module is acceptable.
- **Copy + Fresh metadata:** creation date = now; GPS not carried over.
- **Replace original:** always keeps original metadata.
- Log any metadata fields that could not be carried over.

## 9. Permissions

- The in-app browser requires **video-library read access** (not just a picker):
  - iOS: `NSPhotoLibraryUsageDescription` + `NSPhotoLibraryAddUsageDescription`; request full access,
    handle **Limited** gracefully per §4.
  - Android: `READ_MEDIA_VIDEO` (API 33+) with legacy fallback; handle Android 14 partial access per §4;
    `POST_NOTIFICATIONS` (API 33+) for the progress notification; `FOREGROUND_SERVICE` with the correct
    service type for the target API level. Save via MediaStore; delete via `createDeleteRequest`.
- Request on first launch of the browser; if denied, show a friendly screen with "Open settings".

## 10. Edge cases

- Huge libraries (5,000+ videos): pagination and scrolling stay smooth; size index builds incrementally.
- Long videos (> 5 min): elapsed time + ETA in-app; live % in the Android notification.
- HDR / Dolby Vision / HEVC sources → still produce playable SDR H.264 output; no crashes.
- Portrait and landscape both keep correct orientation.
- Cancel, or app killed mid-compression → temp files cleaned on next launch; offer retry.
- Low storage → estimate required space from §6 and fail early with a clear message.
- Replace flow: if the user rejects the OS delete dialog, keep the saved copy and tell them the
  original was left untouched.
- Video deleted/moved by another app while listed → handle stale entries gracefully on tap (refresh + toast).

## 11. Non-goals (v1)

No batch compression, no trimming/editing, no photos, no cloud upload, no custom bitrate input
(tiers only), no folder/album navigation, no filename search (flat all-videos list only).

## 12. Changelog

Every feature added, changed, or removed gets an entry here (newest first). Sections 1–11 stay as the
original spec — append here instead of rewriting them.

| Date       | Change                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-31 | Project initialized: Expo SDK 57 blank-typescript scaffold, §2 dependencies installed, native config (permissions, plugins, background modes). No features yet. |
| 2026-08-01 | Tooling: ESLint (`eslint-config-expo`) + Prettier (`eslint-config-prettier`), with `lint` / `format` / `format:check` scripts. No product behavior change.      |
| 2026-08-01 | Foundations: design tokens, UI primitives, JSON key-value storage, §3 flow state machine, and domain types. Added `react-native-nitro-modules` (required peer of react-native-compressor 2.x), `expo-file-system`, `expo-image`, `react-native-safe-area-context`. Native config: media-library `granularPermissions: ["video"]` (required for Android 14 partial-access detection), `FOREGROUND_SERVICE_DATA_SYNC`, and removal of the unused iOS `UIBackgroundModes`. No user-visible behavior yet. |
| 2026-08-01 | Scope: Android ships first. iOS-specific capabilities (metadata write-back, native asset sizes, background task) sit behind the same typed interfaces and report as unsupported until they are implemented. |
| 2026-08-01 | Added the §4 video browser: permission gate, paginated all-videos list with thumbnails, duration, size and dates, persisted three-way sort, pull-to-refresh, live library-change refresh, partial-access banner with "Manage access", and empty/error states. Tapping a row opens the selected video with its original stats. File sizes come from a new lazy persistent size index — neither expo-media-library API exposes a size, and `AssetField` has no size member, so sorting by size is not something the media store can do on either platform. Sizes are Android-only for now; the iOS reader is part of the native module work. |
| 2026-08-01 | Added the §5 quality tiers and §6 size estimate: Full HD · 1080p (manual, 4.5 Mbps) and HD · 720p (auto, 2.5 Mbps, default), each shown with its estimated output size before compressing. Tiers the source is already at or below — or that would not shrink the file — are disabled with a reason, and a source no tier can improve shows "Already optimized". Frame-rate scaling applies to the manual tier only, since `auto` mode ignores an explicit bitrate. |

## 13. Acceptance criteria

1. The home screen lists the device's videos with correct thumbnails, filenames, sizes, and dates;
   all three sorts work in both directions; Android sorts are instant, iOS size-sort is instant after
   one-time indexing; last-used sort persists.
2. Selecting a video from the list flows straight into quality selection → compression (no system picker).
3. Both quality tiers work; estimated size is shown before compressing and is typically within ±20% of actual.
4. The user can preview the compressed video before any save decision; all three outcomes work:
   copy with original metadata, copy with fresh metadata, replace original (with OS confirmation);
   the library list refreshes to reflect the result.
5. Gallery capture date/location is correct per §8 in every mode.
6. Android: backgrounding mid-compression → job completes under the foreground service with live
   notification progress. iOS: background continuation via background task; OS suspension handled gracefully.
7. ≥ 2× real-time compression on a mid-range 2023+ device; browser scrolls smoothly with 1,000+ videos;
   UI never freezes.
8. A ~100 MB 4K/30 clip → roughly ≤ 10–15 MB at the HD tier and looks near-original on a phone screen;
   output is never larger than the source and plays in stock gallery apps on both platforms.
9. Limited/partial media access shows the granted subset with a working "Manage access" flow.
