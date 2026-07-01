import { Environment } from './environment.model';

// Development configuration. Relative URLs are used because the Angular dev
// server proxies /api and /hubs to the backend (see proxy.conf.json).
export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api',
  hubUrl: '/hubs/plantuml',
};
