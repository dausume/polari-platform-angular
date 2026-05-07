// Author: Dustin Etts
// Right-side LaTeX symbol palette for the Equations editor.
//
// Renders an accordion of categorized buttons. Each button shows the symbol
// (KaTeX-rendered), a small label, opens a docs link via the `?` info icon,
// and emits `(insert)` with the LaTeX snippet on click.
//
// Contract:
//   <app-equation-symbol-palette
//      (insert)="onPaletteInsert($event)">
//   </app-equation-symbol-palette>
//
// `$event` payload is `SymbolPaletteEntry` so the consumer can use both
// `entry.latex` and `entry.cursorOffset` to position the cursor inside
// templates like `\frac{│}{}`.

import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import {
    SymbolPaletteCategory,
    SymbolPaletteEntry,
    SYMBOL_PALETTE_CATEGORIES,
    filterPalette
} from '@models/equations/SymbolPalette';

@Component({
    selector: 'app-equation-symbol-palette',
    standalone: false,
    templateUrl: './equation-symbol-palette.component.html',
    styleUrls: ['./equation-symbol-palette.component.scss']
})
export class EquationSymbolPaletteComponent implements OnInit {

    @Output() insert = new EventEmitter<SymbolPaletteEntry>();

    categories: SymbolPaletteCategory[] = SYMBOL_PALETTE_CATEGORIES;

    /** Track which category accordions are expanded. Defaults to first two open. */
    expanded: { [name: string]: boolean } = {};

    /** Live search filter text. */
    query: string = '';

    /** When `query` is non-empty, this holds the flat filter results. */
    filtered: SymbolPaletteEntry[] = [];

    /** Hovered button — drives the bottom "ghost preview" strip. */
    hovered: SymbolPaletteEntry | null = null;

    ngOnInit(): void {
        // Open the first two categories by default.
        this.categories.slice(0, 2).forEach(c => this.expanded[c.name] = true);
    }

    onSearchInput(value: string): void {
        this.query = value || '';
        this.filtered = this.query.trim() ? filterPalette(this.query) : [];
    }

    clearSearch(): void {
        this.query = '';
        this.filtered = [];
    }

    toggleCategory(name: string): void {
        this.expanded[name] = !this.expanded[name];
    }

    isExpanded(name: string): boolean {
        return !!this.expanded[name];
    }

    onClickInsert(entry: SymbolPaletteEntry, event: MouseEvent): void {
        event.stopPropagation();
        this.insert.emit(entry);
    }

    onDocsClick(event: MouseEvent): void {
        // Stop the parent button's click handler so the docs link opens
        // without inserting the snippet too.
        event.stopPropagation();
    }

    onHoverEnter(entry: SymbolPaletteEntry): void {
        this.hovered = entry;
    }

    onHoverLeave(entry: SymbolPaletteEntry): void {
        if (this.hovered === entry) {
            this.hovered = null;
        }
    }

    trackByLatex(_: number, entry: SymbolPaletteEntry): string {
        return entry.latex;
    }

    trackByCategory(_: number, c: SymbolPaletteCategory): string {
        return c.name;
    }
}
