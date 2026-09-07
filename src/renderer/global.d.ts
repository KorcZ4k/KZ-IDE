import type { KZApi } from '../shared/api';

declare global {
  interface Window {
    kz: KZApi;
  }
}

export {};
