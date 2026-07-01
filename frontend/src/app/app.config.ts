import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter } from '@angular/router';

import { EditorRouteReuseStrategy } from './core/routing/editor-route-reuse-strategy';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: RouteReuseStrategy, useClass: EditorRouteReuseStrategy },
  ],
};
