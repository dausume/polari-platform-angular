import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { PickerButtonComponent } from './picker-button.component';
import { PickerDialogComponent } from './picker-dialog.component';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { CardsConfig } from './class-rows-cards';

describe('PickerButtonComponent (wb-1)', () => {
  const popup: CardsConfig = {
    dataPath: '/api/opts', title_field: 'title',
    action: { label: 'Add', path: '/api/add', body_template: { model: '{model}' } },
  };
  let posts: any[];

  beforeEach(() => {
    posts = [];
    TestBed.configureTestingModule({
      imports: [PickerButtonComponent, NoopAnimationsModule],
      providers: [
        { provide: HttpClient, useValue: {
          get: () => of({ ok: true, rows: [{ model: 'm1', title: 'One' }, { model: 'm2', title: 'Two' }] }),
          post: (u: string, b: any) => { posts.push([u, b]); return of({ ok: true }); },
        } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
      ],
    });
  });

  it('opens the dialog with the nested cards config', () => {
    const dialog = TestBed.inject(MatDialog);
    const spy = spyOn(dialog, 'open').and.callThrough();
    const f = TestBed.createComponent(PickerButtonComponent);
    f.componentInstance.label = 'Breadboards'; f.componentInstance.title = 'Pick'; f.componentInstance.popup = popup;
    f.detectChanges();
    (f.nativeElement.querySelector('button.open') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
    expect(spy.calls.mostRecent().args[0]).toBe(PickerDialogComponent);
    expect((spy.calls.mostRecent().args[1] as any).data.popup).toBe(popup);
    dialog.closeAll();
  });

  it('runs a card action inside the modal, bumps rev, and stays open for the next card', async () => {
    const dialog = TestBed.inject(MatDialog);
    const events = TestBed.inject(DisplayEventsService);
    const revs: string[] = [];
    events.on('setScope').subscribe((e) => revs.push(e.payload['key']));
    const f = TestBed.createComponent(PickerButtonComponent);
    f.componentInstance.popup = popup; f.componentInstance.label = 'Go';
    f.detectChanges();
    (f.nativeElement.querySelector('button.open') as HTMLButtonElement).click();
    const ref = dialog.openDialogs[0];
    ref.componentRef!.changeDetectorRef.detectChanges();
    const overlay = document.querySelector('mat-dialog-container') as HTMLElement;
    const buttons = () => Array.from(overlay.querySelectorAll('button.act')) as HTMLButtonElement[];
    expect(buttons().length).toBe(2);
    buttons()[0].click();
    ref.componentRef!.changeDetectorRef.detectChanges();
    buttons()[1].click();
    expect(posts.map((p) => p[1].model)).toEqual(['m1', 'm2']);
    expect(revs).toEqual(['rev', 'rev']);
    expect(dialog.openDialogs.length).toBe(1);
    dialog.closeAll();
  });
});
