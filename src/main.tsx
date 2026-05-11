import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safety check for fetch property to prevent "Cannot set property fetch" errors in some environments
try {
  if (typeof window !== 'undefined' && window.fetch) {
    const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (desc && desc.configurable && (!desc.writable || !desc.set)) {
      const originalFetch = window.fetch.bind(window);
      Object.defineProperty(window, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  }
} catch (e) {
  // Silent fail - we can't do much if defineProperty fails
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
