import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
import { cleanup } from '@testing-library/react';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock WebSocket for tests
global.WebSocket = class MockWebSocket {
  constructor() {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});