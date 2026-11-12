import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, from, of, startWith, switchMap, tap } from 'rxjs';
import { Instance } from '../../core/models/auth.models';
import { EMPTY_METRICS, MetricsGroupingService } from '../../core/services/metrics-grouping.service';
import { InstanceService } from '../../core/services/instance.service';
import { MetricsStreamService } from '../../core/services/metrics-stream.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { LiveMetricChartComponent } from './live-metric-chart.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, LiveMetricChartComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly instancesApi = inject(InstanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly grouping = inject(MetricsGroupingService);
  private readonly stream = inject(MetricsStreamService);
  private readonly workspaces = inject(WorkspaceService);
  private readonly workspaceId$ = toObservable(this.workspaces.selectedWorkspaceId);

  readonly instances = signal<Instance[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly status = this.stream.status;
  readonly snapshot = toSignal(this.grouping.group(this.stream.events$), { initialValue: EMPTY_METRICS });
  readonly coreIds = computed(() => (this.snapshot().machine?.cpuCoreLoads ?? [])
    .map((core) => core.coreId)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true })));

  ngOnInit(): void {
    this.workspaceId$
      .pipe(
        startWith(this.workspaces.selectedWorkspaceId()),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.instances.set([]);
          this.selectedId.set('');
        }),
        switchMap((workspaceId) =>
          from(this.stream.disconnect()).pipe(
            switchMap(() =>
              (workspaceId ? this.instancesApi.listWorkspace(workspaceId) : this.instancesApi.listMine()).pipe(
                catchError((error: unknown) => {
                  this.error.set(error instanceof Error ? error.message : 'Could not load instances.');
                  return of(null);
                }),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (instances) => {
          this.loading.set(false);
          if (!instances) return;

          this.instances.set(instances);
          if (instances.length === 0) {
            this.selectInstanceId('');
            return;
          }

          const preferredId = this.route.snapshot.queryParamMap.get('instanceId');
          const preferred = instances.find((instance) => instance.id.toLowerCase() === preferredId?.toLowerCase());
          this.selectInstanceId((preferred ?? instances[0]).id);
        },
      });
  }

  ngOnDestroy(): void {
    void this.stream.disconnect();
  }

  selectInstance(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectInstanceId(id);
  }

  selectInstanceId(id: string): void {
    this.selectedId.set(id);
    if (id) void this.stream.connect(id);
    else void this.stream.disconnect();
  }

}
