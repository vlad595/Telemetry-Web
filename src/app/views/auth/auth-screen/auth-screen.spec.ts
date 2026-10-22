import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthScreen } from './auth-screen';

describe('AuthScreen', () => {
  let component: AuthScreen;
  let fixture: ComponentFixture<AuthScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthScreen],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
