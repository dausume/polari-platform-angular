// claim-edit-dialog.ts
//
// The proofs CLAIM EDITOR (mathproofs, plan COMPUTE_LOD_TENSOR §I.7 pf-3) — the same assistive shape as
// latex-edit-dialog (textarea + live preview + categorized symbol palette + references), with OUR vocabulary:
// the palette inserts TERM-LANGUAGE snippets (the statement every checker tier lowers), the preview shows the
// LaTeX the BACKEND derives from the term (POST /api/mathproofs/terms/preview — never authored here), which
// tier would speak to it, and the validator's errors by path. Save writes the claim through the authoring door
// (POST /api/mathproofs/claims): validated, stored with provenance, checked at once through its cheapest tier
// — the verdict comes back into the dialog before it closes. Lean is never run from here (a person asks by name).

import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SymbolPaletteCategory, SymbolPaletteEntry, paletteInsertText } from '@models/equations/SymbolPalette';
import { CLAIM_TERM_PALETTE_CATEGORIES } from '@models/proofs/ClaimTermPalette';
import { PolariService } from '@services/polari-service';

export interface ClaimEditDialogData {
    /** The rows the claim speaks of, "<Class>:<name>" — prefilled by the opener (a mapping's row, a selection). */
    about?: string[];
    /** Where the door was opened from (provenance). */
    from?: string;
    /** A starting term (JSON) — e.g. the opener proposes a shape. */
    statement?: any;
    title?: string;
    subtitle?: string;
    kind?: string;
    name?: string;
}

export interface ClaimEditDialogResult {
    action: 'saved' | 'cancel';
    claim?: string;
    status?: string;
    check?: any;
}

@Component({
    standalone: false,
    selector: 'claim-edit-dialog',
    templateUrl: './claim-edit-dialog.html',
    styleUrls: ['../latex-edit-dialog/latex-edit-dialog.css', './claim-edit-dialog.css'],
})
export class ClaimEditDialogComponent {

    @ViewChild('termInput') textareaRef?: ElementRef<HTMLTextAreaElement>;

    categories: SymbolPaletteCategory[] = CLAIM_TERM_PALETTE_CATEGORIES;
    kinds: string[] = ['identity', 'inequality', 'domain-inclusion', 'composition', 'conservation', 'symmetry', 'commutation', 'bound', 'well-typed'];

    name = '';
    kind = 'identity';
    about = '';
    description = '';
    budget = 25;
    term = '';

    /** The backend's reading of the term as typed: derived LaTeX, the tier, the hash, the errors by path. */
    preview: { valid: boolean; errors: string[]; latex: string; tier: string | null; statement_hash: string; note?: string } | null = null;
    previewing = false;
    saving = false;
    saveError: string | null = null;
    /** After save: what the cheapest tier said (the claim's status + verdict), shown before the dialog closes. */
    saved: { claim: string; status: string; check: any } | null = null;

    private lastKnownCursor = 0;
    private previewRequests = new Subject<string>();
    private sub: Subscription;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: ClaimEditDialogData,
        private dialogRef: MatDialogRef<ClaimEditDialogComponent>,
        private http: HttpClient,
        private polariService: PolariService,
    ) {
        this.about = (data.about || []).join(', ');
        this.name = data.name || '';
        this.kind = data.kind || 'identity';
        this.term = data.statement ? JSON.stringify(data.statement, null, 1) : '';
        this.sub = this.previewRequests.pipe(debounceTime(350)).subscribe((t) => this.askPreview(t));
        if (this.term) { this.previewRequests.next(this.term); }
    }

    ngOnDestroy(): void { this.sub.unsubscribe(); }

    onTermChange(value: string): void {
        this.term = value;
        this.saveError = null;
        this.previewRequests.next(value);
    }

    /** ONE derivation of the LaTeX — the backend's — rendered live; the editor never authors LaTeX (D-pf-2). */
    private askPreview(text: string): void {
        const trimmed = (text || '').trim();
        if (!trimmed) { this.preview = null; return; }
        this.previewing = true;
        const base = this.polariService.getBackendBaseUrl();
        this.http.post<any>(`${base}/api/mathproofs/terms/preview`, { statement: trimmed }, this.polariService.backendRequestOptions).subscribe({
            next: (p: any) => { this.preview = p; this.previewing = false; },
            error: (e: any) => { this.preview = { valid: false, errors: [e?.error?.error || `preview failed (${e?.status ?? '?'})`], latex: '', tier: null, statement_hash: '' }; this.previewing = false; },
        });
    }

    onTextareaInit(textarea: HTMLTextAreaElement): void {
        const remember = () => { this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor; };
        textarea.addEventListener('blur', remember);
        textarea.addEventListener('keyup', remember);
        textarea.addEventListener('mouseup', remember);
    }

    insertSymbol(entry: SymbolPaletteEntry): void {
        const ta = this.textareaRef?.nativeElement;
        if (!ta) return;
        const live = ta.selectionStart;
        const start = (document.activeElement === ta && live != null) ? live : this.lastKnownCursor;
        const end = (document.activeElement === ta && ta.selectionEnd != null) ? ta.selectionEnd : start;
        const before = this.term.slice(0, start);
        const after = this.term.slice(end);
        const text = paletteInsertText(entry);
        this.term = before + text + after;
        this.previewRequests.next(this.term);
        const offset = entry.cursorOffset ?? 0;
        const newCursor = before.length + text.length - offset;
        this.lastKnownCursor = newCursor;
        setTimeout(() => { ta.focus(); ta.setSelectionRange(newCursor, newCursor); }, 0);
    }

    get canSave(): boolean {
        return !!this.name.trim() && !!this.preview?.valid && !this.saving && !this.saved;
    }

    save(): void {
        if (!this.canSave) return;
        this.saving = true; this.saveError = null;
        const base = this.polariService.getBackendBaseUrl();
        let statement: any;
        try { statement = JSON.parse(this.term); } catch (e: any) { this.saveError = 'the term is not JSON'; this.saving = false; return; }
        const body = {
            name: this.name.trim(), kind: this.kind, description: this.description,
            about: this.about.split(',').map((s) => s.trim()).filter(Boolean),
            statement, budget_s: this.budget, from: this.data.from || 'claim-edit-dialog',
        };
        this.http.post<any>(`${base}/api/mathproofs/claims`, body, this.polariService.backendRequestOptions).subscribe({
            next: (r: any) => { this.saving = false; this.saved = { claim: r.claim, status: r.status, check: r.check }; },
            error: (e: any) => {
                this.saving = false;
                const err = e?.error || {};
                this.saveError = (err.error || `save failed (${e?.status ?? '?'})`) + (err.errors ? ' — ' + err.errors.join('; ') : '');
            },
        });
    }

    close(): void {
        if (this.saved) {
            this.dialogRef.close({ action: 'saved', claim: this.saved.claim, status: this.saved.status, check: this.saved.check } as ClaimEditDialogResult);
        } else {
            this.dialogRef.close({ action: 'cancel' } as ClaimEditDialogResult);
        }
    }

    verdictWord(): string {
        const c = this.saved?.check || {};
        if (c.verdict == null) { return c.note || 'not run'; }
        return `${c.verdict} (${c.tier}) → ${this.saved?.status}`;
    }
}
