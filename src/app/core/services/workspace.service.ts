import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateWorkspaceInviteRequest, CreateWorkspaceRequest, Workspace, WorkspaceInvite } from '../models/auth.models';

const SELECTED_WORKSPACE_KEY = 'telemetry.workspace';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = environment.authApiUrl;

  readonly workspaces = signal<Workspace[]>([]);
  readonly selectedWorkspaceId = signal<string | null>(this.readSelectedWorkspaceId());
  readonly selectedWorkspace = computed(
    () => this.workspaces().find((workspace) => workspace.id === this.selectedWorkspaceId()) ?? null,
  );

  listMine(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(`${this.baseUrl}/api/workspace/my`).pipe(
      tap((workspaces) => {
        this.workspaces.set(workspaces);
        const selectedId = this.selectedWorkspaceId();
        if (selectedId && !workspaces.some((workspace) => workspace.id === selectedId)) {
          this.selectWorkspace(null);
        }
      }),
    );
  }

  create(request: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<Workspace>(`${this.baseUrl}/api/workspace`, request).pipe(
      tap((workspace) => this.addAndSelect(workspace)),
    );
  }

  acceptInvite(code: string): Observable<Workspace> {
    const encodedCode = encodeURIComponent(code.trim());
    return this.http
      .post<Workspace>(`${this.baseUrl}/api/workspace/accept-invite=${encodedCode}`, {})
      .pipe(tap((workspace) => this.addAndSelect(workspace)));
  }

  createInvite(request: CreateWorkspaceInviteRequest): Observable<WorkspaceInvite> {
    return this.http.post<WorkspaceInvite>(`${this.baseUrl}/api/invites`, request);
  }

  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http
      .get<Workspace>(`${this.baseUrl}/api/workspace/workspace=${encodeURIComponent(workspaceId)}`)
      .pipe(tap((workspace) => this.upsertWorkspace(workspace)));
  }

  removeWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http
      .delete<Workspace>(`${this.baseUrl}/api/workspace/remove=${encodeURIComponent(workspaceId)}`)
      .pipe(tap(() => {
        this.workspaces.update((items) => items.filter((workspace) => workspace.id !== workspaceId));
        if (this.selectedWorkspaceId() === workspaceId) this.selectWorkspace(null);
      }));
  }

  removeMember(workspaceId: string, memberId: string): Observable<Workspace> {
    return this.http
      .delete<Workspace>(`${this.baseUrl}/api/workspace/memRemove=${encodeURIComponent(memberId)}`, {
        params: { workspaceId },
      })
      .pipe(tap((workspace) => this.upsertWorkspace(workspace)));
  }

  changeMemberRole(workspaceId: string, memberId: string, role: number): Observable<Workspace> {
    return this.http
      .patch<Workspace>(`${this.baseUrl}/api/workspace/memId=${encodeURIComponent(memberId)}`, null, {
        params: { workspaceId, role: String(role) },
      })
      .pipe(tap((workspace) => this.upsertWorkspace(workspace)));
  }

  selectWorkspace(id: string | null): void {
    this.selectedWorkspaceId.set(id);
    if (!isPlatformBrowser(this.platformId)) return;

    if (id) localStorage.setItem(SELECTED_WORKSPACE_KEY, id);
    else localStorage.removeItem(SELECTED_WORKSPACE_KEY);
  }

  private addAndSelect(workspace: Workspace): void {
    this.upsertWorkspace(workspace);
    this.selectWorkspace(workspace.id);
  }

  private upsertWorkspace(workspace: Workspace): void {
    this.workspaces.update((current) => [
      ...current.filter((item) => item.id !== workspace.id),
      workspace,
    ]);
  }

  private readSelectedWorkspaceId(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(SELECTED_WORKSPACE_KEY) : null;
  }
}
