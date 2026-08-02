# CompressHD — video compressor (iOS + Android)

This document describes the product **as it currently exists** and is updated in the same change
that adds, changes, or removes a feature. Dated history lives in [CHANGELOG.md](CHANGELOG.md).

**Status:** Android ships first. iOS-specific capabilities (metadata write-back, native asset
sizes, background task) sit behind the same typed interfaces and report as unsupported until
implemented.

## 1. Overview

A React Native app with a **built-in video browser**: it lists every video on the device (sortable by
file size, date created, or date modified, like a file manager). The user picks a video from this list,
chooses a quality tier with an **estimated output size shown up front**, compresses with **maximum
performance (hardware encoders) and background support**, then **previews the result** and chooses:
save as a **copy** (original or fresh metadata — user's choice) or **replace the original**.
No backend — everything on-device.

## 2. Tech stack

- React Native + TypeScript via **Expo (latest SDK)** with **expo-dev-client**. Native modules are required,
  so this is a development build — **Expo Go will not work**. Use config plugins + `npx expo prebuild`.
- **react-native-compressor** — compression engine. Also its `getVideoMetaData`,
  `getCancellationId` → `Video.cancelCompression`, and
  `activateBackgroundTask` / `deactivateBackgroundTask` APIs.
- **expo-media-library** — video enumeration for the browser AND gallery save/delete.
  (No system picker needed; selection happens in the in-app browser.)
- **expo-video** (preview player), **expo-keep-awake**.
- Virtualized list for the browser (`@shopify/flash-list` preferred, FlatList acceptable).
- **media-tools** — local Expo module for what no JS dependency offers: source video properties
  (frame rate, rotation, capture date, GPS), batched asset file sizes, metadata-preserving gallery
  save, and the Android **foreground service** with its progress notification.

## 3. User flow (state machine)

1. **Library (home):** the in-app video browser (see §4). Tapping a video → Selected.
2. **Selected:** inline player with the platform's own play/pause/scrub/fullscreen controls,
   original stats (resolution, duration, size, created + modified times, folder), back button to
   Library, a top-bar **Delete** action (remove a redundant video without compressing — verified
   like Replace below), plus a **quality selector** (segmented control):
   - **Full HD · 1080p** — "Best quality"
   - **HD · 720p** (default) — "Great for sharing"
   - Deliberately **no low-quality tier**.
     Each tier shows its **estimated output size** (see §6), e.g. "HD · 720p · ~14 MB".
     Tiers below the source's resolution are hidden; tiers that can't shrink the file are disabled
     with a reason; if none can help, "Already optimized".
3. **Compressing:** determinate progress % + elapsed + rough ETA, Cancel button
   (`Video.cancelCompression`), screen kept awake; continues in background per §7 (Android shows a
   live progress notification). Hardware back cancels, same as the Cancel button; leaving the
   screen by any route stops the encoder and closes the job record.
4. **Preview & decide:** inline player of the compressed file with an **Original / Compressed**
   switch (one full-width player, source swapped underneath, so quality differences are visible);
   original vs **actual** compressed size, % saved, and the original's dates, folder, filename,
   resolution, and GPS where the platform supplies it. Actions:
   - **Save as copy** → sub-choice: **Keep original metadata** ("Keeps the original dates":
     capture + modified dates; GPS is out of scope on Android, see §8) or **Fresh metadata**
     (creation date = now, GPS stripped).
   - **Replace original** → save the compressed copy (always with original metadata), then delete the
     source asset. The OS will show a **system confirmation dialog** (Android 11+
     `MediaStore.createDeleteRequest`, iOS `PHAssetChangeRequest.deleteAssets`) — this cannot be
     bypassed. Show our own "This can't be undone" warning first, and verify afterwards whether
     the delete actually happened (§10).
   - **Discard** → delete temp file, back to Library.
5. **Success:** toast with destination → back to **Library, refreshed** (new copy visible / replaced
   entry updated).

## 4. Video browser (home screen)

- **Data:** all device videos via the media library (`mediaType: video`), **paginated** (~60 per page,
  cursor-based) with infinite scroll and a virtualized list. Lazy-loaded thumbnails with caching.
  Must stay smooth (target 60 fps scrolling) with libraries of 1,000+ videos.
- **Row contents:** thumbnail with duration badge, filename, file size, and the date relevant to the
  active sort (created or modified).
- **Header:** total video count and, once the size index is complete, the library's total size.
  With a size filter active it reads "12 of 240 videos" so a filtered list is never mistaken for a
  small library.
- **Sorting:** toolbar with three options — **File size**, **Date created**, **Date modified**.
  Tapping the active option toggles ascending/descending. Default: Date created, newest first.
  Persist the last-used sort across launches.
- **Size sort & filter machinery:** the whole library is indexed once (with an "Indexing sizes…"
  indicator), then ranked and paged from memory, so later size sorts are instant; assets whose
  size cannot be read sort last. New/changed videos update the index incrementally.
  - **Android:** sizes come from batched media-store reads via `media-tools`.
  - **iOS:** file size is NOT a native sort key — the same lazy, persistent index applies once the
    native size reader is implemented; size sort/filter are disabled until then.
- **Size filter:** any size, or ≥ 1 / 2 / 5 / 10 / 20 / 50 / 100 / 500 MB — hides everything
  smaller, for finding the videos worth acting on. Persists across launches; disabled on platforms
  with no size reader.
- **Selection mode (batch management):** long-press enters selection; the checkmark overlays the
  thumbnail (no row reflow), tapping toggles rows, long-pressing another row toggles it too. A
  constant-height selection bar replaces the header: **Select all ⁄ Deselect all**, **Delete (n)**,
  **Done**. Hardware back exits selection. Bulk delete runs in one pass and is reported honestly
  ("3 of 5" when the OS dialog only partly went through). This is batch _management_, not the
  batch compression §11 rules out.
- **Refresh:** pull-to-refresh; auto-refresh after any save/replace; live library-change refresh.
- **Limited access:** if the user grants partial access (iOS Limited Photos, Android 14 "selected
  videos"), show the granted subset plus a persistent "Manage access" banner that opens the system
  re-selection UI. Empty state: "No videos found" + permission hint if relevant.

## 5. Quality tiers & compression spec

| Tier         | Long edge | Video bitrate (@30 fps) | Audio           | Implementation                    |
| ------------ | --------- | ----------------------- | --------------- | --------------------------------- |
| Full HD      | 1920 px   | ~4.5 Mbps               | AAC 128 kbps    | `manual` mode, explicit `bitrate` |
| HD (default) | 1280 px   | ~2.5 Mbps               | AAC 96–128 kbps | `manual` mode, explicit `bitrate` |

- Both tiers use `manual` mode: the library's `auto` mode ignores a requested bitrate and applies
  its own chat-oriented envelope (~2 Mbps ceiling at 720p), which is visibly soft.
- Output: **MP4, H.264 + AAC** (maximum gallery compatibility). Video bitrate scales with the
  source's real frame rate. **Never upscale**; preserve aspect ratio and rotation.
- Tiers below the source's resolution are hidden (output is clamped to the source, so they would
  describe a file the app can't produce); tiers that can't shrink the file are disabled with a
  note; if all are ruled out, show "Already optimized" and skip.
- **Never produce a file larger than the source.** Output larger than the source is discarded, and
  an encoder that returns its input unchanged is rejected rather than adopted as output.

## 6. Size estimate (shown BEFORE compressing)

- `estimated_MB = duration_seconds × (video_kbps + audio_kbps) ÷ 8000`, rounded, prefixed with "~".
- Hardware encoders are bitrate-targeted, so estimates should typically land within ±20% of actual.
- Show the actual size in the Preview state; log estimate vs actual, and speed vs the §7 target,
  for tuning.

## 7. Performance & background execution

- **Hardware encoding only:** Android **MediaCodec** / iOS **VideoToolbox** (the paths
  react-native-compressor uses natively). Do NOT add a software/CPU encoder — the dedicated encoder
  silicon is faster and far more battery-efficient than any CPU/GPU software encode; it IS the
  maximum-performance option on mobile.
- **Pipeline:** single decode → scale → encode pass, no intermediate files, all native/off the JS
  thread; UI stays responsive during compression.
- **Browser performance:** virtualization + thumbnail caching + pagination as per §4; size indexing
  runs at background priority and never blocks the UI.
- **Background behavior:**
  - **Android:** compression runs under a **foreground service** (via `media-tools`) with a live
    progress notification — custom layout: filename, percent left / time remaining right, progress
    bar, elapsed below, with a stock-template fallback for accessibility. Updates ride the
    encoder's own progress events and are posted via `notify()`, so they keep flowing while the
    app is backgrounded. Tapping the notification reopens the app in the Compressing state.
  - **iOS:** wrap the job with `activateBackgroundTask` / `deactivateBackgroundTask`. iOS caps
    background execution time — if the OS suspends the job, detect it on next foreground, clean up,
    and offer one-tap retry. Never corrupt state or leave orphan temp files.
- **Speed acceptance target:** ≥ 2× real-time on a mid-range 2023+ device
  (a 60-second 4K clip → 720p in ≤ 30 seconds).

## 8. Metadata rules

- Before compressing, read from the source: creation date/time, modified date, orientation, frame
  rate, and GPS where the platform supplies it.
- **Copy + Keep original metadata (default):** the saved gallery asset shows the **original
  capture and modified dates** (not today). Saving goes through `media-tools`: folder and both
  dates are set in the media-store insert itself (a later column update may be recomputed or
  ignored), and the source's dates are also patched into the MP4's `mvhd`/`tkhd`/`mdhd` atoms
  before the bytes enter the store — the post-publish scan re-derives `DATE_TAKEN` from the file's
  own `creation_time`, so the file itself must carry the right dates. Every write is verified by
  read-back. Platforms without this capability fall back to create-then-write-back.
- **Location:** out of scope on Android by decision — MediaStore's location columns were removed
  in Android 10. iOS (`PHAssetChangeRequest.location`) when implemented.
- **Copy + Fresh metadata:** creation date = now; GPS not carried over.
- **Replace original:** always keeps original metadata.
- Saves land in the **source video's own folder**, not the camera folder.
- Log any metadata fields that could not be carried over, with the precise reason.

## 9. Permissions

- The in-app browser requires **video-library read access** (not just a picker):
  - iOS: `NSPhotoLibraryUsageDescription` + `NSPhotoLibraryAddUsageDescription`; request full access,
    handle **Limited** gracefully per §4.
  - Android: `READ_MEDIA_VIDEO` (API 33+) with legacy fallback; handle Android 14 partial access per §4;
    `POST_NOTIFICATIONS` (API 33+) requested at the first compression; `FOREGROUND_SERVICE` with
    the correct service type per API level (`mediaProcessing` on 35+, `dataSync` below). Save via
    MediaStore; delete via `createDeleteRequest`.
- Request on first launch of the browser; if denied, show a friendly screen with "Open settings".

## 10. Edge cases

- Huge libraries (5,000+ videos): pagination and scrolling stay smooth; size index builds incrementally.
- Long videos (> 5 min): elapsed time + ETA in-app; live % in the Android notification.
- HDR / Dolby Vision / HEVC sources → still produce playable SDR H.264 output; no crashes.
- Portrait and landscape both keep correct orientation.
- Cancel, or app killed mid-compression → temp files cleaned on next launch; offer retry.
- Low storage → estimate required space from §6 and fail early with a clear message.
- Delete-style flows (Replace, Delete, bulk delete): the OS dialog resolves the same way on
  confirm and cancel, so the app checks afterwards and reports plainly what actually happened —
  including partial results like "3 of 5".
- Video deleted/moved by another app while listed → handle stale entries gracefully on tap (refresh + toast).

## 11. Non-goals (v1)

No batch compression (batch _delete_ exists, see §4), no trimming/editing, no photos, no cloud
upload, no custom bitrate input (tiers only), no folder/album navigation, no filename search
(flat all-videos list only).

## 12. Acceptance criteria

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
