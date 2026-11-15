import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SubscriptionTier, UserContext } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  const user: UserContext = {
    id: '11111111-1111-1111-1111-111111111111',
    userName: 'Alex',
    email: 'alex@example.com',
    subscriptionLevel: SubscriptionTier.Tier3,
  };
  const auth = {
    currentUser: vi.fn(() => of(user)),
    deleteAccount: vi.fn(() => of(user)),
    logout: vi.fn(),
  };
  const workspaces = { selectWorkspace: vi.fn() };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.removeItem('telemetry.language');
    document.documentElement.lang = 'en';
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: WorkspaceService, useValue: workspaces },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('shows the account and requires a second action before deletion', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(user.id);
    expect(fixture.nativeElement.textContent).toContain(user.userName);
    expect(fixture.nativeElement.textContent).toContain(user.email);

    fixture.componentInstance.deleteAccount();
    expect(auth.deleteAccount).not.toHaveBeenCalled();

    fixture.componentInstance.showDeleteConfirmation();
    expect(fixture.componentInstance.confirming()).toBe(true);
    expect(auth.deleteAccount).not.toHaveBeenCalled();

    fixture.componentInstance.cancelDelete();
    expect(fixture.componentInstance.confirming()).toBe(false);
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('changes the site language immediately and saves the choice', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const picker = fixture.nativeElement.querySelector('#site-language') as HTMLSelectElement;
    picker.value = 'uk';
    picker.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(document.documentElement.lang).toBe('uk');
    expect(localStorage.getItem('telemetry.language')).toBe('uk');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Налаштування');
  });

  it('restores a saved language when the page opens', async () => {
    localStorage.setItem('telemetry.language', 'uk');
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('#site-language') as HTMLSelectElement).value).toBe('uk');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Налаштування');
    expect(document.documentElement.lang).toBe('uk');
  });

  it('deletes only the signed-in account and signs out after success', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.showDeleteConfirmation();
    fixture.componentInstance.deleteAccount();

    expect(auth.deleteAccount).toHaveBeenCalledWith(user.id);
    expect(workspaces.selectWorkspace).toHaveBeenCalledWith(null);
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth');
  });

  it('keeps the user signed in when deletion fails', async () => {
    auth.deleteAccount.mockImplementationOnce(() => throwError(() => new Error('Request failed')));
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.showDeleteConfirmation();
    fixture.componentInstance.deleteAccount();

    expect(fixture.componentInstance.error()).toBe('Could not delete your account.');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
