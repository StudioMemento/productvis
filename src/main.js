import './styles.css';
import { ProductVisApp } from './app.js';

window.__PRODUCT_VIS_ERRORS__ = [];
window.addEventListener('error', (event) => {
  window.__PRODUCT_VIS_ERRORS__.push({ type: 'error', message: event.message, source: event.filename, line: event.lineno });
});
window.addEventListener('unhandledrejection', (event) => {
  window.__PRODUCT_VIS_ERRORS__.push({ type: 'rejection', message: String(event.reason?.message || event.reason) });
});

const app = new ProductVisApp();
app.init().catch((error) => {
  console.error('Product VIS V2.1B failed to initialise.', error);
});
