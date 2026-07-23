// Root service for the in-app AI assistant (Phase 4).
// Follows the ApiConfigService pattern: providedIn 'root', HttpClient +
// RuntimeConfigService for the runtime-resolved backend base URL.

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import {
  AiChatRequest, AiChatResponse, ProvidersStatus, AiActResult,
} from '@models/ai-assistant/ai-assistant.model';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  /** Shared open/closed state so the header button and the panel stay in sync. */
  readonly open = signal(false);

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
  ) {}

  toggle(): void {
    this.open.update((v) => !v);
  }

  setOpen(value: boolean): void {
    this.open.set(value);
  }

  /** POST /ai/chat — the provider-agnostic reasoning endpoint. */
  chat(request: AiChatRequest): Observable<AiChatResponse> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    return this.http.post<AiChatResponse>(`${baseUrl}/ai/chat`, request);
  }

  /** GET /ai/providers — provider readiness, used to show the setup guide. */
  providersStatus(): Observable<ProvidersStatus> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    return this.http.get<ProvidersStatus>(`${baseUrl}/ai/providers`);
  }

  /** POST /ai/act — confirm (or deny) a proposed gated action. */
  act(proposalId: string, confirm: boolean): Observable<AiActResult> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    return this.http.post<AiActResult>(`${baseUrl}/ai/act`, {
      proposal_id: proposalId, confirm,
    });
  }

  /** POST /ai/chat/stream — SSE stream of the reply. `onDelta` fires per text
   *  chunk; `onDone` fires once with provider/proposals. Uses fetch (HttpClient
   *  doesn't expose the stream). Callbacks run outside Angular's zone — callers
   *  wrap UI updates in NgZone. */
  async chatStream(
    request: AiChatRequest,
    onDelta: (text: string) => void,
    onDone: (done: AiChatResponse) => void,
    onError: (err: unknown) => void,
  ): Promise<void> {
    const baseUrl = this.runtimeConfig.getBackendBaseUrl();
    try {
      const resp = await fetch(`${baseUrl}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!resp.ok || !resp.body) { onError({ status: resp.status }); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { break; }
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data: '));
          if (!line) { continue; }
          const data = JSON.parse(line.slice(6));
          if (data.type === 'delta') { onDelta(data.text); }
          else if (data.type === 'done') { onDone(data as AiChatResponse); }
        }
      }
    } catch (e) {
      onError(e);
    }
  }
}
