import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import { EquationDefinitionSummary } from '@models/equations/EquationDefinition';

/**
 * Optional list sidebar that mirrors `dataset-config-sidebar`.
 *
 * Embedded in pages that want a quick "switch between equations" panel
 * without a full route change. Emits `selected` when the user picks an
 * equation row; the host decides whether to navigate or load inline.
 */
@Component({
    standalone: false,
    selector: 'equation-config-sidebar',
    templateUrl: './equation-config-sidebar.component.html',
    styleUrls: ['./equation-config-sidebar.component.scss']
})
export class EquationConfigSidebarComponent implements OnInit, OnDestroy {

    /** Optional filter — if set, only equations with this source_class are shown. */
    @Input() sourceClass: string | null = null;

    /** Currently selected ID (drives row highlight). */
    @Input() selectedId: string | null = null;

    @Output() selected = new EventEmitter<EquationDefinitionSummary>();
    @Output() createNew = new EventEmitter<void>();

    configs: EquationDefinitionSummary[] = [];
    loading = false;

    private subs: Subscription[] = [];

    constructor(private equationDefService: EquationDefinitionService) {}

    ngOnInit(): void {
        this.subs.push(
            this.equationDefService.allConfigList$.subscribe(list => {
                this.configs = this.sourceClass
                    ? list.filter(c => (c.source_class || '') === this.sourceClass)
                    : list;
            }),
            this.equationDefService.loading$.subscribe(l => this.loading = l)
        );
        this.equationDefService.fetchAllConfigs();
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    onSelect(c: EquationDefinitionSummary): void {
        this.selected.emit(c);
    }

    onCreate(): void {
        this.createNew.emit();
    }

    refresh(): void {
        this.equationDefService.refreshList();
    }
}
