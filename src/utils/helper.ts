export const htmlToElement = (htmlText: string): HTMLElement => {
  const element = document.createElement('template');
  htmlText = htmlText.trim();
  element.innerHTML = htmlText;
  return element.content.firstChild as HTMLElement;
};
