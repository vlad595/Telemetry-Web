import { Component, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { WorkspaceService } from '../../../core/services/workspace.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly workspaceService = inject(WorkspaceService);
  readonly loading = signal(true);
  readonly workspaceControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.workspaceControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.workspaceService.selectWorkspace(id || null));

    toObservable(this.workspaceService.selectedWorkspaceId, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.workspaceControl.setValue(id ?? '', { emitEvent: false }));

    this.workspaceService.listMine()
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.syncWorkspaceControl(),
        error: () => this.syncWorkspaceControl(),
      });
  }

  private syncWorkspaceControl(): void {
    this.workspaceControl.setValue(this.workspaceService.selectedWorkspaceId() ?? '', { emitEvent: false });
  }
}
