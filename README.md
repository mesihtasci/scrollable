# Scrollable

A small, dependency-free vertical scroller for full-screen stories and independent embedded layouts. Includes TypeScript types, accessible section controls, native overflow inside long sections, and complete teardown.

**1.0.0-rc.1 is a release candidate.** Automated release gates and outstanding real-device/accessibility checks are documented in [verification](docs/verification.md).

## Install and start

```sh
npm install @mesihtasci/scrollable@next
```

```js
import Scrollable from '@mesihtasci/scrollable';
import '@mesihtasci/scrollable/style.css';

const scroller = new Scrollable('#story');
```

```html
<div id="story" class="mt-vs">
  <main class="mt-vs__container">
    <section
      class="mt-vs__content"
      data-section-id="intro"
      data-navigation-title="Introduction"
    >
      <h1>Your first section</h1>
      <p>Scroll, swipe, or focus the scroller and use the arrow keys.</p>
    </section>
    <section
      class="mt-vs__content"
      data-section-id="details"
      data-navigation-title="Details"
    >
      <h2>Your next section</h2>
      <p>
        Long content scrolls naturally before the next section becomes
        available.
      </p>
    </section>
  </main>
  <nav class="mt-vs__top-navigation" aria-label="Story sections">
    <ul></ul>
  </nav>
</div>
```

The root fills the viewport by default. Set its height for embedding:

```css
#story {
  height: 500px;
}
#story .mt-vs__content {
  padding: 5rem 2rem 2rem;
}
```

The stylesheet does not reset your document's margins, fonts, or heading styles. Section controls overlay the content; give your sections appropriate padding. The navigation host is optional. A `.mt-vs__side-navigation ul` host also works. Existing host content is restored on destruction.

Sections must be direct children of the track. Give each section a unique `data-section-id` for ID-based navigation and URLs; `data-navigation-title` is rendered as plain text. Without titles, controls use “Section N”. Use document-unique HTML IDs if assigning them yourself.

## Examples

Run `npm ci && npm run build && npm run dev`, then open `/examples/index.html` on the displayed URL.

The gallery includes minimal, long/nested-content, mixed-height, history/events, embedded/multiple-instance, and React/TypeScript examples. The [no-build example](examples/no-build/index.html) imports distribution files directly; serve it over HTTP after building. For CDN usage, pin both ESM and CSS URLs to the same package version, for example `https://cdn.jsdelivr.net/npm/@mesihtasci/scrollable@1.0.0-rc.1/dist/index.js` and its `dist/style.css` counterpart.

## Options

`new Scrollable(root, options?)` accepts an element or selector.

| Option     | Default | Behavior                                                    |
| ---------- | ------- | ----------------------------------------------------------- |
| `duration` | `750`   | Animation duration in milliseconds; finite and nonnegative. |
| `wheel`    | `true`  | Enable root-scoped wheel and trackpad input.                |
| `touch`    | `true`  | Enable single-touch vertical swipes.                        |
| `keyboard` | `true`  | Enable root-scoped Arrow, Page Up/Down, Home, and End keys. |
| `hash`     | `false` | Use `'replace'` or `'push'` for URL synchronization.        |

Reduced-motion preferences override animation with immediate movement. Importing the module is safe during server rendering; instantiate after the root mounts in a browser.

Missing roots/tracks, duplicate section IDs, and duplicate active instances on a root throw before modifying markup. Empty roots are supported and have index `-1`.

## Methods

| API                      | Result                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `goTo(indexOrSectionId)` | `Promise<boolean>`                                                                                                                   |
| `next()` / `previous()`  | `Promise<boolean>`                                                                                                                   |
| `currentIndex`           | Read-only settled section index; `-1` when empty.                                                                                    |
| `refresh()`              | Rediscover sections, rebuild controls, and remeasure.                                                                                |
| `destroy()`              | Remove owned listeners, timers, observers, and controls; restore authored DOM attributes/styles/navigation. Safe to call repeatedly. |

Navigation resolves `true` after completing. It resolves `false` for unchanged destinations, boundaries, prevented changes, or requests while another transition is active. Invalid numeric indexes/unknown IDs reject with `RangeError`; unsupported target types reject with `TypeError`.

```js
if (await scroller.goTo('details')) {
  console.log(scroller.currentIndex);
}
scroller.refresh(); // After adding, removing, or replacing sections.
scroller.destroy(); // Before removing or reusing the root.
```

Destroying during navigation resolves the pending promise `false` and suppresses completion events. Refresh preserves the current section by section ID, then element identity; removal clamps the index and removing all sections returns to `-1`. Refresh finishes an in-flight transition if content remains, or cancels it if the root becomes empty.

ResizeObserver remeasures root and section size changes automatically. Call `refresh()` after structural changes; DOM mutation discovery is intentionally explicit. Multiple nonnested roots operate independently.

## Events

Both events bubble from the instance root:

- `scrollable:beforechange`: cancelable, emitted before any navigation mutation.
- `scrollable:change`: noncancelable, emitted once after the settled index updates.

```ts
import type { ScrollableChangeDetail } from '@mesihtasci/scrollable';

const root = document.querySelector('#story')!;
root.addEventListener('scrollable:change', (event) => {
  const detail = (event as CustomEvent<ScrollableChangeDetail>).detail;
  console.log(
    detail.fromIndex,
    detail.toIndex,
    detail.direction,
    detail.source,
  );
});
root.addEventListener('scrollable:beforechange', (event) => {
  // Call event.preventDefault() here when your application must block a change.
});
```

The detail object is frozen. Direction is `'up' | 'down'`; source is `'api' | 'wheel' | 'touch' | 'keyboard' | 'navigation' | 'history'`. Input arriving during a transition cannot change its original details.

## Overflow, gestures, and accessibility

Wheel deltas are normalized across pixel, line, and page units. Small deltas accumulate to 40 normalized pixels. A burst advances at most one section and resets after more than 200 ms of inactivity. Swipes require 50 vertical pixels and reject horizontal or multi-touch gestures. Ctrl+wheel remains available for zoom.

Long sections and nested overflow areas scroll natively while space remains. Reaching a boundary during a native-scroll gesture does not immediately advance the section: begin a new gesture. Boundary calculations allow one pixel for rounding. New sections retain their own native scroll position.

Navigation uses real buttons, accessible labels, `aria-controls`, active-state semantics, and visible focus. Inactive sections are `inert` and hidden from accessibility navigation. If a transition hides the focused section, focus moves to the destination heading (or section fallback). Tab remains native. Editable controls retain their keyboard behavior.

Use descriptive headings and navigation labels, preserve visible focus, and test your own content with assistive technology. Content remains normal, readable document flow before initialization and after destruction. For continuous reading layouts, ordinary native scrolling may be a better fit than controlled section transitions.

## URL integration

Hash synchronization is opt-in to avoid interfering with application routers. Only one instance per document may own it.

- Initial recognized fragments select a section immediately.
- `'replace'` changes the fragment without adding history entries.
- `'push'` adds history entries; Back/Forward and external recognized hashes navigate.
- Unknown or malformed initial fragments safely select the first section; unknown external fragments leave selection unchanged.
- Unicode IDs are encoded/decoded.
- History-triggered changes do not create new history entries.

Choose section IDs for every URL-addressable section. Empty history fragments do not identify a section. Destroy releases URL ownership and leaves the current URL/history intact.

## React and TypeScript

Use a root ref and create the instance inside an effect. Return its teardown for React Strict Mode:

```tsx
import { useEffect, useRef } from 'react';
import Scrollable from '@mesihtasci/scrollable';
import '@mesihtasci/scrollable/style.css';

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const instance = new Scrollable(root.current!);
    return () => instance.destroy();
  }, []);
  return (
    <div ref={root} className="mt-vs">
      <main className="mt-vs__container">
        <section className="mt-vs__content">
          <h2>Introduction</h2>
        </section>
        <section className="mt-vs__content">
          <h2>Details</h2>
        </section>
      </main>
    </div>
  );
}
```

After React changes the section list, call `refresh()`. The core package has no React runtime dependency. See [the complete React example](examples/react/main.tsx).

## Styling and browser support

Scope overrides to your root. Use `.mt-vs__container--auto-height` on a section for intrinsic height, or set an explicit section height for mixed layouts. Avoid external transforms on the track, which the library owns. Transition timing can be customized with `transition-timing-function`.

The target is current Chrome, Edge, Firefox, Safari, iOS Safari, and Android Chrome, with modern ESM, ResizeObserver, and inert support. Automated tests run Chromium, Firefox, and WebKit; real-device and screen-reader release acceptance is tracked separately. Legacy browsers and nested Scrollable instances are outside the current support contract.

## Migrating from 0.0.15

- Replace `new Scrollable()` with `new Scrollable(root)`.
- Replace `setActivePage(index)` with `await goTo(index)`.
- Replace `currentPageIndex` with read-only `currentIndex`.
- Replace repeated `init()` with `refresh()`, or destroy/recreate when changing options.
- Replace document-level `mt-vt:transition-start/end` listeners with root-scoped `scrollable:beforechange/change`. Payload fields are now `fromIndex`, `toIndex`, `direction`, and `source`.
- Import `@mesihtasci/scrollable/style.css` explicitly; demo colors and document resets are no longer part of library CSS.
- Enable `hash` explicitly if needed. Internal mutable fields/helpers are no longer public.

## Troubleshooting and contributing

Missing styles or normal continuous flow? Import the exported stylesheet and verify the constructor succeeds. Unexpected heights? Set the root height and keep sections directly inside the track. Wheel seems to pause? Finish native overflow scrolling and begin a new gesture. SPA navigation? Destroy before unmounting and recreate on mount.

Use Node 24 for repository development. See [CONTRIBUTING](CONTRIBUTING.md) for all commands, tests, CI, and release setup; [CHANGELOG](CHANGELOG.md), [security reporting](SECURITY.md), and the [code of conduct](CODE_OF_CONDUCT.md) are also available.

MIT licensed. Bundle budgets are 10 KiB gzipped JavaScript and 3 KiB CSS, enforced against the packed distribution.
