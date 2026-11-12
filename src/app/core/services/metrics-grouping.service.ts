import { Injectable } from '@angular/core';
import { Observable, scan } from 'rxjs';
import { ApiMetrics, DbMetrics, MachineMetrics, TelemetryMetric } from '../models/telemetry.models';
import { MetricEvent } from './metrics-stream.service';

const HISTORY_LIMIT = 120;

export interface MetricsSnapshot {
  machine: MachineMetrics | null;
  api: ApiMetrics | null;
  database: DbMetrics | null;
  machineHistory: MachineMetrics[];
}

export const EMPTY_METRICS: MetricsSnapshot = {
  machine: null,
  api: null,
  database: null,
  machineHistory: [],
};

@Injectable({ providedIn: 'root' })
export class MetricsGroupingService {
  group(events: Observable<MetricEvent>): Observable<MetricsSnapshot> {
    return events.pipe(
      scan((snapshot, event) => {
        if (event.type === 'reset') return EMPTY_METRICS;

        const metric = event.metric;
        if (isMachineMetric(metric)) {
          return {
            ...snapshot,
            machine: metric,
            machineHistory: append(snapshot.machineHistory, metric),
          };
        }
        if (isApiMetric(metric)) return { ...snapshot, api: metric };
        return { ...snapshot, database: metric };
      }, EMPTY_METRICS),
    );
  }
}

function append(history: MachineMetrics[], value: MachineMetrics): MachineMetrics[] {
  return [...history, value].slice(-HISTORY_LIMIT);
}

function isMachineMetric(metric: TelemetryMetric): metric is MachineMetrics {
  return 'cpuLoad' in metric;
}

function isApiMetric(metric: TelemetryMetric): metric is ApiMetrics {
  return 'rps' in metric;
}
