import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const PROJECT_ROOT = path.resolve(process.cwd());

export class TestContext {
  constructor() {
    this.indexHtmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf-8');
    this.prototypeHtmlContent = fs.readFileSync(path.join(PROJECT_ROOT, 'focusflow_prototype.html'), 'utf-8');
    this.mockDataContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src/data/mockData.js'), 'utf-8');
    
    // Create JSDOM instances
    this.prototypeDom = new JSDOM(this.prototypeHtmlContent, {
      url: 'http://localhost:3000',
      contentType: 'text/html',
      runScripts: 'outside-only'
    });

    this.indexDom = new JSDOM(this.indexHtmlContent, {
      url: 'http://localhost:3000',
      contentType: 'text/html'
    });

    this.componentCache = {};
  }

  getComponentSource(relPath) {
    if (!this.componentCache[relPath]) {
      const fullPath = path.join(PROJECT_ROOT, relPath);
      if (fs.existsSync(fullPath)) {
        this.componentCache[relPath] = fs.readFileSync(fullPath, 'utf-8');
      } else {
        this.componentCache[relPath] = '';
      }
    }
    return this.componentCache[relPath];
  }

  // Helper to render HTML snippets or mock components into a JSDOM document
  renderFragment(htmlFragment) {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlFragment}</body></html>`);
    return dom.window.document.body;
  }

  // Create a simulated app environment state
  createAppEnvironment(initialScreen = 'dashboard', initialViewportWidth = 1024) {
    const document = this.prototypeDom.window.document;
    
    let currentScreen = initialScreen;
    let viewportWidth = initialViewportWidth;
    let activeModal = null; // 'project', 'phase', 'task', 'material' or null
    let modalData = null;

    return {
      get currentScreen() { return currentScreen; },
      set currentScreen(val) { currentScreen = val; },
      get viewportWidth() { return viewportWidth; },
      set viewportWidth(val) { viewportWidth = val; },
      get activeModal() { return activeModal; },
      set activeModal(val) { activeModal = val; },
      get modalData() { return modalData; },
      set modalData(val) { modalData = val; },

      // Utility helpers
      isMobile() { return viewportWidth < 768; },
      isDesktop() { return viewportWidth >= 768; },
      
      switchScreen(screenName) {
        currentScreen = screenName;
      },
      
      openModal(type, data = null) {
        activeModal = type;
        modalData = data;
      },

      closeModal() {
        activeModal = null;
        modalData = null;
      }
    };
  }
}

export const context = new TestContext();
