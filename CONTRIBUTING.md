# Contributing

Use Node 24 (see .nvmrc) and npm. Run:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run build
npm run dev
```

Open /examples/index.html on the displayed local URL. Run `npm run format` before committing and `npm run check` before opening a PR.

## Tests

- `npm run test:unit`: Vitest/jsdom behavioral contracts and controlled transition/gesture timing.
- `npm run test:e2e`: build, then Chromium/Firefox/WebKit layout, native input, accessibility, URL history, and React lifecycle tests.
- `npm run test:package`: copy a clean source fixture, install locked tooling, pack via prepack, and install the actual tarball in a separate consumer. Check exports, SSR-safe ESM imports, strict NodeNext/Bundler declarations, vanilla/React builds, and gzip budgets. It requires npm registry access.
- `npm run typecheck`, `npm run lint`, and `npm run format:check`: static gates.
- `npm run build:examples`: build the distribution and static gallery into site/.

Tests should exercise public behavior. Use real browsers for geometry, native scrolling, and focus; use fake timers for timing contracts. Do not disable tests to accommodate regressions. Add an isolated regression before fixing a bug.

## Release checklist

1. Complete `npm run check` and `npm audit` from a clean checkout.
2. Test current Chrome, Edge, Firefox, desktop Safari, iOS Safari, and Android Chrome with real mouse, trackpad, and touch input.
3. Verify keyboard order, zoom, reduced motion, long/nested content, history, and focus with VoiceOver and NVDA.
4. Record exact versions, devices, results, and unresolved limitations in docs/verification.md. Playwright WebKit is not a substitute for device Safari tests.
5. Update the changelog and matching package/lockfile versions. Publish an RC before a stable release.
6. Configure npm trusted publishing for this repository and `release.yml`; enable GitHub Actions as the Pages source for the demo gallery.
7. Push a matching version tag (for example v1.0.0-rc.1). The workflow verifies the tag, runs checks, and publishes prereleases to npm's next tag with provenance.

No credentials belong in the repository. The workflows are prepared; account-level npm/Pages setup is a maintainer action. Do not tag stable 1.0 while manual checks remain incomplete.

## Design boundaries

The runtime stays dependency-free and vertical. Native scroll snapping, horizontal/looping modes, automatic DOM mutation discovery, framework wrappers, and extra framework examples are later enhancements.
