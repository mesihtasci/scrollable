import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Scrollable from '@mesihtasci/scrollable';
import type { ScrollableChangeDetail } from '@mesihtasci/scrollable';
import '@mesihtasci/scrollable/style.css';

function Scroller({ onChange }: { onChange: (index: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current!;
    const instance = new Scrollable(element, { duration: 300 });
    const change = (event: Event) =>
      onChange((event as CustomEvent<ScrollableChangeDetail>).detail.toIndex);
    element.addEventListener('scrollable:change', change);
    return () => {
      element.removeEventListener('scrollable:change', change);
      instance.destroy();
    };
  }, [onChange]);
  return (
    <div ref={root} className="mt-vs">
      <main className="mt-vs__container">
        {[0, 1, 2].map((index) => (
          <section
            key={index}
            className="mt-vs__content"
            data-section-id={'react-' + index}
            data-navigation-title={'React section ' + (index + 1)}
          >
            <h2>React section {index + 1}</h2>
            <p>
              Each effect owns one instance. Cleanup restores the markup before
              Strict Mode mounts again.
            </p>
            <a href="../index.html">Browse examples</a>
          </section>
        ))}
      </main>
      <nav className="mt-vs__top-navigation" aria-label="React sections">
        <ul />
      </nav>
    </div>
  );
}
function App() {
  const [visible, setVisible] = useState(true);
  const [index, setIndex] = useState(0);
  return (
    <>
      <header className="toolbar">
        <a href="../index.html">← Examples</a>
        <button
          onClick={() => {
            setVisible((value) => !value);
            setIndex(0);
          }}
        >
          Toggle scroller
        </button>
        <output role="status">Section {index + 1}</output>
      </header>
      {visible && <Scroller onChange={setIndex} />}
    </>
  );
}
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
