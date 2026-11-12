import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SubscriptionTier } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';

interface PlanOption {
  tier: SubscriptionTier;
  title: string;
  summary: string;
  features: string[];
}

@Component({
  selector: 'app-plan-page',
  standalone: true,
  templateUrl: './plan-page.component.html',
  styleUrl: './plan-page.component.css',
})
export class PlanPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly plans: PlanOption[] = [
    {
      tier: SubscriptionTier.Tier3,
      title: 'Tier 3',
      summary: 'Live monitoring',
      features: ['Track your instances and their current metrics'],
    },
    {
      tier: SubscriptionTier.Tier2,
      title: 'Tier 2',
      summary: 'Analytics and alerts',
      features: [
        'Everything in Tier 3',
        'Analytics for the last 24 hours',
        'Telegram notifications based on alert rules',
      ],
    },
    {
      tier: SubscriptionTier.Tier1,
      title: 'Tier 1',
      summary: 'Extended history',
      features: [
        'Everything in Tier 2',
        'Analytics for the last 7 days',
      ],
    },
  ];

  readonly loading = signal(true);
  readonly savingTier = signal<SubscriptionTier | null>(null);
  readonly currentTier = signal<SubscriptionTier | null>(null);
  readonly error = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    this.auth.currentUser()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => {
          if (this.isTier(user.subscriptionLevel)) {
            this.currentTier.set(user.subscriptionLevel);
          } else {
            this.error.set('Your account has an unknown plan. Please try again later.');
          }
        },
        error: (error: unknown) => this.error.set(this.errorMessage(error, 'Could not load your plan.')),
      });
  }

  changePlan(tier: SubscriptionTier): void {
    const current = this.currentTier();
    if (current === null || tier === current || this.savingTier() !== null) return;

    this.error.set('');
    this.message.set('');
    this.savingTier.set(tier);

    const request = tier < current ? this.auth.upgradePlan(tier) : this.auth.downgradePlan(tier);
    request.pipe(
      finalize(() => this.savingTier.set(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (user) => {
        if (!this.isTier(user.subscriptionLevel)) {
          this.error.set('The server returned an unknown plan. Refresh the page to check your account.');
          return;
        }
        this.currentTier.set(user.subscriptionLevel);
        const selected = this.plans.find((plan) => plan.tier === user.subscriptionLevel);
        this.message.set(`Your plan is now ${selected?.title ?? 'updated'}.`);
      },
      error: (error: unknown) => this.error.set(this.errorMessage(error, 'Could not change your plan.')),
    });
  }

  actionLabel(tier: SubscriptionTier): string {
    const current = this.currentTier();
    if (current === tier) return 'Current plan';
    return current !== null && tier < current ? 'Upgrade to this plan' : 'Downgrade to this plan';
  }

  private isTier(value: number): value is SubscriptionTier {
    return value === SubscriptionTier.Tier1 || value === SubscriptionTier.Tier2 || value === SubscriptionTier.Tier3;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) return error.error;
      if (typeof error.error?.message === 'string') return error.error.message;
      return `${fallback} (${error.status || 'network error'}).`;
    }
    return fallback;
  }
}
