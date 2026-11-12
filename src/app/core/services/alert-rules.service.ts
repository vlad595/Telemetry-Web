import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertRuleResponse } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AlertRulesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.authApiUrl;

  list(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/alert-rules`);
  }

  add(rule: string): Observable<AlertRuleResponse> {
    return this.http.post<AlertRuleResponse>(`${this.baseUrl}/api/alert-rules`, { rule });
  }

  remove(rule: string): Observable<AlertRuleResponse> {
    return this.http.delete<AlertRuleResponse>(`${this.baseUrl}/api/alert-rules`, { body: { rule } });
  }
}
