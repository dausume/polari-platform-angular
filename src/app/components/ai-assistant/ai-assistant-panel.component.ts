// In-app AI assistant panel (Phase 4): text chat + voice, and voice-first when
// rendered inside a WebXR surface. Standalone; mounted app-wide in
// app.component.html and toggled from the header toolbar. In XR it is registered
// as an off-screen surface and reads XR_PANEL_CONTEXT to drop the keyboard input
// and speak replies aloud.

import {
  Component, OnInit, OnDestroy, NgZone, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AiAssistantService } from '@services/ai-assistant/ai-assistant.service';
import {
  ChatTurn, ProvidersStatus, AiProposal, VoiceStatus,
} from '@models/ai-assistant/ai-assistant.model';
import { XR_PANEL_CONTEXT } from '@models/xr/xr-panel-context';

@Component({
  standalone: true,
  selector: 'ai-assistant-panel',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="ai-panel" [class.xr]="xrMode" *ngIf="xrMode || svc.open()">
      <div class="ai-head">
        <mat-icon>smart_toy</mat-icon>
        <span class="ai-title">Polari Assistant</span>
        <span class="ai-provider" *ngIf="provider()">{{ provider() }}</span>
        <span class="ai-spacer"></span>
        <button *ngIf="!xrMode" mat-icon-button (click)="svc.setOpen(false)" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Shown whenever the user opens the assistant but no AI model is
           configured on this instance: a friendly setup guide. -->
      <div class="ai-setup" *ngIf="showSetup()">
        <mat-icon class="ai-setup-icon">settings_suggest</mat-icon>
        <div class="ai-setup-title">AI model not set up yet</div>
        <p>
          You're using the built-in assistant — it can report on this Polari
          instance, but full AI reasoning needs a model connected. An
          administrator sets one up (Claude, OpenAI, or a local model) on this
          instance.
        </p>
        <div class="ai-setup-needs" *ngFor="let p of pendingProviders()">
          <strong>{{ p.name }}</strong>
          <span class="ai-dim"> — {{ p.needs.length ? p.needs.join('; ') : 'ready' }}</span>
        </div>
        <p class="ai-dim ai-setup-doc">Full setup guide: <code>polari-mcp/PROVIDER_SETUP.md</code></p>
        <div class="ai-setup-actions">
          <button mat-stroked-button (click)="loadStatus()">Recheck</button>
          <button mat-flat-button color="primary" (click)="dismissedSetup.set(true)">
            Use basic assistant
          </button>
        </div>
      </div>

      <div class="ai-messages" *ngIf="!showSetup()">
        <div *ngFor="let m of messages()" class="ai-msg" [class.user]="m.role === 'user'">
          <div class="ai-role">{{ m.role }}</div>
          <div class="ai-body">{{ m.content }}</div>
        </div>
        <div *ngIf="sending()" class="ai-msg"><div class="ai-body ai-dim">…thinking</div></div>
        <div *ngIf="!messages().length && !sending()" class="ai-body ai-dim">
          Ask about no-code, displays, connectors, topology, or navigation.
          Changes are proposed and require your confirmation.
        </div>
      </div>

      <!-- Confirmation cards: a proposed gated change never applies until the
           user confirms. Shows what will change and its authority level. -->
      <div class="ai-proposals" *ngIf="!showSetup() && pendingProposals().length">
        <div class="ai-card" *ngFor="let p of pendingProposals()">
          <div class="ai-card-head">
            <mat-icon>gpp_maybe</mat-icon>
            <span class="ai-card-op">{{ p.operation }}</span>
            <span class="ai-card-level" [class.blocked]="p.gate && !p.gate.executable">
              L{{ p.authority_level }} · {{ p.authority_label }}
            </span>
          </div>
          <div class="ai-card-summary">{{ p.summary }}</div>
          <div class="ai-card-blocked" *ngIf="p.gate && !p.gate.executable">
            Needs out-of-band approval — the assistant can't apply this on its own.
          </div>
          <div class="ai-card-actions">
            <button mat-flat-button color="primary"
                    [disabled]="p.gate && !p.gate.executable"
                    (click)="confirmProposal(p)">Confirm</button>
            <button mat-stroked-button (click)="denyProposal(p)">Dismiss</button>
          </div>
        </div>
      </div>

      <div class="ai-input-row" *ngIf="!showSetup()">
        <!-- ai-4: the mic states its path — sovereign (provider-
             backed, on-isle when the provider is) vs the browser
             fallback (Chrome STT is cloud-backed). Never silent. -->
        <button *ngIf="voiceSupported()" mat-icon-button (click)="toggleListen()"
                [class.listening]="listening()" [matTooltip]="micTooltip()">
          <mat-icon>{{ listening() ? 'mic' : 'mic_none' }}</mat-icon>
        </button>
        <input *ngIf="!xrMode" class="ai-input" [(ngModel)]="inputText"
               (keydown.enter)="send()" placeholder="Ask the assistant…" />
        <span *ngIf="xrMode" class="ai-xr-hint">
          {{ listening() ? 'Listening…' : 'Tap the mic and speak' }}
        </span>
        <button *ngIf="!xrMode" mat-icon-button (click)="send()"
                [disabled]="sending() || !inputText.trim()" matTooltip="Send">
          <mat-icon>send</mat-icon>
        </button>
        <button *ngIf="speaking()" mat-icon-button (click)="stopSpeaking()" matTooltip="Stop voice">
          <mat-icon>volume_off</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-panel { display: flex; flex-direction: column; background: var(--mat-sys-surface, #1e1e1e);
      color: var(--mat-sys-on-surface, #eee); border: 1px solid rgba(128,128,128,.35);
      border-radius: 10px; width: 360px; max-width: 92vw; height: 460px; overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,.35); }
    .ai-panel:not(.xr) { position: fixed; right: 16px; bottom: 16px; z-index: 1200; }
    .ai-panel.xr { width: 640px; height: 820px; font-size: 22px; } /* larger for headset rasterization */
    .ai-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border-bottom: 1px solid rgba(128,128,128,.25); }
    .ai-title { font-weight: 600; }
    .ai-provider { font-size: .75em; opacity: .6; border: 1px solid rgba(128,128,128,.4);
      border-radius: 6px; padding: 0 6px; }
    .ai-spacer { flex: 1; }
    .ai-messages { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    .ai-msg { display: flex; flex-direction: column; gap: 2px; }
    .ai-role { font-size: .7em; text-transform: uppercase; opacity: .5; }
    .ai-msg.user .ai-role { color: #6ab0ff; }
    .ai-body { white-space: pre-wrap; line-height: 1.35; }
    .ai-dim { opacity: .6; font-style: italic; }
    .ai-input-row { display: flex; align-items: center; gap: 6px; padding: 8px;
      border-top: 1px solid rgba(128,128,128,.25); }
    .ai-input { flex: 1; background: transparent; border: 1px solid rgba(128,128,128,.4);
      border-radius: 8px; color: inherit; padding: 8px 10px; font: inherit; }
    .ai-xr-hint { flex: 1; opacity: .7; }
    .listening mat-icon { color: #ff5252; }
    .ai-setup { flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 10px; }
    .ai-setup-icon { font-size: 40px; width: 40px; height: 40px; opacity: .8; }
    .ai-setup-title { font-size: 1.1em; font-weight: 700; }
    .ai-setup p { margin: 0; line-height: 1.4; }
    .ai-setup-needs { font-size: .9em; }
    .ai-setup-doc code { font-size: .85em; }
    .ai-setup-actions { display: flex; gap: 8px; margin-top: 6px; }
    .ai-proposals { padding: 8px 10px; display: flex; flex-direction: column; gap: 8px;
      border-top: 1px solid rgba(128,128,128,.25); max-height: 45%; overflow-y: auto; }
    .ai-card { border: 1px solid rgba(128,128,128,.4); border-radius: 8px; padding: 8px 10px;
      display: flex; flex-direction: column; gap: 6px; background: rgba(128,128,128,.08); }
    .ai-card-head { display: flex; align-items: center; gap: 6px; }
    .ai-card-op { font-weight: 600; }
    .ai-card-level { margin-left: auto; font-size: .72em; opacity: .7;
      border: 1px solid rgba(128,128,128,.4); border-radius: 6px; padding: 0 6px; }
    .ai-card-level.blocked { color: #ff7043; border-color: #ff7043; }
    .ai-card-summary { font-size: .92em; }
    .ai-card-blocked { font-size: .82em; color: #ff7043; }
    .ai-card-actions { display: flex; gap: 8px; }
  `],
})
export class AiAssistantPanelComponent implements OnInit, OnDestroy {
  readonly svc = inject(AiAssistantService);
  private readonly zone = inject(NgZone);
  /** true when this instance is rendered off-screen for XR rasterization. */
  readonly xrMode = inject(XR_PANEL_CONTEXT, { optional: true }) ?? false;

  readonly messages = signal<ChatTurn[]>([]);
  readonly sending = signal(false);
  readonly listening = signal(false);
  readonly speaking = signal(false);
  readonly voiceSupported = signal(false);
  readonly provider = signal<string>('');
  inputText = '';

  // Provider setup state — drives the in-app "not set up yet" guide.
  readonly setup = signal<ProvidersStatus | null>(null);
  readonly dismissedSetup = signal(false);
  readonly showSetup = computed(() => {
    if (this.dismissedSetup()) { return false; }
    const s = this.setup();
    if (!s) { return false; }               // unknown yet — don't flash the guide
    const active = s.providers.find((p) => p.name === s.active);
    const fullyConfigured = s.active !== 'null' && !!active?.ready;
    return !fullyConfigured;                 // no real model connected -> show guide
  });
  readonly pendingProviders = computed(() =>
    (this.setup()?.providers ?? []).filter((p) => p.name !== 'null' && !p.ready));

  // Gated actions the assistant proposed, awaiting the user's confirm/dismiss.
  readonly pendingProposals = signal<AiProposal[]>([]);

  private recognition: any = null;

  // ai-4: provider-backed voice. When the backend says a direction
  // is available it is PREFERRED; browser Web Speech is the stated
  // fallback, never the silent default.
  readonly voice = signal<VoiceStatus | null>(null);
  private recorder: MediaRecorder | null = null;
  private recorderStream: MediaStream | null = null;
  private playback: HTMLAudioElement | null = null;

  micTooltip(): string {
    const v = this.voice();
    if (v?.stt?.available) {
      return v.sovereign
        ? 'Push to talk — transcribed on the isle (sovereign)'
        : 'Push to talk — transcribed by the AI provider (remote)';
    }
    return 'Push to talk — browser speech (Chrome STT is cloud-backed)';
  }

  loadStatus(): void {
    this.svc.providersStatus().subscribe({
      next: (s) => this.setup.set(s),
      error: () => this.setup.set(null),
    });
    this.svc.voiceStatus().subscribe({
      next: (v) => {
        this.voice.set(v);
        if (v?.stt?.available) { this.voiceSupported.set(true); }
      },
      error: () => this.voice.set(null),
    });
  }

  ngOnInit(): void {
    this.loadStatus();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e: any) => {
        const transcript = e?.results?.[0]?.[0]?.transcript ?? '';
        this.zone.run(() => {
          this.inputText = transcript;
          this.listening.set(false);
          if (transcript.trim()) { this.send(true); }
        });
      };
      rec.onerror = () => this.zone.run(() => this.listening.set(false));
      rec.onend = () => this.zone.run(() => this.listening.set(false));
      this.recognition = rec;
      this.voiceSupported.set(true);
    }
  }

  ngOnDestroy(): void {
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.stopRecording(true);
    this.stopSpeaking();
  }

  toggleListen(): void {
    // sovereign path first: record locally, transcribe on the
    // provider; only when unavailable fall back to Web Speech.
    if (this.voice()?.stt?.available) {
      if (this.listening()) { this.stopRecording(); } else { this.startRecording(); }
      return;
    }
    if (!this.recognition) { return; }
    if (this.listening()) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.listening.set(false);
    } else {
      this.listening.set(true);
      try { this.recognition.start(); } catch { this.listening.set(false); }
    }
  }

  private async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data?.size) { chunks.push(e.data); } };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        this.zone.run(() => this.listening.set(false));
        if (!blob.size) { return; }
        this.svc.transcribe(blob).then((text) => this.zone.run(() => {
          this.inputText = text;
          if (text.trim()) { this.send(true); }
        })).catch((e) => this.zone.run(() => {
          this.messages.update((m) => [...m, {
            role: 'assistant',
            content: `Voice transcription failed (${e?.message ?? 'error'}) — `
              + `type instead, or check /ai/voice.`,
          }]);
        }));
      };
      this.recorder = rec;
      this.recorderStream = stream;
      this.listening.set(true);
      rec.start();
    } catch {
      this.listening.set(false);  // mic permission denied etc.
    }
  }

  private stopRecording(silent = false): void {
    try {
      if (silent && this.recorder) { this.recorder.onstop = null; }
      this.recorder?.stop();
      if (silent) { this.recorderStream?.getTracks().forEach((t) => t.stop()); }
    } catch { /* ignore */ }
    this.recorder = null;
    this.recorderStream = null;
    if (silent) { this.listening.set(false); }
  }

  send(fromVoice = false): void {
    const text = this.inputText.trim();
    if (!text || this.sending()) { return; }
    this.inputText = '';
    this.messages.update((m) => [...m, { role: 'user', content: text }]);
    this.sending.set(true);
    const history = this.messages().slice(-10);
    // Append an empty assistant turn and fill it as chunks stream in.
    this.messages.update((m) => [...m, { role: 'assistant', content: '' }]);
    const idx = this.messages().length - 1;
    let acc = '';
    const setLast = (content: string) => this.messages.update((m) => {
      const copy = [...m];
      copy[idx] = { role: 'assistant', content };
      return copy;
    });
    this.svc.chatStream(
      { message: text, history },
      (delta) => this.zone.run(() => { acc += delta; setLast(acc); }),
      (done) => this.zone.run(() => {
        this.provider.set(done.model ? `${done.provider}:${done.model}` : done.provider);
        if (!acc && done.reply) { acc = done.reply; setLast(acc); }
        if (done.proposals?.length) {
          this.pendingProposals.update((p) => [...p, ...done.proposals!]);
        }
        this.sending.set(false);
        if (fromVoice || this.xrMode) { this.speak(acc); }
      }),
      (err) => this.zone.run(() => {
        setLast(`Could not reach the assistant (${(err as any)?.status ?? 'network'}).`);
        this.sending.set(false);
      }),
    );
  }

  confirmProposal(p: AiProposal): void {
    this.pendingProposals.update((list) => list.filter((x) => x.proposal_id !== p.proposal_id));
    this.svc.act(p.proposal_id, true).subscribe({
      next: (r) => this.messages.update((m) => [...m, {
        role: 'assistant',
        content: r.ok
          ? `Done: ${p.summary}`
          : (r.refused ? `Blocked: ${r.reason}` : `Failed: ${r.error ?? 'unknown error'}`),
      }]),
      error: (e) => this.messages.update((m) => [...m, {
        role: 'assistant', content: `Could not apply (${e?.status ?? 'network'}).`,
      }]),
    });
  }

  denyProposal(p: AiProposal): void {
    this.pendingProposals.update((list) => list.filter((x) => x.proposal_id !== p.proposal_id));
    this.messages.update((m) => [...m, { role: 'assistant', content: `Dismissed: ${p.summary}` }]);
  }

  speak(text: string): void {
    // ai-4: provider-backed TTS preferred; on any failure fall THROUGH
    // to the browser synthesizer rather than going quiet.
    if (this.voice()?.tts?.available) {
      this.speaking.set(true);
      this.svc.speakAudio(text).then((blob) => this.zone.run(() => {
        if (!this.speaking()) { return; }  // user hit stop meanwhile
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => this.zone.run(() => {
          this.speaking.set(false);
          URL.revokeObjectURL(audio.src);
        });
        audio.onerror = () => this.zone.run(() => this.speaking.set(false));
        this.playback = audio;
        audio.play().catch(() => this.speaking.set(false));
      })).catch(() => this.zone.run(() => {
        this.speaking.set(false);
        this.browserSpeak(text);
      }));
      return;
    }
    this.browserSpeak(text);
  }

  private browserSpeak(text: string): void {
    const synth = (window as any).speechSynthesis;
    if (!synth) { return; }
    try {
      synth.cancel();
      const utter = new (window as any).SpeechSynthesisUtterance(text);
      utter.onend = () => this.zone.run(() => this.speaking.set(false));
      utter.onerror = () => this.zone.run(() => this.speaking.set(false));
      this.speaking.set(true);
      synth.speak(utter);
    } catch { this.speaking.set(false); }
  }

  stopSpeaking(): void {
    try { (window as any).speechSynthesis?.cancel(); } catch { /* ignore */ }
    try { this.playback?.pause(); } catch { /* ignore */ }
    this.playback = null;
    this.speaking.set(false);
  }
}
