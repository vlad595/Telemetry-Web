import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnomalyDto,
  DailyPeakDto,
  DiskConsumptionDto,
  DynamicAnalyticsRequest,
  HealthScoreDto,
  NetworkTrendDto,
  MetricTimelinePoint,
  MetricSnapshot,
  MetricTimeRange,
} from '../models/analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.analyticsApiUrl}/api/analytics`;

  getPeaks(agentId: string, daysAgo = 7): Observable<DailyPeakDto[]> {
    return this.http.get<DailyPeakDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/peaks`, {
      params: new HttpParams().set('daysAgo', daysAgo),
    });
  }

  getNetworkTrends(agentId: string, hoursAgo = 24): Observable<NetworkTrendDto[]> {
    return this.http.get<NetworkTrendDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/network-trends`, {
      params: new HttpParams().set('hoursAgo', hoursAgo),
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

  getDiskConsumption(agentId: string, daysAgo = 30): Observable<DiskConsumptionDto> {
    return this.http.get<DiskConsumptionDto>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/disk-consumption`, {
      params: new HttpParams().set('daysAgo', daysAgo),
    });
  }

  getHealthScore(agentId: string, hoursAgo = 24): Observable<HealthScoreDto> {
    return this.http.get<HealthScoreDto>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/health-score`, {
      params: new HttpParams().set('hoursAgo', hoursAgo),
    });
  }

  getAnomalies(agentId: string, hoursAgo = 24): Observable<AnomalyDto[]> {
    return this.http.get<AnomalyDto[]>(`${this.baseUrl}/agent/${encodeURIComponent(agentId)}/anomalies`, {
      params: new HttpParams().set('hoursAgo', hoursAgo),
    });
  }

  getCustom(request: DynamicAnalyticsRequest): Observable<Record<string, unknown>[]> {
    return this.http.post<Record<string, unknown>[]>(`${this.baseUrl}/custom`, request);
  }
}
