import { inject, Injectable, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parseTelemetryMetric, TelemetryMetric } from '../models/telemetry.models';
import { AuthService } from './auth.service';

export type StreamStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'error';
export type MetricEvent = { type: 'reset' } | { type: 'metric'; metric: TelemetryMetric };

@Injectable({ providedIn: 'root' })
export class MetricsStreamService {
  private readonly auth = inject(AuthService);
  private readonly eventSubject = new Subject<MetricEvent>();
  private connection: HubConnection | null = null;
  private instanceId: string | null = null;

  readonly events$ = this.eventSubject.asObservable();
  readonly status = signal<StreamStatus>('disconnected');

  async connect(instanceId: string): Promise<void> {
    if (
      this.instanceId === instanceId &&
      this.connection?.state === HubConnectionState.Connected
    ) {
      return;
    }

    await this.disconnect();
    this.eventSubject.next({ type: 'reset' });
    this.instanceId = instanceId;
    this.status.set('connecting');

    const connection = new HubConnectionBuilder()
      .withUrl(environment.telemetryHubUrl, {
        accessTokenFactory: () => this.auth.token() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveMetrics', (payload: unknown) => {
      const metric = parseTelemetryMetric(payload);
      if (metric) this.eventSubject.next({ type: 'metric', metric });
    });
    connection.on('ReceiveOnPause', () => this.status.set('paused'));
    connection.on('ReceiveOnRestore', () => this.status.set('connected'));
    connection.onreconnecting(() => this.status.set('reconnecting'));
    connection.onreconnected(async () => {
      if (!this.instanceId) return;
      try {
        await connection.invoke('EnterGroup', this.instanceId);
        this.status.set('connected');
      } catch {
        this.status.set('error');
      }
    });
    connection.onclose(() => this.status.set('disconnected'));
    this.connection = connection;

    try {
      await connection.start();
      await connection.invoke('EnterGroup', instanceId);
      this.status.set('connected');
    } catch {
      this.status.set('error');
      this.eventSubject.next({ type: 'reset' });
    }
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    const currentInstanceId = this.instanceId;
    this.connection = null;
    this.instanceId = null;

    if (connection) {
      if (connection.state === HubConnectionState.Connected && currentInstanceId) {
        try {
          await connection.invoke('LeaveGroup', currentInstanceId);
        } catch {
          // Stop the connection even if leaving the group fails.
        }
      }
      await connection.stop();
    }

    this.status.set('disconnected');
    this.eventSubject.next({ type: 'reset' });
  }
}
