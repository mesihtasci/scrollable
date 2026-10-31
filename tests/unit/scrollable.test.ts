import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Scrollable from '../../src/index.js';

const instances: Scrollable[] = [];
let root: HTMLElement;
let track: HTMLElement;
function create(options: ConstructorParameters<typeof Scrollable>[1] = {}) {
  const instance = new Scrollable(root, { duration: 0, ...options });
  instances.push(instance);
  return instance;
}
function wheel(
  deltaY: number,
  options: WheelEventInit = {},
  target: HTMLElement = root,
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
function transition(
  type = 'transitionend',
  propertyName = 'transform',
  target = track,
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  target.dispatchEvent(event);
}
function touch(type: string, x: number, y: number, count = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const points = Array.from({ length: count }, (_, identifier) => ({
    identifier,
    clientX: x,
    clientY: y,
  }));
  Object.assign(event, {
    touches: type === 'touchend' ? [] : points,
    changedTouches: points,
  });
  root.dispatchEvent(event);
}
function scrollable(element: HTMLElement, top: number) {
  element.style.overflowY = 'auto';
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  });
  element.scrollTop = top;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  history.replaceState(null, '', '/');
  document.body.innerHTML =
    '<div class="mt-vs" id="root" style="height:500px"><main class="mt-vs__container">' +
    ['one', 'two', 'three']
      .map(
        (id) =>
          '<section class="mt-vs__content" data-section-id="' +
          id +
          '" data-navigation-title="' +
          id +
          '"><h2>' +
          id +
          '</h2><a href="#link">Link</a></section>',
      )
      .join('') +
    '</main><nav class="mt-vs__top-navigation"><ul><li>Original</li></ul></nav><aside class="mt-vs__side-navigation"><ul></ul></aside></div>';
  root = document.querySelector('#root')!;
  track = root.querySelector('main')!;
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: 500,
  });
});
afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('public navigation contract', () => {
  it.each([-1, 3, 0.5, NaN, Infinity])(
    'rejects invalid index %s without side effects',
    async (target) => {
      const instance = create();
      const before = root.outerHTML;
      await expect(instance.goTo(target)).rejects.toBeInstanceOf(RangeError);
      expect(root.outerHTML).toBe(before);
      expect(instance.currentIndex).toBe(0);
      expect(location.hash).toBe('');
      expect(await instance.next()).toBe(true);
    },
  );
  it('rejects unknown IDs and unsupported target types', async () => {
    const instance = create();
    await expect(instance.goTo('missing')).rejects.toBeInstanceOf(RangeError);
    await expect(
      instance.goTo(null as unknown as number),
    ).rejects.toBeInstanceOf(TypeError);
  });
  it('navigates by ID, exposes settled state, and handles boundaries', async () => {
    const instance = create();
    expect(await instance.previous()).toBe(false);
    expect(await instance.goTo('three')).toBe(true);
    expect(instance.currentIndex).toBe(2);
    expect(await instance.next()).toBe(false);
    expect(await instance.goTo(2)).toBe(false);
    expect(await instance.previous()).toBe(true);
  });
  it('handles empty and single-section instances', async () => {
    track.replaceChildren();
    const instance = create();
    expect(instance.currentIndex).toBe(-1);
    expect(await instance.next()).toBe(false);
    expect(await instance.previous()).toBe(false);
    track.innerHTML =
      '<section class="mt-vs__content" data-section-id="new"></section>';
    instance.refresh();
    expect(instance.currentIndex).toBe(0);
    expect(await instance.next()).toBe(false);
    expect(await instance.previous()).toBe(false);
  });
  it('validates markup, duplicate IDs, ownership, and duration before mutation', () => {
    const before = root.outerHTML;
    expect(() => new Scrollable('#missing')).toThrow();
    expect(() => new Scrollable(document.createElement('div'))).toThrow();
    expect(() => create({ duration: -1 })).toThrow(RangeError);
    expect(root.outerHTML).toBe(before);
    track.children[1].setAttribute('data-section-id', 'one');
    const duplicate = root.outerHTML;
    expect(() => create()).toThrow();
    expect(root.outerHTML).toBe(duplicate);
    track.children[1].setAttribute('data-section-id', 'two');
    create();
    const enhanced = root.outerHTML;
    expect(() => create()).toThrow();
    expect(root.outerHTML).toBe(enhanced);
  });
  it('publishes immutable, cancelable-before and noncancelable-after event details', async () => {
    const instance = create();
    const before = vi.fn((event: Event) => {
      const custom = event as CustomEvent;
      expect(custom.cancelable).toBe(true);
      expect(Object.isFrozen(custom.detail)).toBe(true);
      expect(instance.currentIndex).toBe(0);
    });
    const after = vi.fn((event: Event) => {
      expect(event.cancelable).toBe(false);
      expect(instance.currentIndex).toBe(2);
    });
    root.addEventListener('scrollable:beforechange', before);
    document.addEventListener('scrollable:change', after, { once: true });
    await instance.goTo(2);
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect((after.mock.calls[0][0] as CustomEvent).detail).toEqual({
      fromIndex: 0,
      toIndex: 2,
      direction: 'down',
      source: 'api',
    });
  });
  it('cancels navigation before mutation or history updates', async () => {
    const instance = create({ hash: 'push' });
    root.addEventListener('scrollable:beforechange', (e) => e.preventDefault());
    const before = root.outerHTML;
    expect(await instance.next()).toBe(false);
    expect(root.outerHTML).toBe(before);
    expect(instance.currentIndex).toBe(0);
    expect(location.hash).toBe('');
  });
  it.each(['transitionend', 'transitioncancel'])(
    'completes once on %s and ignores unrelated events',
    async (type) => {
      const instance = create({ duration: 750 });
      const changed = vi.fn();
      root.addEventListener('scrollable:change', changed);
      const pending = instance.goTo(2);
      expect(instance.currentIndex).toBe(0);
      expect(await instance.next()).toBe(false);
      transition('transitionend', 'opacity');
      transition(
        'transitionend',
        'transform',
        track.children[0] as HTMLElement,
      );
      expect(instance.currentIndex).toBe(0);
      wheel(-100);
      transition(type);
      expect(await pending).toBe(true);
      transition();
      await vi.runAllTimersAsync();
      expect(changed).toHaveBeenCalledOnce();
      expect((changed.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
        fromIndex: 0,
        toIndex: 2,
        direction: 'down',
      });
    },
  );
  it('falls back when CSS emits no transition event', async () => {
    const instance = create({ duration: 750 });
    const pending = instance.next();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe(true);
    const next = instance.next();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await next).toBe(true);
  });
  it('honors reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const instance = create({ duration: 750 });
    expect(await instance.next()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('lifecycle and accessibility', () => {
  it('restores original DOM and leaves no active listeners after 20 lifecycles', async () => {
    const before = root.outerHTML;
    for (let i = 0; i < 20; i++) {
      const instance = create();
      await instance.next();
      instance.destroy();
      instance.destroy();
      expect(root.outerHTML).toBe(before);
    }
    const instance = create();
    const changed = vi.fn();
    root.addEventListener('scrollable:change', changed);
    wheel(80);
    expect(instance.currentIndex).toBe(1);
    expect(changed).toHaveBeenCalledOnce();
    expect(root.querySelectorAll('.mt-vs__top-navigation button')).toHaveLength(
      3,
    );
  });
  it('destroy cancels pending work and restores authored attributes', async () => {
    const page = track.children[0] as HTMLElement;
    page.setAttribute('aria-hidden', 'false');
    page.setAttribute('tabindex', '2');
    const before = root.outerHTML;
    const instance = create({ duration: 750 });
    const changed = vi.fn();
    root.addEventListener('scrollable:change', changed);
    const pending = instance.next();
    instance.destroy();
    expect(await pending).toBe(false);
    wheel(100);
    transition();
    await vi.runAllTimersAsync();
    expect(changed).not.toHaveBeenCalled();
    expect(root.outerHTML).toBe(before);
  });
  it('renders labels as text and navigation as named buttons', () => {
    track.children[0].setAttribute('data-navigation-title', '<em>Example</em>');
    create();
    expect(root.querySelector('nav em')).toBeNull();
    const button = root.querySelector('nav button')!;
    expect(button.textContent).toBe('<em>Example</em>');
    expect(button.getAttribute('aria-controls')).toBe(track.children[0].id);
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(track.children[1].hasAttribute('inert')).toBe(true);
  });
  it('refresh preserves IDs, handles removals, and returns to the empty state', async () => {
    const instance = create();
    await instance.goTo('two');
    track.children[1].outerHTML =
      '<section class="mt-vs__content" data-section-id="two"></section>';
    instance.refresh();
    expect(instance.currentIndex).toBe(1);
    track.children[1].remove();
    instance.refresh();
    expect(instance.currentIndex).toBe(1);
    track.replaceChildren();
    instance.refresh();
    expect(instance.currentIndex).toBe(-1);
  });
});

describe('input ownership and gestures', () => {
  it('accepts the first wheel immediately and accumulates small deltas', () => {
    const instance = create();
    for (let i = 0; i < 3; i++) wheel(10);
    expect(instance.currentIndex).toBe(0);
    wheel(10);
    expect(instance.currentIndex).toBe(1);
    wheel(100);
    vi.advanceTimersByTime(150);
    wheel(100);
    expect(instance.currentIndex).toBe(1);
    vi.advanceTimersByTime(201);
    wheel(40);
    expect(instance.currentIndex).toBe(2);
  });
  it.each([1, 2])('normalizes deltaMode %i', (deltaMode) => {
    const instance = create();
    wheel(deltaMode === 1 ? 3 : 1, { deltaMode });
    expect(instance.currentIndex).toBe(1);
  });
  it('uses computed line-height for line deltas', () => {
    root.style.lineHeight = '24px';
    const instance = create();
    wheel(2, { deltaMode: 1 });
    expect(instance.currentIndex).toBe(1);
  });
  it('ignores horizontal input, zero delta, zoom, and outside input', () => {
    const instance = create();
    expect(wheel(50, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(20, { deltaX: 60 }).defaultPrevented).toBe(false);
    wheel(0);
    wheel(100, {}, document.body);
    expect(instance.currentIndex).toBe(0);
  });
  it('preserves long and nested native scrolling for the whole gesture', () => {
    const instance = create();
    const section = track.children[0] as HTMLElement;
    scrollable(section, 450);
    expect(wheel(80, {}, section).defaultPrevented).toBe(false);
    expect(instance.currentIndex).toBe(0);
    section.scrollTop = 500;
    wheel(80, {}, section);
    expect(instance.currentIndex).toBe(0);
    vi.advanceTimersByTime(201);
    wheel(80, {}, section);
    expect(instance.currentIndex).toBe(1);
    const nested = document.createElement('div');
    track.children[1].append(nested);
    scrollable(nested, 50);
    vi.advanceTimersByTime(201);
    wheel(80, {}, nested);
    expect(instance.currentIndex).toBe(1);
  });
  it('touch requires a vertical single-finger boundary gesture', () => {
    const instance = create();
    touch('touchstart', 0, 100);
    touch('touchend', 0, 60);
    expect(instance.currentIndex).toBe(0);
    touch('touchstart', 0, 100);
    touch('touchend', 100, 20);
    expect(instance.currentIndex).toBe(0);
    touch('touchstart', 0, 100, 2);
    touch('touchend', 0, 0);
    expect(instance.currentIndex).toBe(0);
    touch('touchstart', 0, 100);
    touch('touchcancel', 0, 0);
    touch('touchend', 0, 0);
    expect(instance.currentIndex).toBe(0);
    touch('touchstart', 0, 100);
    touch('touchmove', 0, 20);
    touch('touchend', 0, 20);
    expect(instance.currentIndex).toBe(1);
  });
  it.each(['wheel', 'touch', 'keyboard'] as const)(
    'disables %s without disabling API navigation',
    async (input) => {
      const instance = create({ [input]: false });
      if (input === 'wheel') wheel(100);
      if (input === 'touch') {
        touch('touchstart', 0, 100);
        touch('touchend', 0, 0);
      }
      if (input === 'keyboard')
        root.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
      expect(instance.currentIndex).toBe(0);
      expect(await instance.next()).toBe(true);
    },
  );
  it.each([
    ['ArrowDown', 1],
    ['PageDown', 1],
    ['End', 2],
  ])('handles root-focused %s', (key, index) => {
    const instance = create();
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    expect(instance.currentIndex).toBe(index);
  });
  it('preserves editable keyboard behavior', () => {
    const instance = create();
    const input = document.createElement('input');
    track.children[0].append(input);
    const event = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(instance.currentIndex).toBe(0);
  });
});

describe('URL synchronization', () => {
  it('leaves hashes unchanged by default', async () => {
    history.replaceState(null, '', '/#two');
    const instance = create();
    expect(instance.currentIndex).toBe(0);
    await instance.next();
    expect(location.hash).toBe('#two');
  });
  it.each(['#missing', '#%'])('handles initial fragment %s', (fragment) => {
    history.replaceState(null, '', '/' + fragment);
    expect(create({ hash: 'replace' }).currentIndex).toBe(0);
  });
  it('selects initial hashes and replaces history for accepted navigation', async () => {
    history.replaceState(null, '', '/#two');
    const instance = create({ hash: 'replace', duration: 750 });
    expect(instance.currentIndex).toBe(1);
    const replace = vi.spyOn(history, 'replaceState');
    const pending = instance.next();
    transition();
    expect(await pending).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
    expect(location.hash).toBe('#three');
  });
  it('round-trips Unicode and releases exclusive URL ownership', async () => {
    track.children[1].setAttribute('data-section-id', '你好 café');
    const instance = create({ hash: 'push' });
    await instance.next();
    expect(decodeURIComponent(location.hash.slice(1))).toBe('你好 café');
    const second = root.cloneNode(true) as HTMLElement;
    second.id = 'second';
    document.body.append(second);
    expect(() => new Scrollable(second, { hash: 'push' })).toThrow();
    instance.destroy();
    const replacement = new Scrollable(second, { hash: 'push', duration: 0 });
    instances.push(replacement);
    expect(replacement.currentIndex).toBe(1);
  });
});
