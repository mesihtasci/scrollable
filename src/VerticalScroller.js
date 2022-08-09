import { htmlToElement, debounce } from './utils/helper';

export default class VerticalScroller {
  bullets = [];
  navigationEntries = [];
  templates = {
    bullet: /*html*/ `<li class="mt-vs__bullet"></li>`,
    navigationEntry: /*html*/ `<li class="mt-vs__navigation-entry"></li>`,
  };

  constructor() {
    this.init();
  }

  init() {
    const sectionName = location.hash.substring(1);
    this.transitionActive = false;
    this.pages = [...document.querySelectorAll('.mt-vs__content')];
    this.container = document.querySelector('.mt-vs__container');
    this.currentPage = this.pages.findIndex((page) => page.getAttribute('data-section-id') === sectionName);
    if (this.currentPage < 0) this.currentPage = 0;

    this.addNavigations();

    this.container.addEventListener('wheel', (event) => {
      if (this.transitionActive) return;

      if (event.deltaY < 0 && this.currentPage > 0) this.currentPage--;
      else if (event.deltaY > 0 && this.currentPage < this.pages.length - 1) this.currentPage++;

      this.setActivePage(this.currentPage);
    });

    window.document.addEventListener('transitionstart', () => {
      this.transitionActive = true;
    });

    window.document.addEventListener('transitionend', () => {
      this.transitionActive = false;
    });

    if (this.currentPage >= 0) this.setActivePage(this.currentPage);
  }

  addNavigations() {
    for (let i = 0; i < this.pages.length; i++) {
      const title = this.pages[i].getAttribute('data-title');
      const bullet = htmlToElement(this.templates.bullet);
      const navigationEntry = htmlToElement(this.templates.navigationEntry);
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

      this.bullets.push(document.querySelector('.mt-vs__side-navigation ul').insertAdjacentElement('beforeend', bullet));
      this.navigationEntries.push(document.querySelector('.mt-vs__top-navigation ul').insertAdjacentElement('beforeend', navigationEntry));
    }
  }

  setActiveNavigationEntry(index) {
    for (let i = 0; i < this.pages.length; i++) {
      const navigationEntry = this.navigationEntries[i];
      const bullet = this.bullets[i];
      bullet.classList.remove('mt-vs__bullet--active');
      navigationEntry.classList.remove('mt-vs__navigation-entry--active');
    }

    this.bullets[index].classList.add('mt-vs__bullet--active');
    this.navigationEntries[index].classList.add('mt-vs__navigation-entry--active');
  }

  setActivePage(index) {
    const yTranslation = index * 100;
    this.currentPage = index;

    this.container.style.transform = `translate3d(0, -${yTranslation}vh, 0)`;
    this.setActiveNavigationEntry(index);
    location.hash = this.pages[index].getAttribute('data-section-id');
  }
}
