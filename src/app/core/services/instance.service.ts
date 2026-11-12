import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateInstanceRequest, CreateWorkspaceInstanceRequest, Instance } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class InstanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.authApiUrl;

  listMine(): Observable<Instance[]> {
    return this.http.get<Instance[]>(`${this.baseUrl}/api/instance/my`);
  }

  listWorkspace(workspaceId: string): Observable<Instance[]> {
    return this.http.get<Instance[]>(`${this.baseUrl}/api/instance/workspace=${encodeURIComponent(workspaceId)}`);
  }

  create(request: CreateInstanceRequest, workspaceId?: string | null): Observable<Instance> {
    if (workspaceId) {
      const workspaceRequest: CreateWorkspaceInstanceRequest = { ...request, workspaceId };
      return this.http.post<Instance>(`${this.baseUrl}/api/instance/workspace`, workspaceRequest);
    }
    return this.http.post<Instance>(`${this.baseUrl}/api/instance`, request);
  }
}
