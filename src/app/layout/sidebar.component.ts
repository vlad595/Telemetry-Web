import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { WorkspaceService } from '../core/services/workspace.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <a class="brand" routerLink="/dashboard">Telemetry</a>
      <p class="section-label">MENU</p>
      <nav aria-label="Main navigation">
        <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/setup" routerLinkActive="active">Add instance</a>
        <a routerLink="/workspace-management" routerLinkActive="active">Workspace management</a>
        <a routerLink="/analytics" routerLinkActive="active">Analytics Dashboard</a>
        <a routerLink="/telegram" routerLinkActive="active">Telegram</a>
        <a routerLink="/plan" routerLinkActive="active">Plan</a>
      </nav>
      <button type="button" class="sign-out" (click)="signOut()">Sign out</button>
    </aside>
  `,
  styles: [
    '.sidebar { min-height: 100vh; display: flex; flex-direction: column; padding: 24px 16px; border-right: 1px solid var(--border); background: var(--surface); }',
    '.brand { padding: 4px 10px 36px; color: var(--accent); font-size: 20px; font-weight: 700; text-decoration: none; }',
    '.section-label { margin: 0 10px 10px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .1em; }',
    'nav { display: grid; gap: 4px; }',
    'nav a { display: flex; justify-content: space-between; padding: 10px; color: var(--ink); text-decoration: none; }',
    'nav a.active { background: var(--accent-soft); color: var(--accent); font-weight: 700; }',
    '.sign-out { margin-top: auto; padding: 10px; border: 1px solid var(--border); background: transparent; color: var(--ink); text-align: left; cursor: pointer; }',
    '@media (max-width: 760px) { .sidebar { min-height: 0; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--border); } .brand { padding: 4px 0 12px; } .section-label, .sign-out { display: none; } nav { display: flex; overflow-x: auto; white-space: nowrap; } nav a { flex: 0 0 auto; justify-content: center; padding: 9px 8px; font-size: 13px; } }',
  ],
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly workspaces = inject(WorkspaceService);
  private readonly router = inject(Router);

  signOut(): void {
    this.workspaces.selectWorkspace(null);
    this.auth.logout();
    void this.router.navigateByUrl('/auth');
  }
}
