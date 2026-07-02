import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { HubConnectionState } from '../models/hub-connection-state.model';
import { RenderResult } from '../models/render-result.model';

const RECONNECT_DELAY_MS = 2000;

/**
 * Wraps the SignalR hub connection used to render PlantUML diagrams.
 *
 * SignalR's own `on`/`onreconnecting`/etc. callbacks are push-based, so the
 * connection state and the most recent render outcome are exposed as Angular
 * Signals rather than as an Observable stream that would need an RxJS bridge.
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramHubService {
  private readonly connection: HubConnection;

  readonly connectionState = signal<HubConnectionState>('disconnected');
  readonly renderResult = signal<RenderResult | null>(null);
  readonly isRendering = signal<boolean>(false);

  constructor() {
    this.connection = this.buildConnection();

    this.connection.onreconnecting(() => this.connectionState.set('reconnecting'));
    this.connection.onreconnected(() => this.connectionState.set('connected'));
    this.connection.onclose(() => this.connectionState.set('disconnected'));

    this.start();
  }

  /** Extracted so tests can substitute a fake connection via prototype spying. */
  private buildConnection(): HubConnection {
    return new HubConnectionBuilder().withUrl(environment.hubUrl).withAutomaticReconnect().build();
  }

  start(): void {
    this.connection
      .start()
      .then(() => this.connectionState.set('connected'))
      .catch(() => {
        this.connectionState.set('disconnected');
        setTimeout(() => this.start(), RECONNECT_DELAY_MS);
      });
  }

  /**
   * Invokes the single RenderDiagram hub method. Per the API contract this
   * never rejects for ordinary business-level failures (bad syntax, empty
   * input) -- those come back as a resolved RenderResult with isSuccess
   * false. A rejection here therefore means an actual connection-level
   * problem, which is funneled into renderResult as a failed result so the
   * preview pane surfaces it exactly like any other render failure.
   */
  async render(source: string): Promise<void> {
    this.isRendering.set(true);
    try {
      const result = await this.connection.invoke<RenderResult>('RenderDiagram', source);
      this.renderResult.set(result);
    } catch (error) {
      this.renderResult.set({
        isSuccess: false,
        svg: null,
        errorMessage: error instanceof Error ? error.message : 'Failed to reach the render service.',
      });
    } finally {
      this.isRendering.set(false);
    }
  }
}
