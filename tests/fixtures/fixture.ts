import Scrollable from '@mesihtasci/scrollable';
import '@mesihtasci/scrollable/style.css';
import type {
  ScrollableOptions,
  ScrollableChangeDetail,
} from '@mesihtasci/scrollable';
declare global {
  interface Window {
    Scrollable: typeof Scrollable;
    scroller: Scrollable;
    second: Scrollable;
    changes: ScrollableChangeDetail[];
    setup: (
      options?: ScrollableOptions,
      heights?: number[],
      initialize?: boolean,
    ) => void;
  }
}
window.Scrollable = Scrollable;
// Explicit link tab stops make the fixture independent of Safari's Full Keyboard Access preference.
window.setup = (
  options = { duration: 0 },
  heights = [600, 600, 600],
  initialize = true,
) => {
  window.scroller?.destroy();
  document.querySelector('#root')?.remove();
  const root = document.createElement('div');
  root.id = 'root';
  root.className = 'mt-vs';
  root.style.height = '600px';
  root.innerHTML =
    '<main class="mt-vs__container">' +
    heights
      .map(
        (height, index) =>
          '<section class="mt-vs__content" style="height:' +
          height +
          'px;background:#ddeeff" data-section-id="section-' +
          index +
          '" data-navigation-title="Section ' +
          index +
          '"><h2>Heading ' +
          index +
          '</h2><a href="#example" tabindex="0">Link ' +
          index +
          '</a><input aria-label="Input ' +
          index +
          '"></section>',
      )
      .join('') +
    '</main><nav class="mt-vs__top-navigation" aria-label="Sections"><ul></ul></nav>';
  document.body.append(root);
  window.changes = [];
  root.addEventListener('scrollable:change', (event) =>
    window.changes.push((event as CustomEvent<ScrollableChangeDetail>).detail),
  );
  if (initialize) window.scroller = new Scrollable(root, options);
};
