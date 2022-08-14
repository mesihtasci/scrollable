import { htmlToElement } from './utils/helper.js';

export default class VerticalScroller {
  pages: HTMLElement[] | null = null;
  currentPageIndex: number | undefined = 0;
  container: HTMLElement | null = null;
  activePage: HTMLElement | null = null;
  isTransitionActive = false;
  bullets: HTMLElement[] = [];
  navigationEntries: HTMLElement[] = [];
  templates = {
    bullet: /*html*/ `<li class="mt-vs__bullet"></li>`,
    navigationEntry: /*html*/ `<li class="mt-vs__navigation-entry"></li>`,
  };

  constructor() {
    this.init();
  }

  init() {
    console.log("asd")
    const sectionName = location.hash.substring(1);
    this.isTransitionActive = false;
    this.pages = [...document.querySelectorAll('.mt-vs__content')] as HTMLElement[];
    this.container = document.querySelector('.mt-vs__container');
    this.currentPageIndex = this.pages?.findIndex((page: HTMLElement) => page.getAttribute('data-section-id') === sectionName);
    this.activePage = null;
    if (this.currentPageIndex < 0) this.currentPageIndex = 0;

    this.addNavigations();

    this.container?.addEventListener('wheel', (event) => {
      if (this.isTransitionActive) return;

      let switchPage = false;
      if (this.activePage) {
        if (
          this.activePage.scrollHeight === window.innerHeight ||
          (this.activePage.scrollHeight > window.innerHeight && ((this.activePage.scrollHeight - this.activePage.scrollTop === window.innerHeight && event.deltaY > 0) || (this.activePage?.scrollTop === 0 && event.deltaY < 0)))
        ) {
          switchPage = true;
        }

        if (switchPage && typeof this.currentPageIndex !== "undefined" && !isNaN(this.currentPageIndex) && this.pages) {
          if (event.deltaY < 0 && this.currentPageIndex > 0) this.currentPageIndex--;
          else if (event.deltaY > 0 && this.currentPageIndex < this.pages.length - 1) this.currentPageIndex++;

          this.setActivePage(this.currentPageIndex);
        }
      }
    });

    window.document.addEventListener('transitionstart', () => {
      this.isTransitionActive = true;
    });

    window.document.addEventListener('transitionend', () => {
      this.isTransitionActive = false;
    });

    if (this.currentPageIndex >= 0) this.setActivePage(this.currentPageIndex);
  }

  addNavigations() {
    if (this.pages)
      for (let i = 0; i < this.pages.length; i++) {
        const title = this.pages[i].getAttribute('data-title');
        const bullet = htmlToElement(this.templates.bullet);
        const navigationEntry = htmlToElement(this.templates.navigationEntry);

        if (title)
          navigationEntry.innerHTML = title;

        bullet.addEventListener('click', () => {
          this.setActivePage(i);
        });

        navigationEntry.addEventListener('click', () => {
          this.setActivePage(i);
        });

        if (i === 0) {
          bullet.classList.add('mt-vs__bullet--active');
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
        bullet.classList.remove('mt-vs__bullet--active');
        navigationEntry.classList.remove('mt-vs__navigation-entry--active');
      }

      this.bullets[index].classList.add('mt-vs__bullet--active');
      this.navigationEntries[index].classList.add('mt-vs__navigation-entry--active');
    }
  }

  setActivePage(index: number) {
    if (this.pages && this.container) {
      const yTranslation = index * 100;
      this.currentPageIndex = index;
      this.activePage = this.pages[index] as HTMLElement;
      this.container.style.transform = `translate3d(0, -${yTranslation}vh, 0)`;
      this.setActiveNavigationEntry(index);
      const title = this.pages[index].getAttribute('data-section-id');

      if (title)
        location.hash = title;
    }
  }
}