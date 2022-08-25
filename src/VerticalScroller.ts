import { htmlToElement } from './utils/helper.js';
import { Direction } from './utils/enums.js';

export default class VerticalScroller {
  touchStartY = 0;
  touchEndY = 0;
  nextIndex = 0;
  pages: HTMLElement[] | null = null;
  currentPageIndex: number | undefined = 0;
  container: HTMLElement | null = null;
  activePage: HTMLElement | null = null;
  isTransitionActive = false;
  bullets: HTMLElement[] = [];
  navigationEntries: HTMLElement[] = [];
  templates = {
    bullet: /*html*/ `<li class="mt-vs__bullet-wrapper"><span class="mt-vs__bullet-text"></span><span class="mt-vs__bullet"></span></li>`,
    navigationEntry: /*html*/ `<li class="mt-vs__navigation-entry"></li>`,
  };

  constructor() {
    this.init();
  }

  init() {
    const sectionName = decodeURIComponent(location.hash.substring(1));
    this.isTransitionActive = false;
    this.pages = [...document.querySelectorAll('.mt-vs__content')] as HTMLElement[];
    this.container = document.querySelector('.mt-vs__container');
    this.currentPageIndex = -1;
    this.nextIndex = this.pages?.findIndex((page: HTMLElement) => page.getAttribute('data-section-id') === sectionName);
    this.activePage = null;
    this.touchStartY = 0;
    this.touchEndY = 0;
    if (this.nextIndex < 0) this.nextIndex = 0;

    this.addNavigations();

    this.container?.addEventListener('wheel', (event) => {
      this.slideRequest(event.deltaY > 0 ? Direction.Down : Direction.Up);
    });

    this.container?.addEventListener('touchstart', e => {
      this.touchStartY = e.changedTouches[0].screenY
    })

    this.container?.addEventListener('touchend', e => {
      this.touchEndY = e.changedTouches[0].screenY

      if(Math.abs(this.touchStartY - this.touchEndY) < 15)
      return;

      this.slideRequest(this.touchEndY > this.touchStartY ? Direction.Up : Direction.Down);

      this.touchEndY = 0;
      this.touchStartY = 0;
    })

    this.container?.addEventListener('transitionend', () => {
      this.isTransitionActive = false;
    });

    if (this.nextIndex >= 0) this.setActivePage(this.nextIndex);
  }

  slideRequest(direction: Direction) {
    let switchPage = false;
    if (this.activePage) {
      if (
        this.activePage.scrollHeight === window.innerHeight ||
        (this.activePage.scrollHeight > window.innerHeight &&
          ((this.activePage.scrollHeight - this.activePage.scrollTop === window.innerHeight &&
            direction === Direction.Down) ||
            (this.activePage?.scrollTop === 0 && direction === Direction.Up)))
      ) {
        switchPage = true;
      }

      this.nextIndex = this.currentPageIndex || 0;

      if (switchPage && typeof this.currentPageIndex !== "undefined" && !isNaN(this.currentPageIndex) && this.pages) {
        if (direction === Direction.Up && this.currentPageIndex > 0) this.nextIndex--;
        else if (direction === Direction.Down && this.currentPageIndex < this.pages.length - 1) this.nextIndex++;

        this.setActivePage(this.nextIndex);

      }
    }
  }

  addNavigations() {
    if (this.pages)
      for (let i = 0; i < this.pages.length; i++) {
        const title = this.pages[i].getAttribute('data-navigation-title');
        const bullet = htmlToElement(this.templates.bullet);

        const navigationEntry = htmlToElement(this.templates.navigationEntry);

        if (title) {
          navigationEntry.innerHTML = title;
          bullet.querySelector('.mt-vs__bullet-text')!.innerHTML = title;
        }

        bullet.addEventListener('click', () => {
          this.setActivePage(i);
        });

        navigationEntry.addEventListener('click', () => {
          this.setActivePage(i);
        });

        if (i === 0) {
          bullet.querySelector('.mt-vs__bullet')!.classList.add('mt-vs__bullet--active');
          navigationEntry.classList.add('mt-vs__navigation-entry--active');
        }

        const sideNavigation = document.querySelector('.mt-vs__side-navigation ul');
        const topNavigation = document.querySelector('.mt-vs__top-navigation ul');

        if (sideNavigation)
          this.bullets.push(sideNavigation.insertAdjacentElement('beforeend', bullet) as HTMLElement);

        if (topNavigation)
          this.navigationEntries.push(topNavigation.insertAdjacentElement('beforeend', navigationEntry) as HTMLElement);
      }
  }

  setActiveNavigationEntry(index: number) {
    if (this.pages) {
      for (let i = 0; i < this.pages.length; i++) {
        const navigationEntry = this.navigationEntries[i] as HTMLElement;
        const bullet = this.bullets[i] as HTMLElement;

        if (bullet)
          bullet.querySelector('.mt-vs__bullet')!.classList.remove('mt-vs__bullet--active');

        if (navigationEntry)
          navigationEntry.classList.remove('mt-vs__navigation-entry--active');
      }

      if (this.bullets.length > 0)
        this.bullets[index].querySelector('.mt-vs__bullet')!.classList.add('mt-vs__bullet--active');

      if (this.navigationEntries.length > 0)
        this.navigationEntries[index].classList.add('mt-vs__navigation-entry--active');
    }
  }

  setActivePage(index: number) {
    if (!this.isTransitionActive && this.pages && this.container && this.currentPageIndex !== index && (index < this.pages.length || index >= 0)) {
      if (this.currentPageIndex !== -1 || index > 0)
        this.isTransitionActive = true;

      const yTranslation = index * 100;
      this.currentPageIndex = index;
      this.activePage = this.pages[index] as HTMLElement;
      this.container.style.transform = `translate3d(0, -${yTranslation}vh, 0)`;
      this.setActiveNavigationEntry(index);
      const sectionId = this.pages[index].getAttribute('data-section-id');

      if (sectionId)
        location.hash = encodeURIComponent(sectionId);
    }
  }
}