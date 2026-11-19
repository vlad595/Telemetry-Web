import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnalyticsGroupingInterval, MetricAggregation, HourlyPeakDto } from '../models/analytics.models';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AnalyticsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the existing custom route when the hourly peak route is unavailable', () => {
    const agentId = '11111111-1111-1111-1111-111111111111';
    let peaks: HourlyPeakDto[] | undefined;
    service.getPreviousDayPeaks(agentId, '2026-11-17T03:42:38Z').subscribe((result) => { peaks = result; });

    const unavailable = http.expectOne((request) => request.url.endsWith(`/agent/${agentId}/previous-day-peaks`));
    unavailable.flush(null, { status: 404, statusText: 'Not Found' });

    const custom = http.expectOne((request) => request.url.endsWith('/custom'));
    expect(custom.request.body).toEqual({
      agentId,
      hoursAgo: 24,
      at: '2026-11-17T00:00:00.000Z',
      groupingInterval: AnalyticsGroupingInterval.Hour,
      rules: [
        { metricName: 'CpuUsage', aggregation: MetricAggregation.P95, alias: 'P95Cpu' },
        { metricName: 'MemoryUsage', aggregation: MetricAggregation.P95, alias: 'P95Memory' },
      ],
    });
    custom.flush([
      { Period: '2026-11-16T00:00:00', P95Cpu: 0.2, P95Memory: 0.3 },
      { Period: '2026-11-16T23:00:00', P95Cpu: 0.4, P95Memory: 0.5 },
      { Period: '2026-11-17T00:00:00', P95Cpu: 0.6, P95Memory: 0.7 },
    ]);

    expect(peaks).toEqual([
      { period: '2026-11-16T00:00:00Z', p95Cpu: 0.2, p95Memory: 0.3 },
      { period: '2026-11-16T23:00:00Z', p95Cpu: 0.4, p95Memory: 0.5 },
    ]);
  });
});
