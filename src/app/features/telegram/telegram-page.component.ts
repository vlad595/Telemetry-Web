import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, switchMap } from 'rxjs';
import { AlertRulesService } from '../../core/services/alert-rules.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-telegram-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './telegram-page.component.html',
  styleUrl: './telegram-page.component.css',
})
export class TelegramPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly alertRules = inject(AlertRulesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly connected = signal(false);
  readonly link = signal('');
  readonly error = signal('');
  readonly message = signal('');
  readonly rules = signal<string[]>([]);
  readonly rulesBusy = signal(false);
  readonly ruleError = signal('');
  readonly ruleMessage = signal('');

  readonly fieldOptions = [
    { value: 'CpuLoad', label: 'CPU load' },
    { value: 'RamLoad', label: 'RAM load' },
    { value: 'TotalRam', label: 'Total RAM' },
    { value: 'FreeDiskSpace', label: 'Free disk space' },
    { value: 'WiFiRx', label: 'Network received' },
    { value: 'WiFiTx', label: 'Network sent' },
    { value: 'OpenSockets', label: 'Open sockets' },
    { value: 'ReadingSpeed', label: 'Disk read speed' },
    { value: 'WritingSpeed', label: 'Disk write speed' },
  ];
  readonly operators = ['>', '>=', '<', '<=', '==', '!='];
  selectedField = 'CpuLoad';
  selectedOperator = '>';
  threshold: number | null = null;

  ngOnInit(): void {
    this.refreshStatus();
  }

  refreshStatus(): void {
    if (this.busy()) return;
    this.error.set('');
    this.loading.set(true);
    this.auth.currentUser().pipe(
      switchMap((user) => forkJoin({
        connection: this.auth.telegramConnection(user.id),
        rules: this.alertRules.list(),
      })),
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    )
      .subscribe({
        next: ({ connection, rules }) => {
          const isConnected = !!connection?.telegramChatId;
          this.connected.set(isConnected);
          this.rules.set(rules);
          if (isConnected) {
            this.link.set('');
            this.message.set(rules.length
              ? 'Telegram is connected. Matching metrics can now trigger alerts.'
              : 'Telegram is connected. Add a rule below to receive alerts.');
          } else if (this.link()) {
            this.message.set('Not connected yet. Open the bot and tap Start, then check again.');
          } else {
            this.message.set('');
          }
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not check Telegram connection.')),
      });
  }

  generateLink(): void {
    if (this.busy()) return;
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    this.auth.generateTelegramLink()
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (link) => {
          this.link.set(link);
          this.message.set('Open the bot and tap Start. This link expires in 10 minutes.');
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not create a Telegram link.')),
      });
  }

  disconnect(): void {
    if (this.busy()) return;
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    this.auth.disconnectTelegram()
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.connected.set(false);
          this.rules.set(response.rules);
          this.link.set('');
          this.message.set('Telegram disconnected.');
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not disconnect Telegram.')),
      });
  }

  addRule(): void {
    if (this.rulesBusy() || this.loading()) return;
    this.ruleError.set('');
    this.ruleMessage.set('');
    if (this.threshold === null || !Number.isFinite(this.threshold)) {
      this.ruleError.set('Enter a valid number.');
      return;
    }

    const rule = `${this.selectedField} ${this.selectedOperator} ${this.threshold}`;
    if (this.rules().includes(rule)) {
      this.ruleError.set('This rule already exists.');
      return;
    }

    this.rulesBusy.set(true);
    this.alertRules.add(rule)
      .pipe(finalize(() => this.rulesBusy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rules.set(response.rules);
          this.threshold = null;
          this.ruleMessage.set('Rule added.');
          if (this.connected()) this.message.set('Telegram is connected. Matching metrics can now trigger alerts.');
        },
        error: (error: unknown) => this.ruleError.set(requestError(error, 'Could not add rule.')),
      });
  }

  removeRule(rule: string): void {
    if (this.rulesBusy()) return;
    this.ruleError.set('');
    this.ruleMessage.set('');
    this.rulesBusy.set(true);
    this.alertRules.remove(rule)
      .pipe(finalize(() => this.rulesBusy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rules.set(response.rules);
          this.ruleMessage.set('Rule removed.');
          if (this.connected() && response.rules.length === 0) {
            this.message.set('Telegram is connected. Add a rule below to receive alerts.');
          }
        },
        error: (error: unknown) => this.ruleError.set(requestError(error, 'Could not remove rule.')),
      });
  }
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    return `${fallback} (${error.status || 'network error'}).`;
  }
  return error instanceof Error ? error.message : fallback;
}
