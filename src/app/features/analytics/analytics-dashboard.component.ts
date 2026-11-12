import { isPlatformBrowser, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewChecked, AfterViewInit, Component, DestroyRef, ElementRef, inject, Injector, Input, OnDestroy, OnInit, PLATFORM_ID, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { auditTime, catchError, distinctUntilChanged, forkJoin, finalize, map, of, startWith, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { AnalyticsGroupingInterval, AnomalyDto, CustomAnalyticsPoint, CustomMetricRule, DailyPeakDto, DiskConsumptionDto, DynamicAnalyticsRequest, HealthScoreDto, MetricAggregation, MetricSnapshot, NetworkTrendDto } from '../../core/models/analytics.models';
import { Instance } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { InstanceService } from '../../core/services/instance.service';
import { WorkspaceService } from '../../core/services/workspace.service';

Chart.register(...registerables);

interface DashboardData {
  peaks: DailyPeakDto[];
  networkTrends: NetworkTrendDto[];
  diskConsumption: DiskConsumptionDto;
  healthScore: HealthScoreDto;
  anomalies: AnomalyDto[];
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.css',
})
export class AnalyticsDashboardComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  private readonly api = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly instancesApi = inject(InstanceService);
  private readonly workspaces = inject(WorkspaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly agentRequests = new Subject<string>();
  private readonly cancelCustomRequest = new Subject<void>();
  private readonly snapshotRequests = new Subject<{ agentId: string; at: number } | null>();
  private readonly rangeRequests = new Subject<string>();

  /** Optional initial agent; the page also accepts /analytics?agentId={id}. */
  @Input() agentId: string | null = null;
  readonly instances = signal<Instance[]>([]);
  readonly selectedAgentId = signal('');
  readonly data = signal<DashboardData | null>(null);
  readonly snapshot = signal<MetricSnapshot | null>(null);
  readonly snapshotLoading = signal(false);
  readonly snapshotError = signal('');
  readonly timeRangeLoading = signal(false);
  readonly selectedTimestamp = signal(Date.now());
  readonly timePosition = signal(1000);
  readonly timelineStart = signal(Date.now());
  readonly timelineEnd = signal(Date.now());
  readonly customPoints = signal<CustomAnalyticsPoint[]>([]);
  readonly loading = signal(true);
  readonly customLoading = signal(false);
  readonly error = signal('');
  readonly customError = signal('');
  readonly maxHistoryHours = signal(168);
  readonly customHours = signal(24);
  readonly customGrouping = signal<AnalyticsGroupingInterval>(AnalyticsGroupingInterval.Hour);
  readonly customRules = signal<CustomMetricRule[]>([
    { metricName: 'MemoryUsage', aggregation: MetricAggregation.Avg, alias: 'AverageRAM' },
    { metricName: 'CpuUsage', aggregation: MetricAggregation.P95, alias: 'PeakCPU' },
  ]);
  readonly groupingOptions = [
    { value: AnalyticsGroupingInterval.Min, label: 'Minute' },
    { value: AnalyticsGroupingInterval.FiveMinutes, label: '5 minutes' },
    { value: AnalyticsGroupingInterval.Hour, label: 'Hour' },
    { value: AnalyticsGroupingInterval.Day, label: 'Day' },
  ];
  readonly aggregationOptions = [
    { value: MetricAggregation.Avg, label: 'Average' },
    { value: MetricAggregation.Max, label: 'Maximum' },
    { value: MetricAggregation.P95, label: 'P95' },
    { value: MetricAggregation.Sum, label: 'Sum' },
  ];
  readonly selectedAgent = () => this.instances().find((agent) => agent.id === this.selectedAgentId()) ?? null;

  @ViewChild('peaksCanvas') private peaksCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('networkCanvas') private networkCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('customCanvas') private customCanvas?: ElementRef<HTMLCanvasElement>;

  private peaksChart?: Chart<'line', number[], string>;
  private networkChart?: Chart<'bar', number[], string>;
  private customChart?: Chart<'line', number[], string>;
  private requestedAgentId = '';

  ngOnInit(): void {
    this.requestedAgentId = this.agentId ?? this.route.snapshot.queryParamMap.get('agentId') ?? '';

    this.auth.currentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        const maxHours = user.subscriptionLevel === 0 ? 168 : 24;
        this.maxHistoryHours.set(maxHours);
        if (this.customHours() > maxHours) this.customHours.set(maxHours);
      },
      error: () => this.error.set('Could not verify your subscription.'),
    });

    this.agentRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.data.set(null);
          this.customPoints.set([]);
          this.customError.set('');
          this.cancelCustomRequest.next();
          this.destroyCharts();
        }),
        switchMap((agentId) => {
          if (!agentId) return of(null);
          return forkJoin({
            peaks: this.api.getPeaks(agentId, 1),
            networkTrends: this.api.getNetworkTrends(agentId, 24),
            diskConsumption: this.api.getDiskConsumption(agentId, 1),
            healthScore: this.api.getHealthScore(agentId, 24),
            anomalies: this.api.getAnomalies(agentId, 24),
          }).pipe(
            catchError((error: unknown) => {
              this.error.set(requestError(error, 'Could not load analytics for this agent.'));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        this.data.set(result);
        this.renderCharts();
      });

    this.snapshotRequests
      .pipe(
        auditTime(100),
        distinctUntilChanged((previous, current) => previous === null || current === null
          ? previous === current
          : previous.agentId === current.agentId && previous.at === current.at),
        tap((request) => {
          this.snapshotLoading.set(request !== null);
          if (request) this.snapshotError.set('');
        }),
        switchMap((request) => request ? this.api.getSnapshot(request.agentId, new Date(request.at).toISOString()).pipe(
          catchError((error: unknown) => {
            this.snapshotError.set(requestError(error, 'Could not load metrics at this time.'));
            return of(null);
          }),
        ) : of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((snapshot) => {
        this.snapshot.set(snapshot);
        this.snapshotLoading.set(false);
      });

    this.rangeRequests
      .pipe(
        tap(() => {
          this.timeRangeLoading.set(true);
          this.snapshotError.set('');
        }),
        switchMap((agentId) => this.api.getTimeRange(agentId).pipe(
          catchError((error: unknown) => {
            this.snapshotError.set(requestError(error, 'Could not load the available metric time range.'));
            return of(null);
          }),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((range) => {
        this.timeRangeLoading.set(false);
        if (!range) return;
        const start = new Date(range.startTimestamp).getTime();
        const end = new Date(range.endTimestamp).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          this.snapshotError.set('The analytics API returned an invalid metric time range.');
          return;
        }
        this.timelineStart.set(start);
        this.timelineEnd.set(end);
        this.timePosition.set(1000);
        this.selectedTimestamp.set(end);
        const agentId = this.selectedAgentId();
        if (agentId) this.snapshotRequests.next({ agentId, at: end });
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.requestedAgentId = this.agentId ?? params.get('agentId') ?? '';
        const requested = this.instances().find((instance) => sameId(instance.id, this.requestedAgentId));
        if (requested && requested.id !== this.selectedAgentId()) this.setAgent(requested.id, false);
      });

    toObservable(this.workspaces.selectedWorkspaceId, { injector: this.injector })
      .pipe(
        startWith(this.workspaces.selectedWorkspaceId()),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.instances.set([]);
          this.selectedAgentId.set('');
          this.data.set(null);
          this.snapshot.set(null);
          this.timeRangeLoading.set(false);
          this.customPoints.set([]);
          this.customError.set('');
          this.agentRequests.next('');
          this.cancelCustomRequest.next();
          this.destroyCharts();
        }),
        switchMap((workspaceId) => (workspaceId
          ? this.instancesApi.listWorkspace(workspaceId)
          : this.instancesApi.listMine()).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(requestError(error, 'Could not load agents.'));
              return of(null);
            }),
          )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((instances) => {
        if (!instances) return;
        this.instances.set(instances);
        const requested = instances.find((item) => sameId(item.id, this.requestedAgentId));
        const initial = requested ?? instances[0];
        if (initial) this.setAgent(initial.id, !requested);
        else this.loading.set(false);
      });
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngAfterViewChecked(): void {
    const result = this.data();
    // @if creates canvases after data changes. Retry after the view has rendered so
    // charts appear on first page load without requiring a custom query interaction.
    if (result && ((result.peaks.length > 0 && !this.peaksChart) || (result.networkTrends.length > 0 && !this.networkChart))) {
      this.renderCharts();
    }
    if (this.customPoints().length > 0 && !this.customChart) this.renderCustomChart();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  selectAgent(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.setAgent(id, true);
  }

  runCustomExample(): void {
    const agentId = this.selectedAgentId();
    if (!agentId || this.customLoading()) return;
    this.customLoading.set(true);
    this.customError.set('');
    this.customPoints.set([]);
    this.customChart?.destroy();
    this.customChart = undefined;

    const request: DynamicAnalyticsRequest = {
      agentId,
      hoursAgo: this.customHours(),
      groupingInterval: this.customGrouping(),
      rules: this.customRules().filter((rule) => rule.metricName.trim() && rule.alias.trim()),
    };
    if (!request.rules.length) {
      this.customError.set('Add at least one metric rule with a metric name and alias.');
      this.customLoading.set(false);
      return;
    }
    this.api.getCustom(request)
      .pipe(
        map((rows) => rows.map((row) => ({
          period: String(readIgnoreCase(row, 'Period') ?? ''),
          values: Object.fromEntries(request.rules.map((rule) => [rule.alias, Number(readIgnoreCase(row, rule.alias) ?? 0)])),
        }))),
        takeUntil(this.cancelCustomRequest),
        finalize(() => this.customLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (points) => {
          this.customPoints.set(points);
          this.renderCustomChart();
        },
        error: (error: unknown) => {
          this.customError.set(requestError(error, 'Custom analytics request failed.'));
        },
      });
  }

  setTimePosition(event: Event): void {
    const position = Number((event.target as HTMLInputElement).value);
    this.timePosition.set(position);
    const rangeMs = this.timelineEnd() - this.timelineStart();
    const at = this.timelineStart() + (rangeMs * position / 1000);
    this.selectedTimestamp.set(at);
    const agentId = this.selectedAgentId();
    if (agentId) this.snapshotRequests.next({ agentId, at });
  }

  oldestTimestamp(): number {
    return this.timelineStart();
  }

  updateRule(index: number, key: 'metricName' | 'alias' | 'aggregation', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.customRules.update((rules) => rules.map((rule, i) => {
      if (i !== index) return rule;
      if (key === 'aggregation') return { ...rule, aggregation: Number(value) as MetricAggregation };
      if (key === 'metricName') return { ...rule, metricName: value };
      return { ...rule, alias: value };
    }));
  }

  setCustomGrouping(event: Event): void {
    this.customGrouping.set(Number((event.target as HTMLSelectElement).value) as AnalyticsGroupingInterval);
  }

  addRule(): void {
    this.customRules.update((rules) => [...rules, { metricName: '', aggregation: MetricAggregation.Avg, alias: '' }]);
  }

  removeRule(index: number): void {
    this.customRules.update((rules) => rules.filter((_, i) => i !== index));
  }

  healthPercent(): string {
    const value = this.data()?.healthScore.healthPercentage;
    return value == null ? '—' : `${value.toFixed(1)}%`;
  }

  private setAgent(agentId: string, updateUrl: boolean): void {
    if (!agentId) return;
    const changed = agentId !== this.selectedAgentId();
    this.selectedAgentId.set(agentId);
    if (updateUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { agentId },
        queryParamsHandling: 'merge',
      });
    }
    if (changed) {
      this.cancelCustomRequest.next();
      this.agentRequests.next(agentId);
      this.snapshot.set(null);
      this.snapshotError.set('');
      this.snapshotRequests.next(null);
      const now = Date.now();
      this.timelineStart.set(now);
      this.timelineEnd.set(now);
      this.selectedTimestamp.set(now);
      this.timePosition.set(1000);
      this.timeRangeLoading.set(true);
      this.rangeRequests.next(agentId);
    }
  }

  private renderCharts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const result = this.data();
    if (!result) return;
    const chartOptions = { responsive: true, maintainAspectRatio: false } as const;
    if (result.peaks.length > 0 && this.peaksCanvas?.nativeElement && !this.peaksChart) {
      this.peaksChart = new Chart(this.peaksCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: result.peaks.map((item) => item.period),
          datasets: [
            { label: 'P95 CPU', data: result.peaks.map((item) => item.p95Cpu), borderColor: '#315e58', tension: 0.2 },
            { label: 'P95 Memory', data: result.peaks.map((item) => item.p95Memory), borderColor: '#8a9b68', tension: 0.2 },
          ],
        },
        options: chartOptions,
      });
    }
    if (result.networkTrends.length > 0 && this.networkCanvas?.nativeElement && !this.networkChart) {
      this.networkChart = new Chart(this.networkCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: result.networkTrends.map((item) => item.period),
          datasets: [
            { label: 'Received MB', data: result.networkTrends.map((item) => item.totalRxMegabytes), backgroundColor: '#315e58' },
            { label: 'Transmitted MB', data: result.networkTrends.map((item) => item.totalTxMegabytes), backgroundColor: '#8a9b68' },
          ],
        },
        options: chartOptions,
      });
    }
  }

  private renderCustomChart(): void {
    if (!isPlatformBrowser(this.platformId) || !this.customCanvas?.nativeElement || this.customPoints().length === 0) return;
    this.customChart?.destroy();
    this.customChart = new Chart(this.customCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: this.customPoints().map((item) => item.period),
        datasets: [
          ...Object.keys(this.customPoints()[0].values).map((alias, index) => ({
            label: alias,
            data: this.customPoints().map((item) => item.values[alias] ?? 0),
            borderColor: ['#315e58', '#8a9b68', '#5779a1', '#a16f48'][index % 4],
          })),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { type: 'linear', position: 'left' } },
      },
    });
  }

  private destroyCharts(): void {
    this.peaksChart?.destroy();
    this.networkChart?.destroy();
    this.customChart?.destroy();
    this.peaksChart = undefined;
    this.networkChart = undefined;
    this.customChart = undefined;
  }
}

function sameId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.message === 'string') return error.error.message;
    return `${fallback} (${error.status || 'network error'}).`;
  }
  return fallback;
}

function readIgnoreCase(row: Record<string, unknown>, property: string): unknown {
  const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === property.toLowerCase());
  return key ? row[key] : undefined;
}
