import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertRuleResponse, AuthResponse, LoginRequest, RegisterRequest, UserContext } from '../models/auth.models';

const TOKEN_STORAGE_KEY = 'telemetry.jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = environment.authApiUrl;

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/user/login`, request)
      .pipe(tap((response) => this.saveToken(response.token)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/user/reg`, request)
      .pipe(tap((response) => this.saveToken(response.token)));
  }

  currentUser(): Observable<UserContext> {
    return this.http.get<UserContext>(`${this.baseUrl}/api/user/me`);
  }

  generateTelegramLink(): Observable<string> {
    return this.http.post(`${this.baseUrl}/api/user/telegram`, null, { responseType: 'text' }).pipe(
      map((response) => {
        const link = response.trim().startsWith('"') ? JSON.parse(response) as string : response.trim();
        if (!link.startsWith('https://t.me/')) throw new Error('Auth API returned an invalid Telegram link.');
        return link;
      }),
    );
  }

  telegramConnection(userId: string): Observable<AlertRuleResponse | null> {
    return this.http.get<AlertRuleResponse>(`${this.baseUrl}/api/user/telegram/user=${encodeURIComponent(userId)}`).pipe(
      catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 404
        ? of(null)
        : throwError(() => error)),
    );
  }

  disconnectTelegram(): Observable<AlertRuleResponse> {
    return this.http.delete<AlertRuleResponse>(`${this.baseUrl}/api/user/telegram/delete-connection`);
  }

  token(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  }

  isAuthenticated(): boolean {
    return this.token() !== null;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  private saveToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}
