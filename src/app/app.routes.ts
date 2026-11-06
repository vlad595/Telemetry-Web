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
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics-page.component').then((module) => module.AnalyticsPageComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
