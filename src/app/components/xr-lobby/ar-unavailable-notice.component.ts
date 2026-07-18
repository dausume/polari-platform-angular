import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Buttons open these; the inline fallback line shows them as text
 *  when window.open can't work (common from inside an XR session). */
const WOLVIC_DL_URL = 'https://wolvic.com/dl';
const WOLVIC_DOCS_URL = 'https://wolvic.com/en/';
const WOLVIC_GITHUB_URL = 'https://github.com/Igalia/wolvic';

/** Best-effort headset family, sniffed from the UA. Drives which
 *  sideload steps (and which wolvic.com/dl build) we point at. */
type XrDevice =
  'meta' | 'vive' | 'pico' | 'lynx' | 'magicleap' | 'huawei' | 'unknown';

const DEVICE_LABELS: Record<Exclude<XrDevice, 'unknown'>, string> = {
  meta: 'Meta Quest',
  vive: 'HTC Vive (XR Elite)',
  pico: 'Pico',
  lynx: 'Lynx',
  magicleap: 'Magic Leap 2',
  huawei: 'Huawei',
};

/** Researched facts (2026-07): wolvic.com/dl's Chromium builds are
 *  Lynx, Meta, Pico, Magic Leap 2, Huawei VR Glasses and Huawei
 *  Vision Glasses — ALL need developer mode, and there is NO Vive
 *  build listed. The copy below must stay honest about that. */
const STEP1_DEFAULT = 'Enable developer mode + '
  + 'install-from-unknown-sources in your headset\'s settings '
  + '(varies per device).';
const STEP1: Partial<Record<XrDevice, string>> = {
  vive: 'Press the Vive button → Back to Lobby → open Settings → '
    + 'Advanced → toggle USB debugging ON. Also in Advanced, enable '
    + '\'Install unknown apps\' (unknown sources).',
  meta: 'You need a free Meta developer account (developer.meta.com). '
    + 'Then in the Meta Horizon phone app: Menu → Devices → your '
    + 'headset → Headset settings → Developer Mode → ON, and accept '
    + 'the USB debugging prompt in-headset. Sideload with SideQuest '
    + 'or adb.',
};
const STEP2_DEFAULT = 'Pick the build matching your headset on '
  + 'wolvic.com/dl.';
const STEP2: Partial<Record<XrDevice, string>> = {
  meta: 'Choose the META build on wolvic.com/dl.',
  pico: 'Choose the PICO build on wolvic.com/dl.',
  lynx: 'Choose the LYNX build on wolvic.com/dl.',
  magicleap: 'Choose the MAGIC LEAP 2 build on wolvic.com/dl.',
  huawei: 'Choose the HUAWEI VR GLASSES or HUAWEI VISION GLASSES '
    + 'build (whichever matches your device) on wolvic.com/dl.',
  vive: 'The downloads page currently lists NO Vive build (only '
    + 'Lynx, Meta, Pico, Magic Leap 2, Huawei). The XR Elite can '
    + 'sideload APKs, but none of these targets it — they may '
    + 'install yet fail to start an XR session. Watch wolvic.com/dl '
    + 'and the Wolvic GitHub for XR Elite support; until then this '
    + 'headset has no known WebXR-AR browser path, and zone capture '
    + 'keeps working in the VR fallback.',
};
const STEP3 = 'Transfer the APK over USB-C (allow storage access '
  + 'in-headset), open the file manager on the headset, tap the '
  + 'APK → Install, then open Wolvic Chromium and return to this '
  + 'page.';

/** Store-browser alternative, shown ABOVE the sideload steps. On
 *  Quest it is the LEAD recommendation (built-in browser already
 *  does WebXR AR); on the XR Elite there is honestly none. */
const ALT_DEFAULT = 'Easier alternative: check whether your '
  + 'headset\'s built-in browser supports WebXR AR before '
  + 'sideloading — some do.';
const ALT: Partial<Record<XrDevice, string>> = {
  meta: 'Easiest path on Quest: the BUILT-IN Meta Quest Browser '
    + 'supports WebXR AR out of the box — no sideloading needed. '
    + 'Open this page in the standard Quest browser instead of '
    + 'Wolvic. Sideloading Wolvic Chromium (below) is the secondary '
    + 'option.',
  vive: 'No store alternative exists on this headset: Vive Browser '
    + 'does not recognize immersive-ar (a known XR Elite '
    + 'limitation), and the store Wolvic build is Gecko-based '
    + 'without the AR module.',
};

/**
 * @module components/xr-lobby/ar-unavailable-notice
 *
 * The AR-passthrough-unavailable notice, DUAL-SURFACE by design: the
 * 2D zone-capture page renders it inline after an AR→VR fallback, and
 * the same component mounts off-screen under .xr-panel-context to be
 * rasterized as an in-headset HTMLMesh panel ('panel:ar-notice').
 *
 * HTMLMesh rasterizes this component's own DOM subtree, so the
 * template is OVERLAY-FREE: plain <button>/<p> only (no Material, no
 * cdk overlays — the zones-board rule), fixed 620 px width,
 * self-contained layout, CSS vars with hardcoded fallbacks.
 *
 * Copy is grounded in the researched facts (2026-07): Wolvic's
 * app-store builds are Gecko-based and ship WITHOUT the WebXR AR
 * module — no settings toggle exists for it; WebXR AR (passthrough)
 * ships in the separate Wolvic Chromium flavor, v1.1+, sideloaded
 * from wolvic.com/dl. The Vive XR Elite hardware itself supports
 * color passthrough — the browser is the missing piece.
 *
 * Inputs: `reason` — the runtime's arFallbackReason, shown verbatim.
 * The (dismiss) output renders a ✕ ONLY when bound; the XR panel copy
 * leaves it unbound and relies on the panel system's own ✕.
 */
@Component({
  standalone: true,
  selector: 'ar-unavailable-notice',
  imports: [CommonModule],
  template: `
    <div class="ar-notice">
      <div class="head">
        <h3>AR passthrough unavailable</h3>
        <button type="button" class="dismiss" *ngIf="dismissible"
                aria-label="Dismiss notice"
                (click)="dismiss.emit()">&#10005;</button>
      </div>
      <p class="detect">{{ browserLine }}</p>
      <p class="reason" *ngIf="reason">Runtime reported:
        {{ reason }}</p>
      <p class="fix">WebXR AR ships in the Wolvic Chromium flavor
        (v1.1+), installed as a separate APK — not from the app
        store.</p>
      <p class="alt" [class.lead]="device === 'meta'">
        {{ altLine }}</p>
      <h4>How to sideload Wolvic Chromium</h4>
      <p class="device">{{ deviceLine }}</p>
      <ol class="steps">
        <li *ngFor="let step of steps">{{ step }}</li>
      </ol>
      <div class="actions">
        <button type="button" (click)="open(dlUrl)">
          Get Wolvic Chromium — wolvic.com/dl</button>
        <button type="button" (click)="open(docsUrl)">
          Wolvic docs — wolvic.com</button>
        <button type="button" *ngIf="device === 'vive'"
                (click)="open(githubUrl)">
          Wolvic GitHub (roadmap)</button>
      </div>
      <p class="open-fallback" *ngFor="let url of failedUrls">
        Couldn't open a new window from XR — visit
        <span class="url">{{ url }}</span> from the browser bar</p>
    </div>
  `,
  styles: [`
    /* Fixed width + opaque background: this exact box rasterizes
       into an HTMLMesh quad. Vars carry the page theme; fallbacks
       keep the off-screen raster legible regardless. */
    .ar-notice { width: 620px; box-sizing: border-box;
      padding: 14px 16px; border-radius: 10px;
      border: 2px solid var(--warning-text, #8a5300);
      background: var(--surface-primary, #fff);
      color: var(--text-primary, #222);
      display: flex; flex-direction: column; gap: 8px; }
    .head { display: flex; align-items: center;
      justify-content: space-between; gap: 8px; }
    h3 { margin: 0; font-size: 1.2rem;
      color: var(--warning-text, #8a5300); }
    p { margin: 0; font-size: 1rem; line-height: 1.35; }
    .detect { font-weight: 600; }
    h4 { margin: 4px 0 0; font-size: 0.95rem;
      text-transform: uppercase; letter-spacing: 0.03em;
      color: var(--text-secondary, #666); }
    .alt { font-size: 0.95rem; }
    .alt.lead { font-weight: 600;
      color: var(--success-text, #1e6b2e); }
    .device { font-weight: 600; font-size: 0.95rem; }
    .steps { margin: 0; padding-left: 22px; display: flex;
      flex-direction: column; gap: 4px; }
    .steps li { font-size: 0.9rem; line-height: 1.35; }
    .reason { color: var(--text-secondary, #666);
      font-family: monospace; font-size: 0.9rem;
      overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px;
      margin-top: 2px; }
    button { font-size: 1rem; padding: 9px 14px;
      border-radius: 8px; cursor: pointer;
      border: 1px solid var(--border-medium, #ccc);
      background: var(--surface-secondary, #f5f5f5);
      color: var(--text-primary, #222); }
    .dismiss { padding: 4px 10px; font-size: 1rem; line-height: 1;
      border-radius: 50%; }
    .open-fallback { color: var(--error-text, #b3261e);
      font-size: 0.95rem; }
    .url { font-family: monospace; user-select: all;
      overflow-wrap: anywhere; }
  `],
})
export class ArUnavailableNoticeComponent {
  /** The runtime's arFallbackReason (why AR was not granted). */
  @Input() reason = '';
  /** Bound only where an inline dismiss makes sense — the ✕ renders
   *  iff someone is listening. */
  @Output() dismiss = new EventEmitter<void>();

  readonly dlUrl = WOLVIC_DL_URL;
  readonly docsUrl = WOLVIC_DOCS_URL;
  readonly githubUrl = WOLVIC_GITHUB_URL;
  /** Computed once — the UA can't change mid-lifetime. */
  readonly browserLine = ArUnavailableNoticeComponent.detectLine();
  readonly device = ArUnavailableNoticeComponent.detectDevice();
  readonly deviceLine = this.device === 'unknown'
    ? 'Device not recognized — pick your device\'s build manually'
    : 'Detected device: ' + DEVICE_LABELS[this.device];
  readonly altLine = ALT[this.device] ?? ALT_DEFAULT;
  /** The numbered sideload steps, tailored to the detected device:
   *  1 developer mode, 2 which wolvic.com/dl build, 3 install. */
  readonly steps: string[] = [
    STEP1[this.device] ?? STEP1_DEFAULT,
    STEP2[this.device] ?? STEP2_DEFAULT,
    STEP3,
  ];
  /** URLs whose window.open could not be confirmed — each renders
   *  the copy-it-yourself fallback line. */
  failedUrls: string[] = [];

  get dismissible(): boolean {
    return this.dismiss.observed;
  }

  /** Which Wolvic flavor is this? Gecko builds (the app-store ones)
   *  identify as Firefox and/or carry a real 'Gecko/<version>' token;
   *  Chromium/WebKit UAs only ever say 'like Gecko'. */
  private static detectLine(): string {
    const ua = navigator.userAgent || '';
    const gecko = ua.includes('Firefox')
      || (ua.includes('Gecko/') && !ua.includes('like Gecko'));
    if (gecko) {
      return 'You appear to be running the Gecko-based Wolvic (the '
        + 'app-store build) — it does not include the WebXR AR '
        + 'module, and no setting enables it.';
    }
    if (ua.includes('Chrome/') || ua.includes('Chromium')) {
      return 'You appear to be running a Chromium-based browser — '
        + 'WebXR AR needs Wolvic Chromium 1.1 or newer.';
    }
    return 'Could not tell which browser flavor this is from its '
      + 'user agent — WebXR AR needs Wolvic Chromium 1.1 or newer.';
  }

  /** Best-effort headset sniff from the lowercased UA. Order
   *  matters: 'meta' tokens first (Quest UAs may also say 'Mobile'),
   *  and vive/htc before the narrower vendor names. */
  private static detectDevice(): XrDevice {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('quest') || ua.includes('oculus')
      || ua.includes('meta')) return 'meta';
    if (ua.includes('vive') || ua.includes('htc')) return 'vive';
    if (ua.includes('pico')) return 'pico';
    if (ua.includes('lynx')) return 'lynx';
    if (ua.includes('magic leap') || ua.includes('ml2')) {
      return 'magicleap';
    }
    if (ua.includes('huawei')) return 'huawei';
    return 'unknown';
  }

  /** Open-with-fallback: XR sessions (and popup blockers) routinely
   *  swallow window.open — when the new window can't be CONFIRMED
   *  (null handle, or 1.5 s later this page is still the visible one
   *  and w.closed === false can't be verified), show the URL as
   *  selectable text instead of failing silently. */
  open(url: string): void {
    let w: Window | null = null;
    try {
      w = window.open(url, '_blank');
    } catch { /* treated as not-opened below */ }
    if (!w) {
      this.noteFailure(url);
      return;
    }
    setTimeout(() => {
      let confirmedOpen = false;
      try {
        confirmedOpen = w!.closed === false;
      } catch { /* cross-origin handle — cannot confirm */ }
      if (document.visibilityState === 'visible' && !confirmedOpen) {
        this.noteFailure(url);
      }
    }, 1500);
  }

  private noteFailure(url: string): void {
    if (!this.failedUrls.includes(url)) this.failedUrls.push(url);
  }
}
