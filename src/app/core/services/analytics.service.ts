import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalyticsGroupingInterval,
  AnomalyDto,
  DailyPeakDto,
  HourlyPeakDto,
  DiskConsumptionDto,
  DynamicAnalyticsRequest,
  HealthScoreDto,
  MetricAggregation,
  NetworkTrendDto,
  MetricTimelinePoint,
  MetricSnapshot,
  MetricTimeRange,
} from '../models/analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.analyticsApiUrl}/api/analytics`;

  getPeaks(agentId: string, daysAgo = 7, at?: string): Observable<DailyPeakDto[]> {
    return this.http.get<DailyPeakDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/peaks`, {
      params: new HttpParams().set('daysAgo', daysAgo).set('at', at ?? new Date().toISOString()),
    });
  }

  getPreviousDayPeaks(agentId: string, at: string): Observable<HourlyPeakDto[]> {
    const selected = new Date(at);
    const end = Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), selected.getUTCDate());
    const start = end - 24 * 60 * 60 * 1000;
    return this.http.get<HourlyPeakDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/previous-day-peaks`, {
      params: new HttpParams().set('at', at),
    }).pipe(catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 404) return throwError(() => error);

      return this.getCustom({
        agentId,
        hoursAgo: 24,
        at: new Date(end).toISOString(),
        groupingInterval: AnalyticsGroupingInterval.Hour,
        rules: [
          { metricName: 'CpuUsage', aggregation: MetricAggregation.P95, alias: 'P95Cpu' },
          { metricName: 'MemoryUsage', aggregation: MetricAggregation.P95, alias: 'P95Memory' },
        ],
      }).pipe(map((rows) => rows.map((row) => {
        const rawPeriod = String(readIgnoreCase(row, 'Period') ?? '');
        const period = /(?:Z|[+-]\d{2}:\d{2})$/i.test(rawPeriod) ? rawPeriod : `${rawPeriod}Z`;
        return {
          period,
          p95Cpu: Number(readIgnoreCase(row, 'P95Cpu')),
          p95Memory: Number(readIgnoreCase(row, 'P95Memory')),
        };
      }).filter((peak) => {
        const time = Date.parse(peak.period);
        return time >= start && time < end && Number.isFinite(peak.p95Cpu) && Number.isFinite(peak.p95Memory);
      })));
    }));
  }

  getNetworkTrends(agentId: string, hoursAgo = 24, at?: string): Observable<NetworkTrendDto[]> {
    return this.http.get<NetworkTrendDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/network-trends`, {
      params: new HttpParams().set('hoursAgo', hoursAgo).set('at', at ?? new Date().toISOString()),
    });
  }

  getTimeline(agentId: string, hoursAgo: number, intervalMinutes: number): Observable<MetricTimelinePoint[]> {
    return this.http.get<MetricTimelinePoint[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/timeline`, {
      params: new HttpParams().set('hoursAgo', hoursAgo).set('intervalMinutes', intervalMinutes),
    });
  }

  getSnapshot(agentId: string, at: string): Observable<MetricSnapshot> {
    return this.http.get<MetricSnapshot>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/snapshot`, {
      params: new HttpParams().set('at', at),
    });
  }

  getTimeRange(agentId: string): Observable<MetricTimeRange> {
    return this.http.get<MetricTimeRange>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/time-range`);
  }

  getDiskConsumption(agentId: string, daysAgo = 30, at?: string): Observable<DiskConsumptionDto> {
    return this.http.get<DiskConsumptionDto>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/disk-consumption`, {
      params: new HttpParams().set('daysAgo', daysAgo).set('at', at ?? new Date().toISOString()),
    });
  }

  getHealthScore(agentId: string, hoursAgo = 24, at?: string): Observable<HealthScoreDto> {
    return this.http.get<HealthScoreDto>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/health-score`, {
      params: new HttpParams().set('hoursAgo', hoursAgo).set('at', at ?? new Date().toISOString()),
    });
  }

  getAnomalies(agentId: string, hoursAgo = 24, at?: string): Observable<AnomalyDto[]> {
    return this.http.get<AnomalyDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/anomalies`, {
      params: new HttpParams().set('hoursAgo', hoursAgo).set('at', at ?? new Date().toISOString()),
    });
  }

  getCustom(request: DynamicAnalyticsRequest): Observable<Record<string, unknown>[]> {
    return this.http.post<Record<string, unknown>[]>(`${this.baseUrl}/custom`, request);
  }
}

function readIgnoreCase(row: Record<string, unknown>, key: string): unknown {
  const match = Object.keys(row).find((name) => name.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
}
