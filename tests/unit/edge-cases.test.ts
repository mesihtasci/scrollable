import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Scrollable from '../../src/index.js';
let root: HTMLElement;
let instance: Scrollable;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  history.replaceState(null, '', '/');
  document.body.innerHTML =
    '<div class="mt-vs"><main class="mt-vs__container"><section class="mt-vs__content" data-section-id="a"><h2>A</h2></section><section class="mt-vs__content" data-section-id="b"><h2>B</h2></section></main></div>';
  root = document.querySelector('.mt-vs')!;
});
afterEach(() => {
  instance?.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it('does not mutate removed content when beforechange refreshes to empty', async () => {
  instance = new Scrollable(root, { duration: 0 });
  root.addEventListener(
    'scrollable:beforechange',
    () => {
      root.querySelector('main')!.replaceChildren();
      instance.refresh();
    },
    { once: true },
  );
  expect(await instance.next()).toBe(false);
  expect(instance.currentIndex).toBe(-1);
});
it('does not rewrite the URL when history interrupts an animation', async () => {
  instance = new Scrollable(root, { duration: 750, hash: 'push' });
  const pending = instance.next();
  history.replaceState(null, '', '/#a');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(await pending).toBe(true);
  expect(instance.currentIndex).toBe(0);
  expect(location.hash).toBe('#a');
});
it('beforechange reentrant navigation cannot start a second transition', async () => {
  instance = new Scrollable(root, { duration: 0 });
  let nested: Promise<boolean> | undefined;
  root.addEventListener(
    'scrollable:beforechange',
    () => {
      nested = instance.goTo(1);
    },
    { once: true },
  );
  expect(await instance.next()).toBe(true);
  expect(await nested).toBe(false);
});
it('refresh validates duplicate IDs without disturbing the live instance', async () => {
  instance = new Scrollable(root, { duration: 0 });
  const page = root.querySelectorAll('.mt-vs__content')[1];
  page.setAttribute('data-section-id', 'a');
  expect(() => instance.refresh()).toThrow();
  expect(instance.currentIndex).toBe(0);
  page.setAttribute('data-section-id', 'b');
  expect(await instance.next()).toBe(true);
});
it('focuses a section fallback when the destination has no heading', async () => {
  root.querySelectorAll('.mt-vs__content')[1].replaceChildren();
  instance = new Scrollable(root, { duration: 0 });
  (root.querySelector('h2') as HTMLElement).tabIndex = 0;
  (root.querySelector('h2') as HTMLElement).focus();
  await instance.next();
  expect(document.activeElement).toBe(
    root.querySelectorAll('.mt-vs__content')[1],
  );
});
it('teardown during destination focus prevents subsequent completion work', async () => {
  instance = new Scrollable(root, { duration: 0, hash: 'push' });
  const first = root.querySelector('h2')!;
  first.tabIndex = 0;
  first.focus();
  const changed = vi.fn();
  root.addEventListener('scrollable:change', changed);
  const heading = root.querySelectorAll('h2')[1];
  heading.addEventListener('focus', () => instance.destroy(), { once: true });
  expect(await instance.next()).toBe(false);
  expect(changed).not.toHaveBeenCalled();
  expect(location.hash).toBe('');
  expect(root.classList.contains('mt-vs--enabled')).toBe(false);
});
it('replace mode preserves existing application history state', async () => {
  history.replaceState({ application: 'state' }, '', '/');
  instance = new Scrollable(root, { duration: 0, hash: 'replace' });
  await instance.next();
  expect(history.state).toEqual({ application: 'state' });
});
it('explicit undefined options use their documented defaults', async () => {
  instance = new Scrollable(root, { duration: undefined, hash: undefined });
  const pending = instance.next();
  expect(instance.currentIndex).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await pending).toBe(true);
  expect(location.hash).toBe('');
});
