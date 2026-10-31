# Release verification

## Original implementation baseline

The first executable run of the new contract suite against 0.0.15 recorded **38 failed, 0 passed**. The baseline included invalid targets, empty state, event snapshots/cancellation, transition completion, teardown/restoration, labels, overflow/gesture input, keyboard input, and hash ownership.

Many tests initially failed because the new public methods did not exist. The earlier review also reproduced actual legacy defects in Chromium: mixed-height offset 600 instead of 800, permanent locking with transitions disabled, duplicated navigation on reinitialization, labels interpreted as HTML, and an empty-container exception. Source-level probes reproduced invalid-index crashes, incorrect transition origins/directions, a malformed-fragment exception, early overflow advancement, and first/line-wheel filtering.

## Automated verification

Verified on 2026-10-31 with Node 24.19.0 and npm 11.17.0 on Windows.

| Gate                              | Result                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run check`                   | Passed: build, format, lint, type checks, unit/browser tests, packed consumers, examples                 |
| Unit regressions and contracts    | 46 passed, 0 failed, 0 skipped                                                                           |
| Browser suite                     | 18 scenarios × 3 engines = 54 passed, 0 failed, 0 skipped                                                |
| Chromium                          | 156.0.8078.4                                                                                             |
| Firefox                           | 157.0                                                                                                    |
| WebKit                            | 27.2                                                                                                     |
| Clean-source prepack              | Built automatically and produced the expected 9 package files                                            |
| Consumer verification             | SSR-safe ESM import, exported CSS, strict NodeNext/Bundler declarations, vanilla and React builds passed |
| Distribution JavaScript           | 3,877 bytes gzip; budget 10,240 bytes                                                                    |
| Distribution CSS                  | 655 bytes gzip; budget 3,072 bytes                                                                       |
| Full development dependency audit | 0 reported advisories                                                                                    |
| Runtime dependency audit          | 0 reported advisories; no runtime dependencies                                                           |
| Gallery                           | Static build passed; desktop gallery and embedded example visually reviewed                              |
| Git diff and metadata             | Whitespace check passed; package/lockfile versions match 1.0.0-rc.1                                      |

Browser checks cover measured offsets, resizing/content growth, independent instances, focus/Tab behavior, native wheel overflow, keyboard input, history, reduced motion, transition fallback, CSS isolation, touch gesture boundaries, and React Strict Mode cleanup. Touch sequences are synthetic events against actual browser geometry; physical touch and momentum remain manual checks below.

The browser fixture explicitly makes its links tabbable so the inactive-section/focus assertions do not depend on Safari's Full Keyboard Access setting. Tests run against a fresh Vite server with HMR disabled to avoid developer-session reloads. No failing assertions were disabled or weakened.

Oxlint supplies the lint gate, replacing the advisory-affected ESLint dependency tree. TypeScript 5.9 is pinned to a supported minor range for the declaration/compiler checks.

CI, Pages deployment, and trusted npm publishing workflows are prepared but have not run on GitHub. npm trusted-publisher configuration and the GitHub Pages source must be enabled by the maintainer before their first deployment. No package was published during this implementation.

## Manual checks still required before stable 1.0

| Environment                             | Required checks                                            | Status  |
| --------------------------------------- | ---------------------------------------------------------- | ------- |
| Desktop Safari                          | Wheel, keyboard, focus, history, reduced motion            | Not run |
| iOS Safari                              | Real touch, browser chrome resizing, orientation, overflow | Not run |
| Android Chrome                          | Real touch, orientation, overflow, zoom                    | Not run |
| Chrome and Edge with physical trackpads | Momentum, direction changes, boundaries                    | Not run |
| VoiceOver                               | Reading order, controls, focus after navigation            | Not run |
| NVDA                                    | Reading order, controls, focus after navigation            | Not run |

This is a release candidate, not a claim that manual release acceptance is complete.
