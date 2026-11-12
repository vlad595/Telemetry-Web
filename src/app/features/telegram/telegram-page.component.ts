import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-telegram-page',
  standalone: true,
  templateUrl: './telegram-page.component.html',
  styleUrl: './telegram-page.component.css',
})
export class TelegramPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly connected = signal(false);
  readonly link = signal('');
  readonly error = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    this.refreshStatus();
  }

  refreshStatus(): void {
    if (this.busy()) return;
    this.error.set('');
    this.loading.set(true);
    this.auth.currentUser()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          const isConnected = !!user.telegramChatId && user.telegramChatId !== 'null';
          this.connected.set(isConnected);
          if (isConnected) {
            this.link.set('');
            this.message.set('Telegram is connected. You can now receive alerts.');
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
        next: () => {
          this.connected.set(false);
          this.link.set('');
          this.message.set('Telegram disconnected.');
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not disconnect Telegram.')),
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
