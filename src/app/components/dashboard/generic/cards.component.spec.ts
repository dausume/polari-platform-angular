import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { CardsComponent } from './cards.component';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';

describe('CardsComponent (wb-1)', () => {
  let fixture: ComponentFixture<CardsComponent>;
  let urls: string[];
  let posts: { url: string; body: any }[];
  let rows: any[];
  let events: DisplayEventsService;

  function setup(inputs: Partial<CardsComponent>): void {
    urls = []; posts = [];
    TestBed.configureTestingModule({
      imports: [CardsComponent],
      providers: [
        { provide: HttpClient, useValue: {
          get: (u: string) => { urls.push(u); return of({ ok: true, rows }); },
          post: (u: string, b: any) => { posts.push({ url: u, body: b }); return of({ ok: true }); },
        } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => 'http://be', backendRequestOptions: {} } },
      ],
    });
    events = TestBed.inject(DisplayEventsService);
    fixture = TestBed.createComponent(CardsComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
  }
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(() => {
    rows = [
      { board: 'uno', title: 'UNO', chip: 'ATmega328P', kind: 'half', rails: 2, power: -1, tags: ['a', 'b'] },
      { board: 'zero', title: 'Zero', chip: 'SAMD21', kind: 'full', rails: 4, power: 'unverified' },
      { board: 'feather', title: 'Feather', chip: 'SAMD21', kind: 'half', rails: 2, power: 3 },
    ];
  });

  it('renders rows as cards with title, subtitle, badge chips and label/value rows', () => {
    setup({ dataPath: '/api/x', title_field: 'title', subtitle_field: 'chip', badge_fields: ['kind'], fields: { Rails: 'rails' } });
    expect(urls).toEqual(['http://be/api/x']);
    const cards = el().querySelectorAll('article.card');
    expect(cards.length).toBe(3);
    expect(cards[0].querySelector('.title')!.textContent).toContain('UNO');
    expect(cards[0].querySelector('.subtitle')!.textContent).toContain('ATmega328P');
    expect(cards[0].querySelector('.badge')!.textContent).toContain('half');
    expect(cards[0].querySelector('dd')!.textContent).toContain('2');
  });

  it('groups under a heading per distinct value', () => {
    setup({ dataPath: '/api/x', title_field: 'title', group_by: 'kind' });
    const heads = Array.from(el().querySelectorAll('h4.group-heading')).map((h) => h.textContent!.trim());
    expect(heads).toEqual(['half', 'full']);
    expect(el().querySelectorAll('section.group')[0].querySelectorAll('article').length).toBe(2);
  });

  it('a facet chip re-queries with ?param=value and clears on the second click', () => {
    setup({ dataPath: '/api/x?bench=b', title_field: 'title',
      facets: [{ label: 'Kind', query_param: 'kind', options: [{ label: 'Half', value: 'half' }] }] });
    const chip = (): HTMLButtonElement => el().querySelector('button.facet-chip') as HTMLButtonElement;
    chip().click(); fixture.detectChanges();
    expect(urls[urls.length - 1]).toBe('http://be/api/x?bench=b&kind=half');
    expect(chip().classList).toContain('selected');
    chip().click(); fixture.detectChanges();
    expect(urls[urls.length - 1]).toBe('http://be/api/x?bench=b');
    expect(chip().classList).not.toContain('selected');
  });

  it('renders -1 and "unverified" as the word, never a number', () => {
    setup({ dataPath: '/api/x', title_field: 'title', fields: { Power: 'power' } });
    const dds = Array.from(el().querySelectorAll('dd'));
    expect(dds[0].textContent!.trim()).toBe('unverified');
    expect(dds[0].classList).toContain('dim');
    expect(dds[1].textContent!.trim()).toBe('unverified');
    expect(dds[2].textContent!.trim()).toBe('3');
  });

  it('says so when nothing matches', () => {
    rows = [];
    setup({ dataPath: '/api/x', title_field: 'title' });
    expect(el().querySelector('.empty')!.textContent).toContain('Nothing matches');
  });

  it('the card button goes through the shared action helper: one POST filled from the row, then bumps rev', () => {
    const seen: any[] = [];
    setup({ dataPath: '/api/x', title_field: 'title',
      action: { label: 'Add', path: '/api/b/{board}/add', body_template: { board: '{board}' } } });
    events.on('setScope').subscribe((e) => seen.push(e.payload));
    (el().querySelector('button.act') as HTMLButtonElement).click();
    expect(posts).toEqual([{ url: 'http://be/api/b/uno/add', body: { board: 'uno' } }]);
    expect(seen.length).toBe(1);
    expect(seen[0].key).toBe('rev');
  });
});
