import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { UserContext } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  selector: 'app-about-page',
  standalone: true,
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.css',
})
export class AboutPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly workspaces = inject(WorkspaceService);

  readonly user = signal<UserContext | null>(null);
  readonly loading = signal(true);
  readonly deleting = signal(false);
  readonly confirming = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.auth.currentUser()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => this.user.set(user),
        error: (error: unknown) => this.error.set(requestError(error, 'Could not load your account.')),
      });
  }

  showDeleteConfirmation(): void {
    if (!this.user() || this.deleting()) return;
    this.error.set('');
    this.confirming.set(true);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.confirming.set(false);
    this.error.set('');
  }

  deleteAccount(): void {
    const user = this.user();
    if (!user || !this.confirming() || this.deleting()) return;

    this.error.set('');
    this.deleting.set(true);
    this.auth.deleteAccount(user.id)
      .pipe(finalize(() => this.deleting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.workspaces.selectWorkspace(null);
          this.auth.logout();
          void this.router.navigateByUrl('/auth');
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not delete your account.')),
      });
  }
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.message === 'string') return error.error.message;
    return `${fallback} (${error.status || 'network error'}).`;
  }
  return fallback;
}
