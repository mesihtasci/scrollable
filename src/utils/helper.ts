export const htmlToElement = (htmlText: string): HTMLElement => {
  const element = document.createElement('template');
  htmlText = htmlText.trim();
  element.innerHTML = htmlText;
  return element.content.firstChild as HTMLElement;
};

export function throttle(callback: Function, wait: number) {
  var time = Date.now();

  return function(event: WheelEvent) {
    // we dismiss every wheel event with deltaY less than 4
    if (Math.abs(event.deltaY) < 4) return

    if ((time + wait - Date.now()) < 0) {
      callback(event);
      time = Date.now();
    }
  }
}

