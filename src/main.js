import { AppController } from './app/AppController.js';

const app = new AppController();

try {
  app.boot();
  window.__PRODUCT_VIS__ = app;
  document.documentElement.dataset.productVisBuild = 'v2-1a-stability';
} catch {
  // AppController already rendered the fatal state.
}
