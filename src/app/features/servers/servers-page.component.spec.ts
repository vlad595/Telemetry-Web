import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Instance, Workspace, WorkspaceRole } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { InstanceService } from '../../core/services/instance.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ServersPageComponent } from './servers-page.component';

describe('ServersPageComponent', () => {
  const ownerId = '11111111-1111-1111-1111-111111111111';
  const workspaceId = '22222222-2222-2222-2222-222222222222';
  const personal: Instance = { id: '33333333-3333-3333-3333-333333333333', name: 'Personal server', ownerId, workspaceId: null };
  const shared: Instance = { id: '44444444-4444-4444-4444-444444444444', name: 'Shared server', ownerId: '55555555-5555-5555-5555-555555555555', workspaceId };
  const workspace: Workspace = {
    id: workspaceId,
    workspaceName: 'Operations',
    ownerId,
    members: [{ userId: ownerId, userName: 'Owner', userRole: WorkspaceRole.Admin }],
  };
  const selectedWorkspaceId = signal<string | null>(null);
  const workspaces = signal<Workspace[]>([workspace]);
  const instanceApi = {
    listMine: vi.fn(() => of([personal])),
    listWorkspace: vi.fn(() => of([shared, personal])),
    transferToWorkspace: vi.fn(() => of({ ...personal, workspaceId })),
    transferBetweenWorkspaces: vi.fn(() => of(shared)),
    transferToOwner: vi.fn(() => of(personal)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    selectedWorkspaceId.set(null);
    workspaces.set([workspace]);
    await TestBed.configureTestingModule({
      imports: [ServersPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => of({ id: ownerId }) } },
        { provide: InstanceService, useValue: instanceApi },
        { provide: WorkspaceService, useValue: {
          workspaces,
          selectedWorkspaceId,
          listMine: () => of([workspace]),
          selectWorkspace: (id: string | null) => selectedWorkspaceId.set(id),
        } },
      ],
    }).compileComponents();
  });

  it('groups unique personal and shared servers and selects the workspace for the dashboard', async () => {
    const fixture = TestBed.createComponent(ServersPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.componentInstance;
    expect(page.servers()).toHaveLength(2);
    expect(page.groups().map((group) => [group.name, group.servers.length])).toEqual([
      ['My servers', 1],
      ['Operations', 1],
    ]);
    expect(fixture.nativeElement.querySelectorAll('.server-link')).toHaveLength(2);

    page.setDashboardWorkspace(shared);
    expect(selectedWorkspaceId()).toBe(workspaceId);
    page.setDashboardWorkspace(personal);
    expect(selectedWorkspaceId()).toBeNull();
  });

  it('uses the personal-to-workspace transfer endpoint for an owned server', async () => {
    const fixture = TestBed.createComponent(ServersPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.componentInstance;
    page.toggleTransfer(personal);
    page.targetWorkspaceId.setValue(workspaceId);
    page.transfer();

    expect(instanceApi.transferToWorkspace).toHaveBeenCalledWith(personal.id, workspaceId);
    expect(page.message()).toContain('transferred');
  });
});
