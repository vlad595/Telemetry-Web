import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, distinctUntilChanged, EMPTY, filter, finalize, Observable, skip, switchMap } from 'rxjs';
import { WorkspaceRole } from '../../core/models/auth.models';
import { WorkspaceService } from '../../core/services/workspace.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './workspace-management-page.component.html',
  styleUrl: './workspace-management-page.component.css',
})
export class WorkspaceManagementPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly workspaces = inject(WorkspaceService);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly latestInviteCode = signal('');
  readonly selectedWorkspace = this.workspaces.selectedWorkspace;
  readonly members = computed(() => {
    const workspace = this.selectedWorkspace();
    if (!workspace) return [];
    const members = workspace.members ?? [];
    return members.some((member) => member.userId === workspace.ownerId)
      ? members
      : [{ userId: workspace.ownerId, userName: 'Workspace owner', userRole: WorkspaceRole.Admin }, ...members];
  });
  readonly roles = [
    { value: WorkspaceRole.Admin, label: 'Admin' },
    { value: WorkspaceRole.Manager, label: 'Manager' },
    { value: WorkspaceRole.Reader, label: 'Reader' },
  ];

  readonly createForm = new FormGroup({
    workspaceName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
  });
  readonly acceptForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly inviteForm = new FormGroup({
    role: new FormControl(WorkspaceRole.Reader, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.workspaces.listMine()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadSelectedWorkspace(),
        error: (error: unknown) => this.error.set(requestError(error, 'Could not load workspaces.')),
      });

    toObservable(this.workspaces.selectedWorkspaceId, { injector: this.injector })
      .pipe(
        skip(1),
        filter((id): id is string => !!id),
        distinctUntilChanged(),
        switchMap((id) => this.workspaces.getWorkspace(id).pipe(
          catchError((error: unknown) => {
            this.error.set(requestError(error, 'Could not load workspace details.'));
            return EMPTY;
          }),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  createWorkspace(): void {
    if (this.createForm.invalid || this.busy()) {
      this.createForm.markAllAsTouched();
      return;
    }
    const workspaceName = this.createForm.controls.workspaceName.value.trim();
    if (!workspaceName) return;
    this.run(() => this.workspaces.create({ workspaceName }), 'Workspace created.');
  }

  acceptInvite(): void {
    if (this.acceptForm.invalid || this.busy()) {
      this.acceptForm.markAllAsTouched();
      return;
    }
    this.run(() => this.workspaces.acceptInvite(this.acceptForm.controls.code.value), 'You joined the workspace.');
  }

  createInvite(): void {
    const workspaceId = this.selectedWorkspace()?.id;
    if (!workspaceId || this.busy()) return;
    this.error.set('');
    this.message.set('');
    this.latestInviteCode.set('');
    this.busy.set(true);
    this.workspaces.createInvite({ workspaceId, role: this.inviteForm.controls.role.value })
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invite) => {
          this.latestInviteCode.set(invite.inviteCode);
          this.message.set(`Invitation code created. It expires ${new Date(invite.expiresAt).toLocaleString()}.`);
        },
        error: (error: unknown) => this.error.set(requestError(error, 'Could not create invitation.')),
      });
  }

  removeMember(memberId: string, memberName: string): void {
    const workspaceId = this.selectedWorkspace()?.id;
    if (!workspaceId || this.busy()) return;
    if (!window.confirm(`Remove ${memberName} from this workspace?`)) return;
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    this.workspaces.removeMember(workspaceId, memberId)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.message.set(`${memberName} was removed from the workspace.`),
        error: (error: unknown) => this.error.set(requestError(error, 'Could not remove member.')),
      });
  }

  changeMemberRole(memberId: string, currentRole: number, event: Event): void {
    const workspaceId = this.selectedWorkspace()?.id;
    const rawRole = (event.target as HTMLSelectElement).value;
    const role = Number(rawRole);
    if (!workspaceId || this.busy() || !Number.isInteger(role) || role === currentRole) return;

    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    this.workspaces.changeMemberRole(workspaceId, memberId, role)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.message.set('Member role updated.'),
        error: (error: unknown) => {
          this.error.set(requestError(error, 'Could not update member role.'));
          this.loadSelectedWorkspace();
        },
      });
  }

  removeWorkspace(): void {
    const workspace = this.selectedWorkspace();
    if (!workspace || this.busy()) return;
    if (!window.confirm(`Delete workspace “${workspace.workspaceName}”? This cannot be undone.`)) return;
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    this.workspaces.removeWorkspace(workspace.id)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.message.set(`Workspace “${workspace.workspaceName}” was deleted.`),
        error: (error: unknown) => this.error.set(requestError(error, 'Could not delete workspace.')),
      });
  }

  roleName(role: number): string {
    return this.roles.find((item) => item.value === role)?.label ?? `Role ${role}`;
  }

  private run<T>(request: () => Observable<T>, successMessage: string): void {
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    request().pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.message.set(successMessage);
        this.createForm.reset();
        this.acceptForm.reset();
        this.workspaces.listMine()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadSelectedWorkspace(),
            error: (error: unknown) => this.error.set(requestError(error, 'Could not refresh workspaces.')),
          });
      },
      error: (error: unknown) => this.error.set(requestError(error, 'Workspace request failed.')),
    });
  }

  private loadSelectedWorkspace(): void {
    const workspaceId = this.workspaces.selectedWorkspaceId();
    if (!workspaceId) return;
    this.workspaces.getWorkspace(workspaceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (error: unknown) => this.error.set(requestError(error, 'Could not load workspace details.')) });
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
