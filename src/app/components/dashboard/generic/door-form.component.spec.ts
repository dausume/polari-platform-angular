import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DoorFormComponent } from './door-form.component';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';

describe('DoorFormComponent (wb-3)', () => {
  let posts: any[];
  let reply: any;

  beforeEach(() => {
    posts = [];
    reply = { ok: true, name: 'lab-bench' };
    TestBed.configureTestingModule({
      imports: [DoorFormComponent],
      providers: [
        { provide: HttpClient, useValue: { post: (u: string, b: any) => { posts.push([u, b]); return of(reply); } } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
      ],
    });
  });

  function make() {
    const f = TestBed.createComponent(DoorFormComponent);
    f.componentInstance.fields = [
      { name: 'name', label: 'Bench name', required: true },
      { name: 'title', label: 'Title' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ];
    f.componentInstance.action = {
      label: 'Create', path: '/api/board/benches',
      body_template: { name: '{name}', title: '{title}', notes: '{notes}' },
      then_scope: { key: 'bench', from: 'name' },
    };
    f.componentInstance.success_text = 'Created.';
    f.detectChanges();
    return f;
  }

  it('renders one input per field (textarea for type textarea) and blocks submit while a required field is empty', () => {
    const f = make();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input').length).toBe(2);
    expect(el.querySelectorAll('textarea').length).toBe(1);
    expect((el.querySelector('button.act') as HTMLButtonElement).disabled).toBeTrue();
    f.componentInstance.values['name'] = 'lab-bench';
    f.detectChanges();
    expect((el.querySelector('button.act') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('posts the filled body once, sets then_scope + rev, shows the success text and clears the inputs', () => {
    const events = TestBed.inject(DisplayEventsService);
    const scopes: [string, string][] = [];
    events.on('setScope').subscribe((e) => scopes.push([e.payload['key'], e.payload['value']]));
    const f = make();
    f.componentInstance.values = { name: ' lab-bench ', title: 'Lab' };
    f.detectChanges();
    f.componentInstance.submit();
    f.detectChanges();
    expect(posts.length).toBe(1);
    expect(posts[0][0]).toBe('/api/board/benches');
    expect(posts[0][1]).toEqual({ name: 'lab-bench', title: 'Lab', notes: '' });
    expect(scopes[0]).toEqual(['bench', 'lab-bench']);
    expect(scopes[1][0]).toBe('rev');
    expect(f.componentInstance.message).toBe('Created.');
    expect(f.componentInstance.values).toEqual({});
  });

  it('keeps the inputs and shows the refusal words when the door refuses inside a 200', () => {
    reply = { ok: false, error: 'a bench named lab-bench already exists' };
    const f = make();
    f.componentInstance.values = { name: 'lab-bench' };
    f.detectChanges();
    f.componentInstance.submit();
    f.detectChanges();
    expect(f.componentInstance.ok).toBeFalse();
    expect(f.componentInstance.message).toContain('already exists');
    expect(f.componentInstance.values['name']).toBe('lab-bench');
  });
});
