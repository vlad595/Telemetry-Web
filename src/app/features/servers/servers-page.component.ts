import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, switchMap, throwError } from 'rxjs';
import { Instance, Workspace, WorkspaceRole } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { InstanceService } from '../../core/services/instance.service';
import { WorkspaceService } from '../../core/services/workspace.service';

interface ServerGroup {
  id: string;
  name: string;
  servers: Instance[];
}

type TransferMode = 'workspace' | 'owner';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './servers-page.component.html',
  styleUrl: './servers-page.component.css',
})
export class ServersPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly instancesApi = inject(InstanceService);
  readonly workspaces = inject(WorkspaceService);

  readonly servers = signal<Instance[]>([]);
  readonly userId = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly transferInstanceId = signal<string | null>(null);
  readonly mode = new FormControl<TransferMode>('workspace', { nonNullable: true });
  readonly targetWorkspaceId = new FormControl('', { nonNullable: true });
  readonly targetOwnerId = new FormControl('', { nonNullable: true });

  readonly groups = computed<ServerGroup[]>(() => {
    const knownWorkspaces = this.workspaces.workspaces();
    const workspaceIds = new Set(knownWorkspaces.map((workspace) => workspace.id.toLowerCase()));
    const personal = this.servers().filter((server) => !server.workspaceId || !workspaceIds.has(server.workspaceId.toLowerCase()));
    const result: ServerGroup[] = [];
    if (personal.length) result.push({ id: 'personal', name: 'My servers', servers: sortByName(personal) });
    for (const workspace of knownWorkspaces) {
      const servers = this.servers().filter((server) => server.workspaceId?.toLowerCase() === workspace.id.toLowerCase());
      if (servers.length) result.push({ id: workspace.id, name: workspace.workspaceName, servers: sortByName(servers) });
    }
    return result;
  });
  readonly activeTransfer = computed(() => this.servers().find((server) => server.id === this.transferInstanceId()) ?? null);
  readonly destinations = computed(() => {
    const server = this.activeTransfer();
    return this.workspaces.workspaces().filter((workspace) =>
      workspace.id.toLowerCase() !== server?.workspaceId?.toLowerCase() && this.canManageWorkspace(workspace));
  });

  ngOnInit(): void {
    this.loadServers();
  }

  loadServers(): void {
    this.loading.set(true);
    this.error.set('');
    this.workspaces.listMine().pipe(
      switchMap((workspaces) => forkJoin({
        user: this.auth.currentUser(),
        mine: this.instancesApi.listMine(),
        shared: workspaces.length
          ? forkJoin(workspaces.map((workspace) => this.instancesApi.listWorkspace(workspace.id).pipe(
              catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 404
                ? of([] as Instance[])
                : throwError(() => error)),
            )))
          : of([] as Instance[][]),
      })),
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ user, mine, shared }) => {
        this.userId.set(user.id);
        const unique = new Map<string, Instance>();
        for (const server of [...mine, ...shared.flat()]) unique.set(server.id.toLowerCase(), server);
        this.servers.set([...unique.values()]);
      },
      error: (error: unknown) => this.error.set(requestError(error, 'Could not load servers.')),
    });
  }

  setDashboardWorkspace(server: Instance): void {
    const accessible = this.workspaces.workspaces().some((workspace) => workspace.id.toLowerCase() === server.workspaceId?.toLowerCase());
    this.workspaces.selectWorkspace(accessible ? server.workspaceId : null);
  }

  canTransfer(server: Instance): boolean {
    return server.ownerId.toLowerCase() === this.userId().toLowerCase();
  }

  toggleTransfer(server: Instance): void {
    if (this.busy() || !this.canTransfer(server)) return;
    if (this.transferInstanceId() === server.id) {
      this.transferInstanceId.set(null);
      return;
    }
    this.transferInstanceId.set(server.id);
    this.targetOwnerId.reset();
    this.targetWorkspaceId.reset();
    const hasDestination = this.workspaces.workspaces().some((workspace) =>
      workspace.id.toLowerCase() !== server.workspaceId?.toLowerCase() && this.canManageWorkspace(workspace));
    this.mode.setValue(hasDestination ? 'workspace' : 'owner');
    this.error.set('');
    this.message.set('');
  }

  transfer(): void {
    const server = this.activeTransfer();
    if (!server || !this.canTransfer(server) || this.busy()) return;
    const mode = this.mode.value;
    const workspaceId = this.targetWorkspaceId.value;
    const ownerId = this.targetOwnerId.value.trim();
    if (mode === 'workspace' && !this.destinations().some((workspace) => workspace.id === workspaceId)) {
      this.error.set('Choose a destination workspace.');
      return;
    }
    if (mode === 'owner' && (!isGuid(ownerId) || ownerId.toLowerCase() === server.ownerId.toLowerCase())) {
      this.error.set('Enter a different owner ID in UUID format.');
      return;
    }

    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    const request = mode === 'owner'
      ? this.instancesApi.transferToOwner(server.id, ownerId)
      : server.workspaceId
        ? this.instancesApi.transferBetweenWorkspaces(server.id, server.workspaceId, workspaceId)
        : this.instancesApi.transferToWorkspace(server.id, workspaceId);
    request.pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.transferInstanceId.set(null);
        this.message.set(`Server “${server.name}” transferred.`);
        this.loadServers();
      },
      error: (error: unknown) => this.error.set(requestError(error, 'Could not transfer the server.')),
    });
  }

  private canManageWorkspace(workspace: Workspace): boolean {
    const userId = this.userId().toLowerCase();
    return workspace.ownerId.toLowerCase() === userId ||
      !!workspace.members?.some((member) => member.userId.toLowerCase() === userId && member.userRole <= WorkspaceRole.Manager);
  }
}

function sortByName(servers: Instance[]): Instance[] {
  return [...servers].sort((left, right) => left.name.localeCompare(right.name));
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.message === 'string') return error.error.message;
    return `${fallback} (${error.status || 'network error'}).`;
  }
  return fallback;
}
