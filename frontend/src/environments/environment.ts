import { Environment } from './environment.model';

// Production configuration. Real deployments are expected to template these
// absolute URLs at build time (e.g. via a CI/CD replacement step or a
// generated environment file) rather than relying on the dev-server proxy.
export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api.trellis.example.com/api',
  hubUrl: 'https://api.trellis.example.com/hubs/plantuml',
};
