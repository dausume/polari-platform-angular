import {
    Component,
    Input,
    OnChanges,
    SimpleChanges,
    ElementRef,
    ViewChild,
    AfterViewInit
} from '@angular/core';
import katex from 'katex';

/**
 * Small reusable wrapper that renders a LaTeX string inline via KaTeX.
 *
 * Usage:
 *   <katex-display [latex]="someLatex" [displayMode]="true"></katex-display>
 */
@Component({
    standalone: false,
    selector: 'katex-display',
    template: `<div #container class="katex-display-container" [class.empty]="!latex"></div>`,
    styles: [`
        :host { display: block; }
        .katex-display-container {
            overflow-x: auto;
            min-height: 1em;
            color: var(--text-primary, #222);
        }
        .katex-display-container.empty::before {
            content: attr(data-placeholder);
            color: var(--text-tertiary, #888);
            font-style: italic;
        }
    `]
})
export class KatexDisplayComponent implements OnChanges, AfterViewInit {
    @Input() latex: string = '';
    @Input() displayMode: boolean = true;
    @Input() placeholder: string = '(no expression)';

    @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

    private viewReady = false;

    ngAfterViewInit(): void {
        this.viewReady = true;
        this.render();
    }

    ngOnChanges(_changes: SimpleChanges): void {
        if (this.viewReady) {
            this.render();
        }
    }

    private render(): void {
        const el = this.container?.nativeElement;
        if (!el) return;
        const src = (this.latex ?? '').trim();
        if (!src) {
            el.textContent = '';
            el.setAttribute('data-placeholder', this.placeholder);
            return;
        }
        el.removeAttribute('data-placeholder');
        try {
            katex.render(src, el, {
                throwOnError: false,
                displayMode: this.displayMode,
                output: 'html'
            });
        } catch (e: any) {
            el.textContent = `Error rendering LaTeX: ${e?.message || e}`;
        }
    }
}
