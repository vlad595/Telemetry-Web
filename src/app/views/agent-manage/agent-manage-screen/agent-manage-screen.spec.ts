import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentManageScreen } from './agent-manage-screen';

describe('AgentManageScreen', () => {
  let component: AgentManageScreen;
  let fixture: ComponentFixture<AgentManageScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentManageScreen],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentManageScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
