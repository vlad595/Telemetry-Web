import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: '<div class="app-layout"><app-sidebar /><main class="page-content"><router-outlet /></main></div>',
  styles: [
    '.app-layout { min-height: 100vh; display: grid; grid-template-columns: 232px minmax(0, 1fr); }',
    '.page-content { min-width: 0; padding: 32px; }',
    '@media (max-width: 760px) { .app-layout { grid-template-columns: 1fr; } .page-content { padding: 22px 16px; } }',
  ],
})
export class AppShellComponent {}
