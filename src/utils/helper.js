export const htmlToElement = (htmlText) => {
  const element = document.createElement('template');
  htmlText = htmlText.trim();
  element.innerHTML = htmlText;
  return element.content.firstChild;
};

export function debounce(func, timeout = 10) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
