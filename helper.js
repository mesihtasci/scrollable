(() => {
  let currentPage = 0;
  let touchstartY = 0;
  let touchendY = 0;
  let activePage = null;
  let lastAction = null;

  const ACTIONS = {
    previousPage: 'previous',
    nextPage: 'next',
  };

  const pages = document.querySelectorAll('.fullheight-scroller__content');
  const container = document.querySelector('.fullheight-scroller__container');

  activePage = pages[0];

  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, timeout);
    };
  }

  const processChange = debounce((e) => printBoundingClient(e));

  const printBoundingClient = (e) => {
    const boundingClientReact = activePage.getBoundingClientRect();
    switch (e.type) {
      case 'wheel':
        if (boundingClientReact.top === 0 && e.deltaY < 0) {
          getPreviousPage();
          return;
        }

        if (container.offsetHeight + container.scrollTop >= container.scrollHeight) {
          getNextPage();
          return;
        }

        break;
    }
  };

  const getNextPage = () => {
    if (currentPage < pages.length - 1) {
      console.log('get next page');

      pages[currentPage].classList.remove('fullheight-scroller__content--active');
      pages[++currentPage].classList.add('fullheight-scroller__content--active');
      activePage = pages[currentPage];
      //activePage.scrollTop = 0;
    }
  };

  const getPreviousPage = () => {
    if (currentPage > 0) {
      console.log('get previous page');

      pages[currentPage].classList.remove('fullheight-scroller__content--active');
      pages[--currentPage].classList.add('fullheight-scroller__content--active');
      activePage = pages[currentPage];
      //activePage.scrollTop = 0;
    }
  };

  container.addEventListener('wheel', (e) => {
    processChange(e);
  });

  // container.addEventListener('touchstart', (e) => {
  //   touchstartY = e.changedTouches[0].screenY;
  // });

  // container.addEventListener('touchend', (e) => {
  //   touchendY = e.changedTouches[0].screenY;
  //   if (container.offsetHeight >= container.scrollHeight) {
  //     if (touchendY < touchstartY) getNextPage();
  //     if (touchendY > touchstartY) getPreviousPage();
  //   } else getPreviousPage();
  // });
})();
