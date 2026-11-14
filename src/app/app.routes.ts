import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell.component';
import { anonymousGuard, authenticatedGuard } from './core/services/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [anonymousGuard],
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard-page.component').then((module) => module.DashboardPageComponent),
      },
      {
        path: 'setup',
        loadComponent: () => import('./features/setup/setup-page.component').then((module) => module.SetupPageComponent),
      },
      {
        path: 'servers',
        loadComponent: () => import('./features/servers/servers-page.component').then((module) => module.ServersPageComponent),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics-dashboard.component').then((module) => module.AnalyticsDashboardComponent),
      },
      {
        path: 'workspace-management',
        loadComponent: () => import('./features/workspace-management/workspace-management-page.component').then((module) => module.WorkspaceManagementPageComponent),
      },
      {
        path: 'telegram',
        loadComponent: () => import('./features/telegram/telegram-page.component').then((module) => module.TelegramPageComponent),
      },
      {
        path: 'plan',
        loadComponent: () => import('./features/plan/plan-page.component').then((module) => module.PlanPageComponent),
      },
      {
        path: 'about',
        loadComponent: () => import('./features/about/about-page.component').then((module) => module.AboutPageComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
