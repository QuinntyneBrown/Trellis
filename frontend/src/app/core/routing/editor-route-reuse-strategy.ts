import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

/**
 * Reuses the same routed component instance across navigations between two
 * *different* Route configs that happen to render the same component - most
 * notably the parameterless 'editor' route and the parameterized
 * 'editor/:documentId' route.
 *
 * Angular's default RouteReuseStrategy only reuses a component instance when
 * both the previous and next route point at the exact same Route config
 * object reference. 'editor' and 'editor/:documentId' are distinct Route
 * entries, so navigating between them (e.g. immediately after creating a new
 * document, when the app moves from the blank 'editor' route to
 * 'editor/:newId') would otherwise fully destroy and recreate
 * EditorPageComponent. That drops in-component UI state (such as whether the
 * documents panel is open) and forces a redundant resolver re-fetch of data
 * this component already has in hand - both of which are surprising for
 * users and racy for anything (tests included) that interacts with the page
 * immediately after a save completes.
 */
export class EditorRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(): boolean {
    return false;
  }

  store(): void {
    // Routes are never detached (see shouldDetach), so there is nothing to store.
  }

  shouldAttach(): boolean {
    return false;
  }

  retrieve(): DetachedRouteHandle | null {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig === curr.routeConfig) {
      return true;
    }

    return (
      !!future.routeConfig?.component && future.routeConfig.component === curr.routeConfig?.component
    );
  }
}
