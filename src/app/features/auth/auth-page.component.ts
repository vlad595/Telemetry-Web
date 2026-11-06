import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<AuthMode>('login');
  readonly busy = signal(false);
  readonly error = signal('');

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly registerForm = new FormGroup({
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  selectMode(mode: AuthMode): void {
    this.error.set('');
    this.mode.set(mode);
  }

  submit(): void {
    this.error.set('');
    if (this.mode() === 'login') {
      if (this.loginForm.invalid) {
        this.loginForm.markAllAsTouched();
        return;
      }
      this.busy.set(true);
      this.auth
        .login(this.loginForm.getRawValue())
        .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => void this.router.navigateByUrl('/dashboard'),
          error: (error: unknown) => this.error.set(errorMessage(error)),
        });
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.auth
      .register(this.registerForm.getRawValue())
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigateByUrl('/dashboard'),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) return error.error;
    if (typeof error.error?.message === 'string') return error.error.message;
    return `The request failed (${error.status || 'network error'}).`;
  }
  return 'The request failed. Please try again.';
}
