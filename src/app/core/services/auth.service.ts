import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserContext } from '../models/auth.models';

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
