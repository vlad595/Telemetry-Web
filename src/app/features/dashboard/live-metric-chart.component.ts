import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, Input, OnChanges, OnDestroy, PLATFORM_ID, ViewChild } from '@angular/core';
import { Chart, ChartDataset, registerables } from 'chart.js';
import { MachineMetrics } from '../../core/models/telemetry.models';

Chart.register(...registerables);

export type LiveChartKind = 'cpu' | 'core' | 'ram' | 'sockets' | 'wifi' | 'disk' | 'diskIo';

interface MetricSeries {
  label: string;
  color: string;
  value: (metric: MachineMetrics) => number | null;
}

@Component({
  selector: 'app-live-metric-chart',
  standalone: true,
  template: `
    <article class="chart-card">
      <div class="chart-heading">
        <div>
          <p class="eyebrow">{{ eyebrow }}</p>
          <h3>{{ title }}</h3>
        </div>
        <strong>{{ currentValue }}</strong>
      </div>
      <p class="subtitle">{{ subtitle }}</p>
      <div class="chart-frame">
        <canvas #canvas role="img" [attr.aria-label]="title + ' live history'"></canvas>
      </div>
    </article>
  `,
  styles: [
    ':host { display: block; min-width: 0; }',
    '.chart-card { height: 100%; min-width: 0; padding: 18px; border: 1px solid var(--border); background: var(--surface); }',
    '.chart-heading { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }',
    '.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .1em; }',
    'h3 { margin: 0; font-size: 17px; }',
    'strong { color: var(--ink); font-size: 19px; font-weight: 700; text-align: right; }',
    '.subtitle { min-height: 17px; margin: 8px 0 14px; color: var(--muted); font-size: 12px; }',
    '.chart-frame { position: relative; width: 100%; height: 220px; }',
    '@media (max-width: 580px) { .chart-card { padding: 14px; } .chart-frame { height: 190px; } }',
  ],
})
export class LiveMetricChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private chart?: Chart<'line', (number | null)[], string>;

  @Input({ required: true }) kind!: LiveChartKind;
  @Input({ required: true }) history: MachineMetrics[] = [];
  @Input() coreId = '';
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  get title(): string {
    switch (this.kind) {
      case 'cpu': return 'Total CPU';
      case 'core': return `Core ${this.coreId}`;
      case 'ram': return 'Memory';
      case 'sockets': return 'Open sockets';
      case 'wifi': return 'Wi-Fi traffic';
      case 'disk': return 'Free disk space';
      case 'diskIo': return 'Disk I/O';
    }
  }

  get eyebrow(): string {
    switch (this.kind) {
      case 'cpu': case 'core': return 'PROCESSOR';
      case 'ram': return 'MEMORY';
      case 'sockets': case 'wifi': return 'NETWORK';
      case 'disk': case 'diskIo': return 'STORAGE';
    }
  }

  get subtitle(): string {
    const latest = this.history.at(-1);
    switch (this.kind) {
      case 'cpu': return latest?.cpuName ?? 'Overall processor utilization';
      case 'core': return 'Individual core utilization';
      case 'ram': return `${(latest?.totalRam ?? 0).toLocaleString()} MB total`;
      case 'sockets': return 'Current open connections';
      case 'wifi': return 'Received and sent per second';
      case 'disk': return 'Available storage in MB';
      case 'diskIo': return 'Read and write per second';
    }
  }

  get currentValue(): string {
    const latest = this.history.at(-1);
    if (!latest) return '—';

    switch (this.kind) {
      case 'cpu': return `${Math.round(latest.cpuLoad * 100)}%`;
      case 'core': {
        const load = latest.cpuCoreLoads.find((core) => core.coreId === this.coreId)?.load;
        return load === undefined ? '—' : `${Math.round(load * 100)}%`;
      }
      case 'ram': return `${Math.round(latest.ramLoad * 100)}%`;
      case 'sockets': return latest.openSockets.toLocaleString();
      case 'wifi': return `↓ ${formatRate(latest.wifiRx)} · ↑ ${formatRate(latest.wifiTx)}`;
      case 'disk': return `${Math.round(latest.freeDiskSpace).toLocaleString()} MB`;
      case 'diskIo': return `R ${formatRate(latest.readingSpeed)} · W ${formatRate(latest.writingSpeed)}`;
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.canvas) return;

    this.chart = new Chart<'line', (number | null)[], string>(this.canvas.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this.kind === 'wifi' || this.kind === 'diskIo',
            position: 'bottom',
            labels: { usePointStyle: true, boxWidth: 8, color: '#64716c' },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatValue(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64716c', maxTicksLimit: 5, maxRotation: 0 },
          },
          y: {
            beginAtZero: this.kind !== 'disk',
            max: this.isPercent ? 100 : undefined,
            grid: { color: '#edf1ee' },
            ticks: { color: '#64716c', callback: (value) => this.formatValue(Number(value)) },
          },
        },
      },
    });
    this.updateChart();
  }

  ngOnChanges(): void {
    this.updateChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private get isPercent(): boolean {
    return this.kind === 'cpu' || this.kind === 'core' || this.kind === 'ram';
  }

  private updateChart(): void {
    if (!this.chart) return;

    this.chart.data.labels = this.history.map((metric, index) => {
      const timestamp = new Date(metric.timestamp);
      return Number.isNaN(timestamp.getTime())
        ? `#${index + 1}`
        : timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    this.chart.data.datasets = this.series().map((series): ChartDataset<'line', (number | null)[]> => ({
      label: series.label,
      data: this.history.map(series.value),
      borderColor: series.color,
      backgroundColor: series.color,
      borderWidth: 2,
      tension: 0.25,
      pointRadius: this.history.length === 1 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: false,
    }));
    this.chart.update('none');
  }

  private series(): MetricSeries[] {
    switch (this.kind) {
      case 'cpu': return [{ label: 'CPU', color: '#2c7865', value: (metric) => metric.cpuLoad * 100 }];
      case 'core': return [{
        label: `Core ${this.coreId}`,
        color: '#2d7fa0',
        value: (metric) => {
          const load = metric.cpuCoreLoads.find((core) => core.coreId === this.coreId)?.load;
          return load === undefined ? null : load * 100;
        },
      }];
      case 'ram': return [{ label: 'RAM', color: '#7f67ad', value: (metric) => metric.ramLoad * 100 }];
      case 'sockets': return [{ label: 'Sockets', color: '#ca7450', value: (metric) => metric.openSockets }];
      case 'wifi': return [
        { label: 'Received', color: '#2c7865', value: (metric) => metric.wifiRx },
        { label: 'Sent', color: '#2d7fa0', value: (metric) => metric.wifiTx },
      ];
      case 'disk': return [{ label: 'Free space', color: '#7f67ad', value: (metric) => metric.freeDiskSpace }];
      case 'diskIo': return [
        { label: 'Read', color: '#2c7865', value: (metric) => metric.readingSpeed },
        { label: 'Write', color: '#ca7450', value: (metric) => metric.writingSpeed },
      ];
    }
  }

  private formatValue(value: number | null): string {
    if (value === null) return '—';
    if (this.kind === 'wifi' || this.kind === 'diskIo') return formatRate(value);
    if (this.isPercent) return `${Math.round(value)}%`;
    if (this.kind === 'disk') return `${Math.round(value).toLocaleString()} MB`;
    return Math.round(value).toLocaleString();
  }
}

function formatRate(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${Math.round(bytesPerSecond)} B/s`;
}
