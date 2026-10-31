import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from '../fixtures/fixture.js';
async function open(page: Page) {
  await page.goto('/tests/fixtures/index.html');
  await page.waitForFunction(() => !!window.setup);
}
async function aligned(page: Page, index: number) {
  await expect
    .poll(() =>
      page.evaluate((i) => {
        const root = document.querySelector('#root')!;
        return Math.abs(
          root.querySelectorAll('.mt-vs__content')[i].getBoundingClientRect()
            .top - root.getBoundingClientRect().top,
        );
      }, index),
    )
    .toBeLessThanOrEqual(1);
}
test.beforeEach(async ({ page }) => open(page));

test('mixed heights align at 800 and 1400 pixels in an embedded root', async ({
  page,
}) => {
  await page.evaluate(() => window.setup({ duration: 0 }, [800, 600, 200]));
  await page.evaluate(() => window.scroller.goTo(1));
  await aligned(page, 1);
  await expect(page.locator('.mt-vs__container')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, -800)',
  );
  await page.evaluate(() => window.scroller.goTo(2));
  await aligned(page, 2);
  await expect(page.locator('.mt-vs__container')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, -1400)',
  );
});

test('resizes root, viewport, and late content without extra change events', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup({ duration: 0 });
    for (const section of document.querySelectorAll<HTMLElement>(
      '.mt-vs__content',
    ))
      section.style.removeProperty('height');
  });
  await page.evaluate(() => window.scroller.next());
  await aligned(page, 1);
  await page
    .locator('#root')
    .evaluate((root) => ((root as HTMLElement).style.height = '420px'));
  await aligned(page, 1);
  await expect(page.locator('.mt-vs__content').nth(0)).toHaveCSS(
    'height',
    '420px',
  );
  await page.setViewportSize({ width: 800, height: 900 });
  await aligned(page, 1);
  await page.evaluate(() => {
    const first = document.querySelector<HTMLElement>('.mt-vs__content')!;
    first.style.height = '900px';
  });
  await aligned(page, 1);
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
});

test('auto-height content growth realigns the active page', async ({
  page,
}) => {
  await page.evaluate(async () => {
    window.setup({ duration: 0 });
    const first = document.querySelector<HTMLElement>('.mt-vs__content')!;
    first.classList.add('mt-vs__container--auto-height');
    first.style.height = 'auto';
    window.scroller.refresh();
    await window.scroller.next();
    const content = document.createElement('div');
    content.style.height = '1000px';
    first.append(content);
  });
  await aligned(page, 1);
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
});

test('instances have independent controls and events', async ({ page }) => {
  await page.evaluate(() => {
    window.setup({ duration: 0 });
    const second = document
      .querySelector('#root')!
      .cloneNode(true) as HTMLElement;
    second.id = 'second';
    // Clone original markup rather than instance-owned accessibility state.
    second.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    document.body.append(second);
    window.second = new window.Scrollable(second, { duration: 0 });
  });
  await page.locator('#root nav button').nth(2).click();
  expect(
    await page.evaluate(() => [
      window.scroller.currentIndex,
      window.second.currentIndex,
    ]),
  ).toEqual([2, 0]);
  await page.locator('#second nav button').nth(1).click();
  expect(
    await page.evaluate(() => [
      window.scroller.currentIndex,
      window.second.currentIndex,
    ]),
  ).toEqual([2, 1]);
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
});

test('buttons are named, focused visibly, and identify active sections', async ({
  page,
}) => {
  await page.evaluate(() => window.setup({ duration: 0 }));
  const button = page.getByRole('button', { name: 'Section 1', exact: true });
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-current', 'true');
  const target = await button.getAttribute('aria-controls');
  expect(
    await page.locator('[id="' + target + '"]').getAttribute('aria-hidden'),
  ).toBe('false');
});

test('inactive links are not tabbable and hidden focus moves to destination heading', async ({
  page,
}) => {
  await page.evaluate(() => window.setup({ duration: 0 }));
  await page.getByRole('link', { name: 'Link 0', exact: true }).focus();
  await page.evaluate(() => window.scroller.next());
  await expect(page.getByRole('heading', { name: 'Heading 1' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Link 1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('textbox', { name: 'Input 1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('nav button').first()).toBeFocused();
});

test('root keyboard navigation preserves editable controls', async ({
  page,
}) => {
  await page.evaluate(() => window.setup({ duration: 0 }));
  await page.locator('#root').focus();
  await page.keyboard.press('End');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(2);
  await page.keyboard.press('Home');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
  await page.keyboard.press('PageDown');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(1);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
  await page
    .getByRole('textbox', { name: 'Input 0', exact: true })
    .fill('editable');
  await page.keyboard.press('End');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
});

test('native wheel scroll reaches content boundary before section navigation', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup({ duration: 0 });
    const section = document.querySelector('.mt-vs__content')!;
    const content = document.createElement('div');
    content.style.height = '1400px';
    section.append(content);
  });
  const section = page.locator('.mt-vs__content').first();
  await section.hover({ position: { x: 200, y: 300 } });
  await page.mouse.wheel(0, 180);
  await expect
    .poll(() => section.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
});

test('nested native overflow and editable keyboard scrolling stay local', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup({ duration: 0 });
    const nested = document.createElement('div');
    nested.id = 'nested';
    nested.tabIndex = 0;
    nested.style.cssText = 'height:150px;overflow:auto;margin-top:100px';
    nested.innerHTML = '<div style="height:1000px">Long content</div>';
    document.querySelector('.mt-vs__content')!.append(nested);
  });
  await page.locator('#nested').hover();
  await page.mouse.wheel(0, 100);
  await expect
    .poll(() => page.locator('#nested').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.locator('#nested').focus();
  await page.keyboard.press('PageDown');
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
});

test('reduced motion and zero CSS transition duration cannot lock navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.setup({ duration: 750 }));
  expect(await page.evaluate(() => window.scroller.next())).toBe(true);
  expect(await page.evaluate(() => window.scroller.next())).toBe(true);
  await aligned(page, 2);
});

test('authored CSS disabling transitions uses a bounded fallback', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup({ duration: 30 });
    const style = document.createElement('style');
    style.textContent = '.mt-vs__container {transition:none!important}';
    document.head.append(style);
  });
  expect(await page.evaluate(() => window.scroller.next())).toBe(true);
  expect(await page.evaluate(() => window.scroller.next())).toBe(true);
});

test('content remains readable before enhancement and after destroy', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setup({ duration: 0 }, [600, 600, 600], false),
  );
  expect(
    await page.locator('body').evaluate((body) => body.scrollHeight),
  ).toBeGreaterThan(1800);
  await page.evaluate(() => {
    window.scroller = new window.Scrollable('#root', { duration: 0 });
    window.scroller.destroy();
  });
  await expect(page.locator('.mt-vs--enabled')).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  expect(
    await page.locator('body').evaluate((body) => body.scrollHeight),
  ).toBeGreaterThan(1800);
});

test('push history supports back, forward and external hashes without loops', async ({
  page,
}) => {
  await page.evaluate(() => window.setup({ duration: 0, hash: 'push' }));
  await page.evaluate(() => window.scroller.goTo(1));
  await page.evaluate(() => window.scroller.goTo(2));
  await page.goBack();
  await expect
    .poll(() => page.evaluate(() => window.scroller.currentIndex))
    .toBe(1);
  await page.goForward();
  await expect
    .poll(() => page.evaluate(() => window.scroller.currentIndex))
    .toBe(2);
  const count = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    location.hash = 'section-0';
  });
  await expect
    .poll(() => page.evaluate(() => window.scroller.currentIndex))
    .toBe(0);
  expect(await page.evaluate(() => history.length)).toBe(count + 1);
  await page.evaluate(() => {
    location.hash = 'unknown';
  });
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
});

test('replace mode does not add history entries', async ({ page }) => {
  await page.evaluate(() => window.setup({ duration: 0, hash: 'replace' }));
  const count = await page.evaluate(() => history.length);
  await page.evaluate(() => window.scroller.next());
  await expect(page).toHaveURL(/#section-1$/);
  expect(await page.evaluate(() => history.length)).toBe(count);
});

test('refresh preserves element identity without section IDs', async ({
  page,
}) => {
  await page.evaluate(async () => {
    window.setup({ duration: 0 });
    document
      .querySelectorAll('.mt-vs__content')
      .forEach((el) => el.removeAttribute('data-section-id'));
    await window.scroller.goTo(1);
    const track = document.querySelector('.mt-vs__container')!;
    const first = track.children[0];
    track.append(first);
    window.scroller.refresh();
  });
  expect(await page.evaluate(() => window.scroller.currentIndex)).toBe(0);
  await aligned(page, 0);
});

test('React Strict Mode can unmount and remount without duplicate navigation', async ({
  page,
}) => {
  await page.goto('/examples/react/index.html');
  await expect(page.locator('.mt-vs nav button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Toggle scroller' }).click();
  await expect(page.locator('.mt-vs')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle scroller' }).click();
  await expect(page.locator('.mt-vs nav button')).toHaveCount(3);
  await page.getByRole('button', { name: 'React section 2' }).click();
  await expect(page.getByRole('status')).toHaveText('Section 2');
});

test('component styles leave unrelated content navigation untouched', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup({ duration: 0 });
    const navigation = document.createElement('nav');
    navigation.id = 'content-navigation';
    navigation.innerHTML =
      '<ul><li>Article navigation</li></ul><button aria-current="true">Article action</button>';
    document.querySelector('.mt-vs__content')!.append(navigation);
  });
  await expect(page.locator('#content-navigation ul')).toHaveCSS(
    'display',
    'block',
  );
  await expect(page.locator('#content-navigation ul')).toHaveCSS(
    'list-style-type',
    'disc',
  );
  await expect(page.locator('#content-navigation button')).toHaveCSS(
    'text-decoration-line',
    'none',
  );
});

test('touch gestures use real overflow boundaries and do not advance on a scrolling gesture', async ({
  page,
}) => {
  const indexes = await page.evaluate(() => {
    window.setup({ duration: 0 });
    const root = document.querySelector('#root')!;
    function dispatch(type: string, y: number) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { identifier: 0, clientX: 100, clientY: y };
      Object.assign(event, {
        touches: type === 'touchend' ? [] : [point],
        changedTouches: [point],
      });
      root
        .querySelectorAll('.mt-vs__content')
        [window.scroller.currentIndex].dispatchEvent(event);
    }
    dispatch('touchstart', 200);
    dispatch('touchmove', 100);
    dispatch('touchend', 100);
    const first = window.scroller.currentIndex;
    const section = root.querySelectorAll('.mt-vs__content')[1];
    const content = document.createElement('div');
    content.style.height = '2000px';
    section.append(content);
    dispatch('touchstart', 200);
    section.scrollTop = section.scrollHeight;
    dispatch('touchend', 100);
    const second = window.scroller.currentIndex;
    dispatch('touchstart', 200);
    dispatch('touchend', 100);
    return [first, second, window.scroller.currentIndex];
  });
  expect(indexes).toEqual([1, 1, 2]);
});
