import { Component } from '@angular/core';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  template: `
    <section class="placeholder">
      <p class="eyebrow">ANALYTICS</p>
      <h1>Coming soon</h1>
      <p>Historical telemetry analysis will be available here when the analytics service is ready.</p>
    </section>
  `,
  styles: [
    '.placeholder { max-width: 680px; padding: 24px; border: 1px solid var(--border); background: var(--surface); }',
    '.eyebrow { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .1em; }',
    'h1 { margin: 0 0 10px; font-size: 26px; }',
    'p:last-child { margin-bottom: 0; color: var(--muted); line-height: 1.5; }',
  ],
})
export class AnalyticsPageComponent {}
