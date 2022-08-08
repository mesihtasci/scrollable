import { htmlToElement, debounce } from './utils/helper';

export default class VerticalScroller {
  bullets = [];
  navigationEntries = [];
  templates = {
    bullet: /*html*/ `<li class="mt-vs__bullet"></li>`,
    navigationEntry: /*html*/ `<li class="mt-vs__navigation-entry"></li>`,
  };

  constructor() {
    this.currentPage = 0;
    this.touchstartY = 0;
    this.touchendY = 0;
    this.activePage = null;
    this.previousPage = null;
    this.transition = false;
    this.switchPageDebounced = debounce((event) => this.switchPage(event));
    this.init();
  }

  init() {
    this.pages = document.querySelectorAll('.mt-vs__content');
    this.activePage = this.pages[0];
    this.container = document.querySelector('.mt-vs__container');
    this.addNavigations();

    this.container.addEventListener('wheel', this.switchPageDebounced);

    window.document.addEventListener('transitionend', (event) => {
      if (event.target && event.target.classList.contains('mt-vs__content')) {
        this.container.addEventListener('wheel', this.switchPageDebounced);
        this.transition = false;
      }
    });

    this.container.addEventListener('touchstart', (event) => {
      this.touchstartY = event.changedTouches[0].screenY;
    });

    this.container.addEventListener('touchend', (event) => {
      this.touchendY = event.changedTouches[0].screenY;
      if (this.container.offsetHeight >= this.container.scrollHeight) {
        if (this.touchendY < this.touchstartY) this.setPage(+1);
        if (this.touchendY > this.touchstartY) this.setPage(-1);
      } else this.setPage(-1);
    });
  }

  addNavigations() {
    for (let i = 0; i < this.pages.length; i++) {
      const title = this.pages[i].getAttribute('aria-label');
      const bullet = htmlToElement(this.templates.bullet);
      const navigationEntry = htmlToElement(this.templates.navigationEntry);
      navigationEntry.innerHTML = title;

      bullet.addEventListener('click', () => {
        this.scrollTo(i);
      });

      navigationEntry.addEventListener('click', () => {
        this.scrollTo(i);
      });

      if (i === 0) {
        bullet.classList.add('mt-vs__bullet--active');
        navigationEntry.classList.add('mt-vs__navigation-entry--active');
      }

      this.bullets.push(this.container.querySelector('.mt-vs__side-navigation ul').insertAdjacentElement('beforeend', bullet));
      this.navigationEntries.push(this.container.querySelector('.mt-vs__top-navigation ul').insertAdjacentElement('beforeend', navigationEntry));
    }
  }

  setActiveNavigationEntry(activeIndex, targetPage) {
    this.bullets.forEach((bullet, index) => {
      const navigationEntry = this.navigationEntries[index];

      if (typeof targetPage === 'undefined') {
        if (index !== activeIndex) {
          bullet.classList.remove('mt-vs__bullet--active');
          navigationEntry.classList.remove('mt-vs__navigation-entry--active');
        } else {
          bullet.classList.add('mt-vs__bullet--active');
          navigationEntry.classList.add('mt-vs__navigation-entry--active');
        }
      } else if (targetPage === index) {
        bullet.classList.add('mt-vs__bullet--active');
        navigationEntry.classList.add('mt-vs__navigation-entry--active');
      } else {
        bullet.classList.remove('mt-vs__bullet--active');
        navigationEntry.classList.remove('mt-vs__navigation-entry--active');
      }
    });
  }

  setPage(addend, targetPage) {
    this.container.removeEventListener('wheel', this.switchPageDebounced);
    this.transition = true;
    if ((this.currentPage < this.pages.length - 1 && addend === 1) || (this.currentPage > 0 && addend === -1)) {
      this.pages[this.currentPage].classList.remove('mt-vs__content--active');
      this.currentPage = this.currentPage + addend;
      this.pages[this.currentPage].classList.add('mt-vs__content--active');
      this.previousPage = this.activePage;
      this.activePage = this.pages[this.currentPage];

      if (addend > 0) {
        if (!this.previousPage.classList.contains('slide-top')) this.previousPage.classList.add('slide-top');
        if (this.previousPage.classList.contains('slide-bottom')) this.previousPage.classList.remove('slide-bottom');
      } else {
        if (!this.previousPage.classList.contains('slide-bottom')) this.previousPage.classList.add('slide-bottom');
      }

      this.activePage.scroll(0, 0);
      this.setActiveNavigationEntry(this.currentPage, targetPage);
    } else {
      this.container.addEventListener('wheel', this.switchPageDebounced);
      this.transition = false;
    }
  }

  scrollTo(targetPage) {
    if (this.transition) return;

    if (this.currentPage === targetPage) return;

    const difference = Math.abs(targetPage - this.currentPage);
    const addend = targetPage - this.currentPage > 0 ? 1 : -1;
    let transitionSpeed = 0.5 / difference;

    if (difference === 1) transitionSpeed = 0.5;
    else transitionSpeed = 0.075;

    this.container.style.setProperty('--transition-speed', transitionSpeed + 's');

    for (let i = 0; i < difference; i++) {
      setTimeout(() => {
        if (i === difference - 1) this.container.style.setProperty('--transition-speed', '0.5s');

        this.setPage(addend, targetPage);
      }, i * (transitionSpeed * 1000 + 50));
    }
  }

  switchPage = (event) => {
    if (this.activePage.scrollTop === 0 && event.deltaY < 0) {
      this.setPage(-1);
      return;
    }

    if (this.activePage.offsetHeight + this.activePage.scrollTop >= this.activePage.scrollHeight) this.setPage(1);
  };
}
