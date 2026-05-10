// latex-edit-dialog.ts
//
// Reusable popup for editing a LaTeX expression. Wraps the same pieces the
// equation-config-edit page uses inline (textarea + KaTeX live preview +
// symbol palette sidebar + references panel) so cell editors and other
// callers can offer a layperson-friendly equation-editing experience without
// duplicating UI.
//
// Soft validation: KaTeX parse errors render inline as a yellow warning,
// never block save. Returns the edited LaTeX string on dialog close.

import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SymbolPaletteEntry } from '@models/equations/SymbolPalette';
import katex from 'katex';

export interface LatexEditDialogData {
    /** Initial LaTeX value to populate the textarea with. */
    latex: string;
    /** Title shown at the top of the dialog. */
    title?: string;
    /** Optional subtitle / hint shown under the title. */
    subtitle?: string;
}

export interface LatexEditDialogResult {
    action: 'save' | 'cancel';
    latex?: string;
}

@Component({
    standalone: false,
    selector: 'latex-edit-dialog',
    templateUrl: './latex-edit-dialog.html',
    styleUrls: ['./latex-edit-dialog.css'],
})
export class LatexEditDialogComponent {

    @ViewChild('latexInput') textareaRef?: ElementRef<HTMLTextAreaElement>;

    latex: string = '';
    /** Soft-validation message — populated when KaTeX `parse` throws. */
    parseError: string | null = null;

    /** Last-known cursor position so palette clicks (which preventDefault
     *  the textarea blur) still insert at the right spot. */
    private lastKnownCursor: number = 0;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: LatexEditDialogData,
        private dialogRef: MatDialogRef<LatexEditDialogComponent>,
    ) {
        this.latex = data.latex || '';
        this.validate();
    }

    onLatexChange(value: string): void {
        this.latex = value;
        this.validate();
    }

    /** Soft KaTeX validation — populates `parseError` instead of throwing. */
    private validate(): void {
        const expr = (this.latex || '').trim();
        if (!expr) {
            this.parseError = null;
            return;
        }
        try {
            // KaTeX's __parse exists and throws on invalid LaTeX; fall back
            // to a render-to-detached call if not present.
            const k: any = katex as any;
            if (typeof k.__parse === 'function') {
                k.__parse(expr, { throwOnError: true });
            } else {
                const tmp = document.createElement('div');
                k.render(expr, tmp, { throwOnError: true });
            }
            this.parseError = null;
        } catch (err: any) {
            this.parseError = (err?.message || String(err)).split('\n')[0];
        }
    }

    onTextareaInit(textarea: HTMLTextAreaElement): void {
        textarea.addEventListener('blur', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
        textarea.addEventListener('keyup', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
        textarea.addEventListener('mouseup', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
    }

    insertSymbol(entry: SymbolPaletteEntry): void {
        const ta = this.textareaRef?.nativeElement;
        if (!ta) return;
        const live = ta.selectionStart;
        const start = (document.activeElement === ta && live != null)
            ? live
            : this.lastKnownCursor;
        const end = (document.activeElement === ta && ta.selectionEnd != null)
            ? ta.selectionEnd
            : start;
        const before = this.latex.slice(0, start);
        const after = this.latex.slice(end);
        this.latex = before + entry.latex + after;
        this.validate();
        const offset = entry.cursorOffset ?? 0;
        const newCursor = before.length + entry.latex.length - offset;
        this.lastKnownCursor = newCursor;
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(newCursor, newCursor);
        }, 0);
    }

    save(): void {
        this.dialogRef.close({
            action: 'save',
            latex: this.latex,
        } as LatexEditDialogResult);
    }

    onCancel(): void {
        this.dialogRef.close({ action: 'cancel' } as LatexEditDialogResult);
    }
}
