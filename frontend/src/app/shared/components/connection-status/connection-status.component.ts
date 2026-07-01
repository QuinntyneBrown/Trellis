import { Component, Input } from '@angular/core';

import { HubConnectionState } from '../../../core/models/hub-connection-state.model';

/**
 * Displays the SignalR hub connection state. Its text content is exactly one
 * of 'connected' | 'disconnected' | 'reconnecting' per the E2E contract.
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [],
  templateUrl: './connection-status.component.html',
  styleUrl: './connection-status.component.scss',
})
export class ConnectionStatusComponent {
  @Input() state: HubConnectionState = 'disconnected';
}
