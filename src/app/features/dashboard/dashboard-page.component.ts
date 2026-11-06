import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Instance } from '../../core/models/auth.models';
import { EMPTY_METRICS, MetricsGroupingService } from '../../core/services/metrics-grouping.service';
import { InstanceService } from '../../core/services/instance.service';
import { MetricsStreamService } from '../../core/services/metrics-stream.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly instancesApi = inject(InstanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly grouping = inject(MetricsGroupingService);
  private readonly stream = inject(MetricsStreamService);

  readonly instances = signal<Instance[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly status = this.stream.status;
  readonly snapshot = toSignal(this.grouping.group(this.stream.events$), { initialValue: EMPTY_METRICS });

  ngOnInit(): void {
    this.instancesApi
      .listMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (instances) => {
          this.instances.set(instances);
          this.loading.set(false);
          if (instances.length > 0) {
            const preferredId = this.route.snapshot.queryParamMap.get('instanceId');
            const preferred = instances.find((instance) => instance.id.toLowerCase() === preferredId?.toLowerCase());
            this.selectInstanceId((preferred ?? instances[0]).id);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error instanceof Error ? error.message : 'Could not load instances.');
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

  percent(value: number): number {
    return Math.round(value * 100);
  }

  points(values: number[]): string {
    if (values.length === 0) return '0,30 100,30';
    const max = Math.max(1, ...values);
    return values
      .map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 30 - (value / max) * 26;
        return `${x},${y}`;
      })
      .join(' ');
  }

  bytesPerSecond(value: number): string {
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB/s`;
    return `${Math.round(value)} B/s`;
  }
}
