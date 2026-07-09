/**
 * Unit tests for StompService — connection-status lifecycle and topic
 * path construction. The internal RxStomp is spied so no real WebSocket
 * is opened (isolation mode).
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StompService } from './stomp.service';
import { RuntimeConfigService } from './runtime-config.service';

describe('StompService', () => {
  let service: StompService;

  beforeEach(() => {
    const runtimeStub: Partial<RuntimeConfigService> = {
      getWebSocketUrl: () => 'ws://test.local/ws',
    };
    TestBed.configureTestingModule({
      providers: [
        StompService,
        { provide: RuntimeConfigService, useValue: runtimeStub },
      ],
    });
    service = TestBed.inject(StompService);
  });

  it('starts disconnected', () => {
    expect(service.connectionStatus$.value).toBe('disconnected');
  });

  it('watchTopic() builds /topic/{class} and /topic/{class}/{format}', () => {
    const rx = (service as any).rxStomp;
    const watchSpy = spyOn(rx, 'watch').and.returnValue(of({} as any));
    service.watchTopic('WidgetClass');
    expect(watchSpy).toHaveBeenCalledWith('/topic/WidgetClass');
    service.watchTopic('WidgetClass', 'json');
    expect(watchSpy).toHaveBeenCalledWith('/topic/WidgetClass/json');
  });

  it('watchChanges() parses the JSON message body', (done) => {
    const rx = (service as any).rxStomp;
    spyOn(rx, 'watch').and.returnValue(
      of({ body: JSON.stringify({ operation: 'create', className: 'W' }) } as any)
    );
    service.watchChanges('W').subscribe((n: any) => {
      expect(n.operation).toBe('create');
      expect(n.className).toBe('W');
      done();
    });
  });

  it('disconnect() deactivates and emits disconnected', () => {
    const rx = (service as any).rxStomp;
    const deactivateSpy = spyOn(rx, 'deactivate');
    service.connectionStatus$.next('connected');
    service.disconnect();
    expect(deactivateSpy).toHaveBeenCalled();
    expect(service.connectionStatus$.value).toBe('disconnected');
  });
});
