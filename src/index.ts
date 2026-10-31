export interface ScrollableOptions {
  duration?: number;
  wheel?: boolean;
  touch?: boolean;
  keyboard?: boolean;
  hash?: false | 'replace' | 'push';
}
export interface ScrollableChangeDetail {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly direction: 'up' | 'down';
  readonly source:
    'api' | 'wheel' | 'touch' | 'keyboard' | 'navigation' | 'history';
}
type Source = ScrollableChangeDetail['source'];
type Pending = {
  index: number;
  detail: ScrollableChangeDetail;
  resolve: (value: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};
const owners = new WeakMap<HTMLElement, Scrollable>();
const urlOwners = new WeakMap<Document, Scrollable>();
let nextId = 0;

/** A root-scoped vertical scroller. Import style.css separately. */
export default class Scrollable {
  private readonly root: HTMLElement;
  private readonly track: HTMLElement;
  private readonly options: Required<ScrollableOptions>;
  private readonly doc: Document;
  private readonly win: Window & typeof globalThis;
  private readonly snapshots = new Map<
    HTMLElement,
    Map<string, string | null>
  >();
  private readonly hosts = new Map<HTMLElement, Node[]>();
  private readonly cleanups: (() => void)[] = [];
  private readonly buttons: { element: HTMLButtonElement; index: number }[] =
    [];
  private pages: HTMLElement[] = [];
  private observer?: ResizeObserver;
  private media?: MediaQueryList;
  private index = -1;
  private destroyed = false;
  private pending?: Pending;
  private requesting = false;
  private wheelLast = -Infinity;
  private wheelSum = 0;
  private wheelUsed = false;
  private touch?: {
    id: number;
    x: number;
    y: number;
    up: boolean;
    down: boolean;
    target: HTMLElement;
  };
  private height = -1;
  private offsets: number[] = [];

  constructor(root: HTMLElement | string, options: ScrollableOptions = {}) {
    const element =
      typeof root === 'string'
        ? document.querySelector<HTMLElement>(root)
        : root;
    if (!element || element.nodeType !== 1)
      throw new TypeError('Scrollable requires an existing root element.');
    const track = element.querySelector<HTMLElement>('.mt-vs__container');
    if (!track)
      throw new TypeError(
        'Scrollable requires a .mt-vs__container inside its root.',
      );
    if (owners.has(element))
      throw new Error('This root already has a Scrollable instance.');
    const {
      duration = 750,
      wheel = true,
      touch = true,
      keyboard = true,
      hash = false,
    } = options;
    this.options = { duration, wheel, touch, keyboard, hash };
    if (!Number.isFinite(this.options.duration) || this.options.duration < 0)
      throw new RangeError('duration must be finite and nonnegative.');
    if (![false, 'replace', 'push'].includes(this.options.hash))
      throw new TypeError('Invalid hash mode.');
    this.root = element;
    this.track = track;
    this.doc = element.ownerDocument;
    this.win = this.doc.defaultView!;
    this.pages = this.collect();
    if (this.options.hash && urlOwners.has(this.doc))
      throw new Error('Only one instance may synchronize the URL.');
    owners.set(element, this);
    if (this.options.hash) urlOwners.set(this.doc, this);
    this.save(element, 'class', 'style', 'tabindex');
    this.save(track, 'style');
    element.classList.add('mt-vs');
    if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
    this.media = this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.index = this.pages.length ? Math.max(0, this.hashIndex()) : -1;
    this.rebuild();
    this.measure();
    this.align();
    this.listen(track, 'transitionend', this.onTransition);
    this.listen(track, 'transitioncancel', this.onTransition);
    if (this.options.wheel)
      this.listen(element, 'wheel', this.onWheel, { passive: false });
    if (this.options.keyboard) this.listen(element, 'keydown', this.onKey);
    if (this.options.touch) {
      this.listen(element, 'touchstart', this.onTouchStart, { passive: true });
      this.listen(element, 'touchmove', this.onTouchMove, { passive: false });
      this.listen(element, 'touchend', this.onTouchEnd);
      this.listen(element, 'touchcancel', () => {
        this.touch = undefined;
      });
    }
    this.listen(element, 'click', this.onClick);
    this.listen(this.win, 'resize', this.onResize);
    this.listen(this.win, 'orientationchange', this.onResize);
    if (this.media)
      this.listen(this.media, 'change', () => {
        if (this.media?.matches) this.finish();
      });
    if (this.options.hash) {
      this.listen(this.win, 'hashchange', this.onHistory);
      this.listen(this.win, 'popstate', this.onHistory);
    }
    const Observer = this.win.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(this.onResize);
      this.observe();
    }
  }

  get currentIndex(): number {
    return this.index;
  }

  goTo(target: number | string): Promise<boolean> {
    return this.navigate(target, 'api');
  }
  next(): Promise<boolean> {
    return this.index < 0 || this.index >= this.pages.length - 1
      ? Promise.resolve(false)
      : this.navigate(this.index + 1, 'api');
  }
  previous(): Promise<boolean> {
    return this.index <= 0
      ? Promise.resolve(false)
      : this.navigate(this.index - 1, 'api');
  }

  refresh(): void {
    if (this.destroyed) return;
    const pages = this.collect(); // Validate before mutating.
    const active = this.pages[this.pending?.index ?? this.index];
    const id = active?.dataset.sectionId;
    if (!pages.length) this.abort();
    else this.finish();
    if (this.destroyed) return;
    this.pages = pages;
    const retained = id
      ? pages.findIndex((page) => page.dataset.sectionId === id)
      : pages.indexOf(active);
    this.index = !pages.length
      ? -1
      : retained >= 0
        ? retained
        : Math.max(0, Math.min(this.index, pages.length - 1));
    this.rebuild();
    this.measure();
    this.align();
    this.observe();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort();
    this.observer?.disconnect();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    for (const [host, nodes] of this.hosts) host.replaceChildren(...nodes);
    for (const [element, attrs] of this.snapshots) {
      for (const [name, value] of attrs) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    this.buttons.length = 0;
    this.touch = undefined;
    owners.delete(this.root);
    if (urlOwners.get(this.doc) === this) urlOwners.delete(this.doc);
  }

  private collect(): HTMLElement[] {
    const pages = [...this.track.children].filter(
      (node): node is HTMLElement =>
        node instanceof this.win.HTMLElement &&
        node.classList.contains('mt-vs__content'),
    );
    const ids = new Set<string>();
    for (const page of pages) {
      const id = page.dataset.sectionId;
      if (id && ids.has(id)) throw new Error('Duplicate section ID: ' + id);
      if (id) ids.add(id);
    }
    return pages;
  }

  private save(element: HTMLElement, ...names: string[]): void {
    let attrs = this.snapshots.get(element);
    if (!attrs) {
      attrs = new Map();
      this.snapshots.set(element, attrs);
    }
    for (const name of names)
      if (!attrs.has(name)) attrs.set(name, element.getAttribute(name));
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: (event: never) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler as EventListener, options);
    this.cleanups.push(() =>
      target.removeEventListener(type, handler as EventListener, options),
    );
  }

  private rebuild(): void {
    this.root.classList.toggle('mt-vs--enabled', this.pages.length > 0);
    this.buttons.length = 0;
    for (const host of this.root.querySelectorAll<HTMLElement>(
      '.mt-vs__top-navigation ul, .mt-vs__side-navigation ul',
    )) {
      if (!this.hosts.has(host)) this.hosts.set(host, [...host.childNodes]);
      host.replaceChildren();
      this.pages.forEach((page, index) => {
        this.save(page, 'id', 'inert', 'aria-hidden', 'class', 'tabindex');
        if (!page.id) {
          do {
            page.id = 'mt-vs-section-' + ++nextId;
          } while (
            this.doc.querySelectorAll('[id="' + page.id + '"]').length > 1
          );
        }
        const li = this.doc.createElement('li');
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.textContent =
          page.dataset.navigationTitle || 'Section ' + (index + 1);
        button.setAttribute('aria-controls', page.id);
        button.className = host.closest('.mt-vs__side-navigation')
          ? 'mt-vs__bullet'
          : 'mt-vs__navigation-entry';
        li.append(button);
        host.append(li);
        this.buttons.push({ element: button, index });
      });
    }
    this.updateState();
  }

  private updateState(): void {
    const focused = this.doc.activeElement;
    const shouldFocus =
      focused instanceof this.win.HTMLElement &&
      this.pages.some((page, i) => i !== this.index && page.contains(focused));
    this.pages.forEach((page, i) => {
      this.save(page, 'inert', 'aria-hidden', 'class', 'tabindex');
      page.toggleAttribute('inert', i !== this.index);
      page.setAttribute('aria-hidden', String(i !== this.index));
      page.classList.toggle('mt-vs__content--active', i === this.index);
    });
    for (const { element, index } of this.buttons) {
      element.setAttribute('aria-current', String(index === this.index));
      element.classList.toggle(
        'mt-vs__navigation-entry--active',
        index === this.index,
      );
    }
    if (shouldFocus && this.pages[this.index]) {
      const destination =
        this.pages[this.index].querySelector<HTMLElement>(
          'h1,h2,h3,h4,h5,h6',
        ) || this.pages[this.index];
      this.save(destination, 'tabindex');
      if (!destination.hasAttribute('tabindex')) destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }
  }

  private measure(): boolean {
    const height = this.root.clientHeight;
    this.root.style.setProperty('--mt-vs-height', height + 'px');
    const top = this.track.getBoundingClientRect().top;
    const offsets = this.pages.map(
      (page) => page.getBoundingClientRect().top - top,
    );
    const changed =
      height !== this.height ||
      offsets.some((value, i) => value !== this.offsets[i]);
    this.height = height;
    this.offsets = offsets;
    return changed;
  }

  private align(animated = false, index = this.index): void {
    this.track.style.transitionProperty = 'transform';
    this.track.style.transitionDuration =
      (animated ? this.options.duration : 0) + 'ms';
    this.track.style.transform =
      'translateY(-' + Math.max(0, this.offsets[index] ?? 0) + 'px)';
  }

  private observe(): void {
    this.observer?.disconnect();
    this.observer?.observe(this.root);
    this.pages.forEach((page) => this.observer?.observe(page));
  }

  private onResize = (): void => {
    if (this.destroyed) return;
    if (this.measure()) {
      this.finish();
      if (this.destroyed) return;
      this.align();
    }
  };

  private async navigate(
    target: number | string,
    source: Source,
  ): Promise<boolean> {
    if (typeof target !== 'number' && typeof target !== 'string')
      throw new TypeError('Target must be an index or section ID.');
    const index =
      typeof target === 'string'
        ? this.pages.findIndex((page) => page.dataset.sectionId === target)
        : target;
    if (!Number.isInteger(index) || index < 0 || index >= this.pages.length)
      throw new RangeError('Unknown section or invalid index.');
    if (
      this.destroyed ||
      this.pending ||
      this.requesting ||
      index === this.index
    )
      return false;
    const detail: ScrollableChangeDetail = Object.freeze({
      fromIndex: this.index,
      toIndex: index,
      direction: index > this.index ? 'down' : 'up',
      source,
    });
    const destination = this.pages[index];
    this.requesting = true;
    const accepted = this.root.dispatchEvent(
      new this.win.CustomEvent('scrollable:beforechange', {
        bubbles: true,
        cancelable: true,
        detail,
      }),
    );
    this.requesting = false;
    if (
      !accepted ||
      this.destroyed ||
      this.pages[index] !== destination ||
      this.index !== detail.fromIndex
    )
      return false;
    this.measure();
    const duration = this.media?.matches ? 0 : this.options.duration;
    // Commit the initial transform before enabling the next transition.
    this.align();
    void this.track.offsetHeight;
    const result = new Promise<boolean>((resolve) => {
      this.pending = {
        index,
        detail,
        resolve,
        timer: setTimeout(() => this.finish(), duration + 100),
      };
    });
    this.align(duration > 0, index);
    if (!duration) this.finish();
    return result;
  }

  private finish(writeHistory = true): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = undefined;
    clearTimeout(pending.timer);
    this.index = pending.index;
    this.align();
    this.requesting = true;
    this.updateState();
    this.requesting = false;
    if (this.destroyed) {
      pending.resolve(false);
      return;
    }
    if (
      writeHistory &&
      this.options.hash &&
      pending.detail.source !== 'history'
    ) {
      const id = this.pages[this.index]?.dataset.sectionId;
      if (id) {
        const url = new URL(this.win.location.href);
        url.hash = encodeURIComponent(id);
        this.win.history[
          this.options.hash === 'push' ? 'pushState' : 'replaceState'
        ](this.win.history.state, '', url);
      }
    }
    pending.resolve(true);
    this.root.dispatchEvent(
      new this.win.CustomEvent('scrollable:change', {
        bubbles: true,
        detail: pending.detail,
      }),
    );
  }

  private abort(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.resolve(false);
    this.pending = undefined;
  }

  private onTransition = (event: TransitionEvent): void => {
    if (event.target === this.track && event.propertyName === 'transform')
      this.finish();
  };
  private hashIndex(): number {
    if (!this.options.hash) return -1;
    try {
      const id = decodeURIComponent(this.win.location.hash.slice(1));
      return this.pages.findIndex((page) => page.dataset.sectionId === id);
    } catch {
      return -1;
    }
  }
  private onHistory = (): void => {
    const index = this.hashIndex();
    if (index < 0) return;
    // A history navigation supersedes an animation to keep the URL and viewport consistent.
    this.finish(false);
    void this.navigate(index, 'history');
  };
  private onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof this.win.Element)) return;
    const match = this.buttons.find(
      ({ element }) => element === target || element.contains(target),
    );
    if (match) void this.navigate(match.index, 'navigation');
  };

  private canScroll(target: HTMLElement, direction: number): boolean {
    const page = this.pages[this.index];
    if (!page) return false;
    for (
      let element: HTMLElement | null = target;
      element && element !== this.track && this.root.contains(element);
      element = element.parentElement
    ) {
      const overflow = this.win.getComputedStyle(element).overflowY;
      if (
        (element === page || /auto|scroll|overlay/.test(overflow)) &&
        element.scrollHeight > element.clientHeight + 1
      ) {
        if (
          direction > 0
            ? element.scrollTop + element.clientHeight <
              element.scrollHeight - 1
            : element.scrollTop > 1
        )
          return true;
      }
      if (element === page) break;
    }
    return false;
  }

  private move(direction: number, source: Source): void {
    const index = this.index + direction;
    if (this.index >= 0 && index >= 0 && index < this.pages.length)
      void this.navigate(index, source);
  }
  private onWheel = (event: WheelEvent): void => {
    if (
      event.ctrlKey ||
      !event.deltaY ||
      Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
      !(event.target instanceof this.win.HTMLElement)
    )
      return;
    const now = Date.now();
    if (now - this.wheelLast > 200) {
      this.wheelSum = 0;
      this.wheelUsed = false;
    }
    this.wheelLast = now;
    if (this.wheelUsed || this.pending || this.index < 0) return;
    const direction = Math.sign(event.deltaY);
    if (this.canScroll(event.target, direction)) {
      this.wheelUsed = true;
      return;
    }
    if (Math.sign(this.wheelSum) !== direction) this.wheelSum = 0;
    const line =
      parseFloat(this.win.getComputedStyle(event.target).lineHeight) ||
      parseFloat(this.win.getComputedStyle(this.root).lineHeight) ||
      16;
    this.wheelSum +=
      event.deltaY *
      (event.deltaMode === 1
        ? line
        : event.deltaMode === 2
          ? this.root.clientHeight
          : 1);
    if (Math.abs(this.wheelSum) < 40) return;
    this.wheelUsed = true;
    if (
      this.index + direction >= 0 &&
      this.index + direction < this.pages.length
    ) {
      event.preventDefault();
      this.move(direction, 'wheel');
    }
  };
  private onKey = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      !(target instanceof this.win.HTMLElement) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    const direction = ['ArrowDown', 'PageDown', 'End'].includes(event.key)
      ? 1
      : ['ArrowUp', 'PageUp', 'Home'].includes(event.key)
        ? -1
        : 0;
    if (!direction || this.canScroll(target, direction) || this.index < 0)
      return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End')
      void this.navigate(
        event.key === 'Home' ? 0 : this.pages.length - 1,
        'keyboard',
      );
    else this.move(direction, 'keyboard');
  };
  private onTouchStart = (event: TouchEvent): void => {
    this.touch = undefined;
    if (
      event.touches.length !== 1 ||
      !(event.target instanceof this.win.HTMLElement)
    )
      return;
    const point = event.touches[0];
    this.touch = {
      id: point.identifier,
      x: point.clientX,
      y: point.clientY,
      up: !this.canScroll(event.target, -1),
      down: !this.canScroll(event.target, 1),
      target: event.target,
    };
  };
  private onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      this.touch = undefined;
      return;
    }
    const start = this.touch;
    const point = event.touches[0];
    if (!start || point.identifier !== start.id) return;
    const delta = start.y - point.clientY;
    if (
      Math.abs(delta) > Math.abs(start.x - point.clientX) &&
      (delta > 0 ? start.down : start.up)
    )
      event.preventDefault();
  };
  private onTouchEnd = (event: TouchEvent): void => {
    const start = this.touch;
    this.touch = undefined;
    if (!start || event.touches.length || event.changedTouches.length !== 1)
      return;
    const point = event.changedTouches[0];
    const delta = start.y - point.clientY;
    if (
      point.identifier !== start.id ||
      Math.abs(delta) < 50 ||
      Math.abs(delta) <= Math.abs(start.x - point.clientX)
    )
      return;
    if (
      !(delta > 0 ? start.down : start.up) ||
      this.canScroll(start.target, Math.sign(delta))
    )
      return;
    this.move(Math.sign(delta), 'touch');
  };
}
