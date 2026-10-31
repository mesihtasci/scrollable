import Scrollable from '@mesihtasci/scrollable';
import type { ScrollableChangeDetail } from '@mesihtasci/scrollable';
import '@mesihtasci/scrollable/style.css';
const mode = new URLSearchParams(location.search).get('mode') || 'basic';
const host = document.querySelector<HTMLElement>('#examples')!;
function markup(name: string) {
  return (
    '<div class="mt-vs" id="' +
    name +
    '"><main class="mt-vs__container">' +
    ['Welcome', 'Explore', 'Continue']
      .map(
        (title, index) =>
          '<section class="mt-vs__content" data-section-id="' +
          name +
          '-' +
          index +
          '" data-navigation-title="' +
          title +
          '"><h2>' +
          title +
          '</h2><p>Use the wheel, swipe, or focus the scroller and press arrow keys. Tab reaches the controls and links.</p><a href="https://github.com/mesihtasci/scrollable">Read the documentation</a></section>',
      )
      .join('') +
    '</main><nav class="mt-vs__top-navigation" aria-label="Sections"><ul></ul></nav></div>'
  );
}
host.innerHTML =
  markup('primary') + (mode === 'embedded' ? markup('secondary') : '');
if (mode === 'embedded') host.classList.add('columns');
if (mode === 'long') {
  const page = host.querySelectorAll('section')[1];
  page.insertAdjacentHTML(
    'beforeend',
    '<div class="nested" tabindex="0"><h3>Independent overflow</h3>' +
      '<p>This inner area scrolls before the outer section changes.</p>'.repeat(
        15,
      ) +
      '</div>' +
      '<p>There is more to read. The scroller waits until you reach the boundary and begin a new gesture.</p>'.repeat(
        25,
      ),
  );
}
if (mode === 'mixed') {
  const last = host.querySelector<HTMLElement>('section:last-child')!;
  last.classList.add('mt-vs__container--auto-height');
  last.style.height = '280px';
}
let primary: Scrollable | undefined;
function mount() {
  primary = new Scrollable('#primary', {
    hash: mode === 'history' ? 'push' : false,
  });
}
mount();
if (mode === 'embedded') new Scrollable('#secondary');
document.querySelector('#next')!.addEventListener('click', () => {
  void primary?.next();
});
document.querySelector('#previous')!.addEventListener('click', () => {
  void primary?.previous();
});
document
  .querySelector('#refresh')!
  .addEventListener('click', () => primary?.refresh());
document.querySelector('#destroy')!.addEventListener('click', () => {
  if (primary) {
    primary.destroy();
    primary = undefined;
  } else mount();
});
host.addEventListener('scrollable:change', (event) => {
  const detail = (event as CustomEvent<ScrollableChangeDetail>).detail;
  document.querySelector('#status')!.textContent =
    'Section ' + (detail.toIndex + 1) + ' · ' + detail.source;
});
