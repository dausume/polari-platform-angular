import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { CertificateTrustPromptComponent } from './certificate-trust-prompt';
import { CertificateTrustService } from '../../services/certificate-trust.service';

describe('Service connection dialog', () => {
  let stub: any;
  beforeEach(async () => {
    stub = { checking: false, showPrompt$: new BehaviorSubject(true),
      endpointStatuses$: new BehaviorSubject([{ name: 'Backend API', checked: true, state: 'unreachable',
        url: 'https://api.example.test/' + 'long-name-'.repeat(35), error: 'Could not connect.' },
        { name: 'Keycloak sign-in', checked: true, state: 'http-error', url: 'https://login.example.test/', error: 'HTTP 503' }]),
      checkAllEndpoints: jasmine.createSpy().and.resolveTo(), dismiss: jasmine.createSpy(), retry: jasmine.createSpy().and.resolveTo() };
    await TestBed.configureTestingModule({ imports: [CertificateTrustPromptComponent, NoopAnimationsModule],
      providers: [{ provide: CertificateTrustService, useValue: stub }] }).compileComponents();
  });
  it('keeps footer actions visible and service buttons reachable in narrow/short viewports', async () => {
    const fixture = TestBed.createComponent(CertificateTrustPromptComponent);
    fixture.detectChanges(); await fixture.whenStable();
    for (const [width, height] of [[320, 480], [900, 360]]) {
      const frame = document.createElement('iframe');
      frame.style.width = width+'px'; frame.style.height = height+'px';
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!;
        doc.head.innerHTML = document.head.innerHTML;
        doc.body.style.margin = '0';
        doc.body.appendChild(fixture.nativeElement.cloneNode(true));
        // Let the iframe calculate styles in its own viewport (including dvh).
        await new Promise(resolve => setTimeout(resolve, 50));
        const buttons = Array.from(doc.querySelectorAll('button'));
        const retry = buttons.find(b => b.textContent?.includes('Retry connections'))!;
        expect(retry.getBoundingClientRect().bottom).toBeLessThanOrEqual(height);
        expect(retry.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        const open = buttons.find(b => b.textContent?.includes('Open service'))!;
        open.scrollIntoView({ block: 'nearest' });
        const body = doc.querySelector('mat-card-content')!.getBoundingClientRect();
        expect(open.getBoundingClientRect().top).toBeGreaterThanOrEqual(body.top-1);
        expect(open.getBoundingClientRect().bottom).toBeLessThanOrEqual(body.bottom+1);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      } finally { frame.remove(); }
    }
    fixture.destroy();
  });
  it('retries diagnostics instead of reloading the page', () => {
    const fixture = TestBed.createComponent(CertificateTrustPromptComponent); fixture.detectChanges();
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('Retry connections'))!;
    retry.click(); expect(stub.retry).toHaveBeenCalled(); fixture.destroy();
  });
});
