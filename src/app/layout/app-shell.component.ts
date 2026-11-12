import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { Header } from '../views/shared/header/header';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, Header],
  template: '<div class="app-layout"><app-sidebar /><main class="page-content"><app-header /><div class="route-content"><router-outlet /></div></main></div>',
  styles: [
    '.app-layout { min-height: 100vh; }',
    '.page-content { min-width: 0; margin-left: 232px; padding: 0 32px 32px; }',
    '.route-content { padding-top: 18px; }',
    ':host ::ng-deep app-sidebar { position: fixed; z-index: 20; inset: 0 auto 0 0; width: 232px; }',
    ':host ::ng-deep app-sidebar .sidebar { height: 100vh; min-height: 0; overflow-y: auto; }',
    ':host ::ng-deep app-header { position: sticky; z-index: 15; top: 0; display: block; padding-top: 14px; background: var(--page); }',
    '@media (max-width: 760px) { .page-content { margin-left: 0; padding: 96px 16px 22px; } :host ::ng-deep app-sidebar { position: fixed; z-index: 20; inset: 0 0 auto; display: block; width: auto; } :host ::ng-deep app-sidebar .sidebar { height: auto; } :host ::ng-deep app-header { top: 96px; padding-top: 10px; } }',
  ],
})
export class AppShellComponent {}
