import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InstanceService } from '../../core/services/instance.service';
import { MetricsStreamService } from '../../core/services/metrics-stream.service';
import { environment } from '../../../environments/environment';

type AgentPlatform = 'linux' | 'windows';
type SetupPhase = 'idle' | 'generated' | 'connecting' | 'waiting' | 'saving' | 'save-error' | 'stream-error' | 'complete';

const AGENT_RELEASE = 'v1.0.5';
const RELEASE_PAGE = `https://raw.githubusercontent.com/vlad595/TelemetryCollector-Service/main/install.ps1`;

@Component({
  selector: 'app-setup-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './setup-page.component.html',
  styleUrl: './setup-page.component.css',
})
export class SetupPageComponent implements OnInit, OnDestroy {
  private readonly instances = inject(InstanceService);
  private readonly stream = inject(MetricsStreamService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly error = signal('');
  readonly command = signal('');
  readonly agentId = signal('');
  readonly copied = signal(false);
  readonly phase = signal<SetupPhase>('idle');

  readonly releasePage = RELEASE_PAGE;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    platform: new FormControl<AgentPlatform>('linux', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.stream.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.type !== 'metric' || !['connecting', 'waiting'].includes(this.phase())) return;
      if (event.metric.instanceId.toLowerCase() !== this.agentId().toLowerCase()) return;

      this.saveInstanceAfterFirstMetric();
    });
  }

  ngOnDestroy(): void {
    if (this.phase() !== 'complete') void this.stream.disconnect();
  }

  generateCommand(): void {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const id = crypto.randomUUID();
    this.agentId.set(id);
    this.command.set(buildInstallCommand(values.platform, 'http://localhost:5289/api/telemetry/ingest', id));
    this.phase.set('generated');
  }

  async copyCommand(): Promise<void> {
    if (!this.command()) return;
    this.error.set('');

    try {
      if (!navigator.clipboard) throw new Error('Clipboard is unavailable in this browser.');
      await navigator.clipboard.writeText(this.command());
      this.copied.set(true);
      await this.connectAndWait();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Could not copy the command.');
    }
  }

  async startWaiting(): Promise<void> {
    await this.connectAndWait();
  }

  retrySave(): void {
    this.saveInstanceAfterFirstMetric();
  }

  private async connectAndWait(): Promise<void> {
    const id = this.agentId();
    if (!id || this.phase() === 'saving' || this.phase() === 'complete') return;

    this.error.set('');
    this.phase.set('connecting');
    await this.stream.connect(id);

    if (['saving', 'save-error', 'complete'].includes(this.phase())) return;
    if (this.stream.status() === 'error') {
      this.phase.set('stream-error');
      this.error.set('Could not connect to the metrics Hub. Check the API address and try again.');
      return;
    }

    this.phase.set('waiting');
  }

  private saveInstanceAfterFirstMetric(): void {
    if (this.phase() === 'saving' || this.phase() === 'complete') return;

    this.phase.set('saving');
    const { name } = this.form.getRawValue();
    this.instances
      .create({ id: this.agentId(), name: name.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (instance) => {
          this.phase.set('complete');
          void this.router.navigate(['/dashboard'], { queryParams: { instanceId: instance.id } });
        },
        error: (error: unknown) => {
          this.phase.set('save-error');
          this.error.set(errorMessage(error));
        },
      });
  }
}

function buildInstallCommand(platform: AgentPlatform, apiUrl: string, agentId: string): string {
  if (platform === 'windows') {
    return buildWindowsCommand(RELEASE_PAGE, apiUrl, agentId);
  }
  return buildLinuxCommand(RELEASE_PAGE, apiUrl, agentId);
}

function buildWindowsCommand(assetUrl: string, apiUrl: string, agentId: string): string {
  return `& ([scriptblock]::Create((Invoke-RestMethod '${assetUrl}'))) -ApiUrl '${apiUrl}' -AgentId '${agentId}'`;
}

function buildLinuxCommand(assetUrl: string, apiUrl: string, agentId: string): string {
  return `curl -fsSL ${assetUrl} | sudo bash -s -- '${apiUrl}' '${agentId}'`;
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) return error.error;
    return `Could not create the instance (${error.status || 'network error'}).`;
  }
  return 'Could not create the instance. Please try again.';
}
