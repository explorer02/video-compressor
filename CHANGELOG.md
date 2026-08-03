# Changelog

Every feature added, changed, or removed gets a dated entry here, in the same change that
implements it — newest date first. § references point to sections of [product.md](product.md),
which always describes the current state of the product.

## 2026-08-03

- **Fix: the library header's total size never went down** (§4). The size index kept entries for
  deleted assets forever, so replacing a video with its compressed copy left the old size in the
  header's total (and added the new one on top). The index is now pruned against the full library
  id list every time that list is read — after every library change, the total reflects only
  videos that still exist.
- **Fix: batch compression crashed the app** (§7). Two crashes, both fixed:
  - The batch queue started and stopped the Android foreground service once per video; a stop
    landing between the next item's `startForegroundService()` and its delivery left the
    startForeground obligation unmet, and the system killed the app with
    `ForegroundServiceDidNotStartInTimeException` ~10 s after tapping Compress. A batch now holds
    **one** service session for its whole run and re-titles the notification per item; the native
    module additionally drops superseded stops (start-generation guard), reuses a still-live
    service instead of re-sending a start intent, and — when a stop races ahead of the start
    intent — the service satisfies the obligation first and then stops itself.
  - react-native-compressor's GPS trailer scan (`LocationExtractor`) only caught `Exception`, so
    an `OutOfMemoryError` while allocating its 1 MiB tail buffer crashed the app; patched
    (`patch-package`) to catch `Throwable` — location recovery is best-effort and must never sink
    a compression. The underlying heap pressure (a 24-byte allocation also failed once during
    library scrolling) still deserves a profiling pass.

## 2026-08-02

- Fix: release APK builds (`gradlew assembleRelease`) failed resource linking — the media-tools
  notification layouts use androidx.core's `TextAppearance.Compat.Notification` styles, which
  debug builds resolved transitively through the app but release library verification does not;
  the module now declares `androidx.core:core-ktx` itself.
- **Preview screen scrolls as one page** (§3.4): the four save/replace/discard buttons moved from
  a sticky footer into the scroll content — the footer had squeezed the player and details into a
  few cramped lines; now the user scrolls down to the actions.
- **Audio stays at full quality on every tier** (§5): Android already remuxes the source audio
  track untouched; iOS always re-encodes, so the library is patched (`patch-package`, applied on
  `npm install`) to encode AAC 256 kbps / 48 kHz stereo instead of its hardcoded 128 kbps /
  44.1 kHz — no more downsampling 48 kHz camera audio.
- **WhatsApp tier** (§3.2/§5, lifts the old "no low-quality tier" rule): a third quality option,
  listed first — the library's `auto` mode, which reproduces WhatsApp's envelope (720p,
  1.2–2.0 Mbps, capped at 95% of the source bitrate). For a video WhatsApp sends at ~43 MB, this
  tier produces the same, where the HD tier's deliberate ~2× bitrate made ~100 MB. The tier picker
  now reads smallest-first: WhatsApp → HD → Full HD; HD stays the default.
- **Smooth progress** (§3.3): the compressing screens show tenths of a percent ("62.4%") and the
  bar fills in 0.1% steps. Encoder progress now crosses the bridge on every native event (was
  every 2%) and the single-job screen updates on the event itself instead of a 500 ms sample. The
  Android notification still posts whole percents — the shade rate-limits `notify()` calls.
- **Library controls on two rows** (§4): the sort toolbar and the filter chips no longer share a
  row — five controls truncated every label ("File …", "Date…").
- **Notification fixes** (§7): the collapsed state uses a compact layout (filename, "62% ·
  55 s left", slim bar) sized to the collapsed shade instead of clipping the full layout mid-row;
  the expanded state shows one progress bar, not two — the template's bar was drawn beside the
  custom layout's and is no longer set.
- **Length filter** (§4): a second chip beside the size filter keeps videos at least / under
  5 / 10 / 15 / 20 / 30 s, 1 min, or 5 min — defaulting to "under", for finding the shorts. It
  composes with the size filter, persists across launches, needs no index (duration comes with
  every media-store row) and so works on every platform; unknown-duration videos are excluded
  from filtered views. The size filter's chip-and-sheet UI moved into a shared
  `ThresholdFilterControl`; both filters are now thin unit adapters over it.
- **Storybook** (dev tooling, no product change): `npm run storybook` renders components in a
  browser via react-native-web — no device or emulator build needed for UI work. Native-only
  modules (expo-video, expo-image, expo-media-library, media-tools) are swapped for browser
  stand-ins in `.storybook/mocks/`; stories live beside their components (`*.stories.tsx`), with a
  starter set covering `src/ui` plus ProgressBar, TierSelector, SortToolbar, and VideoRow.
- **Batch compression** (the §11 non-goal is lifted): multi-select gains **Compress (N)**. A setup
  screen picks one tier for the batch, per-video Copy/Replace (with all-copies / all-replace
  shortcuts), metadata choice for copies, and a totals card. The queue encodes one video at a time
  and saves each before the next, so a failure or cancel never loses a finished result; Replace
  originals are deleted via one system dialog after the last encode (deny keeps all originals).
  Progress shows a duration-weighted bar, ETA, bytes saved, and per-video rows; an interrupted
  batch is reported on next launch. The single-job pipeline moved to `core/compression/runJob.ts`
  and saving to `features/outcome/saveOutcome.ts`, shared by both flows.
- Preview comparison rebuilt: the stage matches the video's own aspect ratio (no more 16:9
  letterbox for portrait), an **Expand preview** fullscreen view keeps the Original/Compressed
  switch, and switching sources preserves playback position and play state.
- Tier estimates on the Selected screen use the source's real frame rate; manual-mode encodes
  scale bitrate up to 2× for 60 fps, so the old 30 fps assumption understated those outputs ~2×.
- Replace original asks once: the in-app alert is gone — the system delete dialog is the single
  confirmation (supersedes §3.4). The button itself states the stakes ("Replace original — free up
  190 MB").
- Size filter gained a direction: **At least / Under** a threshold (was ≥-only). Stored
  pre-direction preferences migrate as "at least"; unknown-size videos are excluded from filtered
  views instead of counting as 0 bytes.
- Renamed **CompressHD → ShortenAF** (launcher name, prompts, strings, docs). Bundle id, Expo
  slug, and internal identifiers stay so existing installs update in place.
- New app icon: white compress glyph on a blue→cyan gradient — full iOS/Android/favicon/splash set
  regenerated.
- Logging trimmed to a permanent diagnostic set now that the saved-dates fix is confirmed: each
  save logs one JS line (mode → asset id) and three native lines (`request` with the asked-for
  dates, MP4 atoms stamped — a warning when zero, the first thing to check if dates regress — and
  `final` with what the store holds). The per-step play-by-play (source read, row inserted, bytes
  written, publish/assert detail) is gone; failure warnings and the §6/§7 estimate-and-speed logs
  stay.
- Fix: the size-filter pill was pushed off the right edge of the screen — the sort toolbar shares a
  row with it but never shrank (RN's default `flexShrink: 0`), keeping its full width. The toolbar
  now flexes inside the row, and the row owns the bottom spacing so both controls sit centered.
- Fix: "Select all" only selected the rows scrolled in so far (60, then 120, …). It now selects the
  whole current view — every match of the active sort/size filter — via one unpaged library read;
  the button shows a spinner while that read runs, and "Deselect all" appears only when the
  selection truly covers the view's total. The selection now carries the videos themselves, so bulk
  delete works on videos whose rows were never loaded.
- §7 notification custom layout: filename, percent left / time remaining right, progress bar,
  elapsed below — with stock-template fallback for accessibility. JS→native now sends `elapsed` and
  `remaining` separately; styles follow the system notification theme.
- Fix: notification froze when backgrounded — updates ran on a JS interval (suspended) and were
  delivered via `startForegroundService` (refused from background on 12+). Now driven by encoder
  progress events and posted via `notify()`. Added end-to-end saved-date logging; dates re-asserted
  after the publish scan, which can recompute them.
- Selection UX rework: checkmark overlays the thumbnail (no row reflow), faster long-press, Android
  ripple, long-pressing a second row toggles it. Constant-height selection bar with Select all /
  Deselect all, "Delete (n)", Done; hardware back exits selection. Buttons gained an `sm` size.
- Fix: "keep original dates" could still save with the current time. MediaStore's date columns are
  not durable — publish triggers an asynchronous scan that re-derives `DATE_TAKEN` from the MP4's
  own `creation_time` (written as "now" by the encoder), landing after any column write. The save
  now patches the source's dates into the MP4's `mvhd`/`tkhd`/`mdhd` atoms in place (fixed offsets,
  no re-mux) before the bytes enter the store, so every scan — and any app reading the file
  directly — converges on the right dates. Column writes stay as cover until the first scan.

## 2026-08-01

- Tooling: ESLint + Prettier with `lint` / `format` scripts. No behavior change.
- Foundations: design tokens, UI primitives, key-value storage, §3 state machine, domain types;
  supporting deps and native config (granular video permission, `FOREGROUND_SERVICE_DATA_SYNC`).
- Scope: Android ships first. iOS capabilities sit behind the same typed interfaces and report
  unsupported until implemented.
- §4 video browser: permission gate, paginated list with thumbnails/duration/size/dates, persisted
  three-way sort, pull-to-refresh, partial-access banner, empty/error states. Sizes come from a
  lazy persistent index (no media-library API exposes size); Android-only for now.
- §5 tiers + §6 estimates: Full HD (manual, 4.5 Mbps) and HD (default), each with an up-front size
  estimate. Tiers that can't shrink the file are disabled; "Already optimized" when none can.
- §3.3 compression job: progress %, elapsed + ETA, Cancel, keep-awake. Workspace module owns temp
  files: clears leftovers at launch, records interrupted jobs, fails early on low disk. Output
  larger than source is discarded.
- §3.4 preview: inline player, original vs actual size, % saved. "Save as copy" (fresh metadata
  only for now) and "Discard", both returning to a refreshed library.
- `media-tools` local module: source video properties, batched asset sizes, capture-date
  write-back, Android foreground service. Enables "Keep original metadata" (§8) and
  real-frame-rate bitrate scaling. Location can't carry over on Android (columns removed in
  Android 10) — reported as skipped.
- Size sort enabled (§4): index whole library once ("Indexing sizes…"), then rank and page from
  memory; unreadable sizes sort last. Header shows total size when indexed.
- "Replace original" (§3.4): own warning, save with original metadata, OS delete dialog. The app
  verifies afterwards whether the delete really happened. Compression now runs under the
  foreground service with a progress notification (§7).
- Polish: log estimate vs actual size per compression; native module degrades to "no capabilities"
  instead of throwing on old builds.
- Fix: keep-original-metadata save could use a stale source's date when the preview changed
  without remounting.
- Fix (native): frame-rate fallback compile error; `mediaProcessing` service type limited to API
  35+ (`dataSync` below); progress updates re-run `startForeground` to avoid service timeout.
- Fix: hardware back during compression abandoned the encode. Back now equals the screen's own
  button — cancels while compressing; leaving mid-run stops the encoder and closes the job record.
- Fix: notification permission was declared but never requested, so Android 13+ never showed the
  §7 notification. First compression now asks.
- Keep-original-metadata now carries the modified date too, and every write is verified by
  read-back so the toast reflects what was actually stored. Location dropped from scope on
  Android; button reads "Keeps the original dates".
- Library management: long-press multi-select with select-all and one-pass bulk delete (honestly
  reported, e.g. "3 of 5"). Persistent size filter (≥ 1–500 MB) with "12 of 240 videos" header;
  shares the size index, disabled without a size reader. Batch management, not the batch
  compression §11 rules out.
- Selected screen shows created/modified times and folder from the media store. Preview gained an
  Original / Compressed switch on one full-width player. Shared label-value row component.
- Copies now save into the source's folder with capture + modified dates set in the insert itself
  (a media store may ignore those columns on later updates — the root cause of both bugs). Done
  via `media-tools`; other platforms keep the create-then-write-back path.
- Quality/player fixes: HD tier switched to `manual` mode (`auto` ignored §5's bitrate and capped
  720p at ~2 Mbps — output was soft); tagline now "Great for sharing". Tiers below source
  resolution are hidden. Fullscreen control restored. Speed logged against the §7 target. Encoder
  output identical to input is rejected (previously it could destroy the user's original).
- Browser: tapping a video opens a real player with system controls; top-bar Delete removes a
  video without compressing (verified like Replace); preview lists the original's dates, folder,
  filename, resolution, and GPS where available.
- Fix (first device run): stopping the notification failed — the native call returned
  `ComponentName`, which can't cross the bridge — so the service outlived every job. Date
  write-back now sets both columns in one update, accepts the provider's recomputed modified date,
  and reports precise refusal reasons.

## 2026-07-31

- Project initialized: Expo SDK 57 scaffold, §2 dependencies, native config. No features yet.
