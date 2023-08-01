import { htmlToElement, throttle } from './utils/helper.js';
import { Direction } from './utils/enums.js';
import './styles.css'

export default class Scrollable {
  touchStartY = 0;
  touchEndY = 0;
  nextIndex = 0;
  direction: Direction = Direction.Down;
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
    const previousSideNavigationElements = document.querySelectorAll('.mt-vs__bullet-wrapper');

    previousSideNavigationElements.forEach((previousElement) => {
      previousElement.remove();
    })

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

    this.addIndex();

    this.addNavigations();

    this.container?.addEventListener('wheel', throttle(this.fireThrottledWheelEvent.bind(this), 500));

    this.container?.addEventListener('touchstart', e => {
      console.log("touchstart")
      this.touchStartY = e.changedTouches[0].screenY
    })

    this.container?.addEventListener('touchend', e => {
      console.log("touchend")
      this.touchEndY = e.changedTouches[0].screenY

      if (Math.abs(this.touchStartY - this.touchEndY) < 70) {
        this.touchEndY = 0;
        this.touchStartY = 0;
        return;
      }

      this.direction = this.touchEndY > this.touchStartY ? Direction.Up : Direction.Down;

      this.slideRequest();

      this.touchEndY = 0;
      this.touchStartY = 0;
    })

    this.container?.addEventListener('transitionstart', (event) => {
      const eventTaret = event.target as HTMLElement;
      if (event.propertyName === "transform" && event.target && eventTaret.classList.contains("mt-vs__container")) {
        this.emitEvent("mt-vt:transition-start", {
          currentSlideIndex: (this.currentPageIndex! + (this.direction === Direction.Down ? -1 : 1)),
          nextSlideIndex: this.currentPageIndex,
          direction: this.direction === Direction.Down ? "down" : "up"
        });
      }
    })

    this.container?.addEventListener('transitionend', (event) => {
      const eventTaret = event.target as HTMLElement;
      if (event.propertyName === "transform" && event.target && eventTaret.classList.contains("mt-vs__container")) {
        this.isTransitionActive = false;
        this.emitEvent("mt-vt:transition-end", {
          currentSlideIndex: (this.currentPageIndex! + (this.direction === Direction.Down ? -1 : 1)),
          nextSlideIndex: this.currentPageIndex,
          direction: this.direction === Direction.Down ? "down" : "up"
        });
      }
    });

    if (this.nextIndex >= 0) this.setActivePage(this.nextIndex);
  }

  fireThrottledWheelEvent(event: WheelEvent) {
    if(event) {
      this.direction =  event.deltaY> 0 ? Direction.Down : Direction.Up
      this.slideRequest();
    }
    
  }


  addIndex() {
    if (this.pages) {
      this.pages.forEach((page, index) => {
        page.setAttribute("data-index", index.toString());
      })
    }
  }

  slideRequest() {
    let switchPage = false;
    if (this.activePage) {
      const activePageHeight = this.activePage.clientHeight;
      const scrollHeight = this.activePage.scrollHeight;
      const scrollTop = this.activePage.scrollTop

      if (
        scrollHeight === activePageHeight ||
        (scrollHeight > activePageHeight &&
          ((Math.abs(scrollHeight - activePageHeight - scrollTop) < 1 &&
            this.direction === Direction.Down) ||
            (scrollTop <= 0 && this.direction === Direction.Up)))
      ) {
        switchPage = true;
      }

      this.nextIndex = this.currentPageIndex || 0;

      if (switchPage && typeof this.currentPageIndex !== "undefined" && !isNaN(this.currentPageIndex) && this.pages) {
        if (this.direction === Direction.Up && this.currentPageIndex > 0) this.nextIndex--;
        else if (this.direction === Direction.Down && this.currentPageIndex < this.pages.length - 1) this.nextIndex++;

        this.setActivePage(this.nextIndex);

      }
    }
  }

  emitEvent(name: string, detail: any) {
    return window.document.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail: { ...detail } }))
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

  getYTranslationValue(index: number) {
    if (this.pages) {
      let sum = 0;

      for (let i = index; i > 0; i--)
        sum += this.pages[i].clientHeight

      return sum;
    }

    return 0;
  }

  setActivePage(index: number) {
    if (!this.isTransitionActive && this.pages && this.container && this.currentPageIndex !== index && (index < this.pages.length || index >= 0)) {
      if (this.currentPageIndex !== -1 || index > 0)
        this.isTransitionActive = true;

      const yTranslation = this.getYTranslationValue(index);
      this.currentPageIndex = index;
      this.activePage = this.pages[index] as HTMLElement;
      this.container.style.transform = `translateY(-${yTranslation}px)`;
      this.setActiveNavigationEntry(index);
      const sectionId = this.pages[index].getAttribute('data-section-id');

      if (sectionId)
        location.hash = encodeURIComponent(sectionId);
    }
  }
}