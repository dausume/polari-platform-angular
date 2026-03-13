import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';

interface ClassDisplayGroup {
    className: string;
    displays: DisplaySummary[];
}

@Component({
    selector: 'app-displays',
    standalone: false,
    templateUrl: './displays.component.html',
    styleUrls: ['./displays.component.scss']
})
export class DisplaysComponent implements OnInit, OnDestroy {
    activeTab: 'all-displays' | 'published-pages' = 'all-displays';

    allDisplays: DisplaySummary[] = [];
    publishedDisplays: DisplaySummary[] = [];
    loading: boolean = false;
    expandedClasses: Set<string> = new Set();

    private subscriptions: Subscription[] = [];

    constructor(
        private displayManager: DisplayManagerService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.displayManager.displayList$.subscribe(displays => {
                this.allDisplays = displays;
            }),
            this.displayManager.publishedDisplays$.subscribe(displays => {
                this.publishedDisplays = displays;
            }),
            this.displayManager.loading$.subscribe(loading => {
                this.loading = loading;
            })
        );

        this.displayManager.fetchDisplayList();
        this.displayManager.fetchPublishedDisplays();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    setActiveTab(tab: 'all-displays' | 'published-pages'): void {
        this.activeTab = tab;
        if (tab === 'published-pages') {
            this.displayManager.fetchPublishedDisplays();
        }
    }

    get displaysByClass(): ClassDisplayGroup[] {
        const map = new Map<string, DisplaySummary[]>();
        for (const d of this.allDisplays) {
            const cls = d.source_class || 'Unassigned';
            if (!map.has(cls)) map.set(cls, []);
            map.get(cls)!.push(d);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([className, displays]) => ({ className, displays }));
    }

    toggleExpand(className: string): void {
        if (this.expandedClasses.has(className)) {
            this.expandedClasses.delete(className);
        } else {
            this.expandedClasses.add(className);
        }
    }

    isExpanded(className: string): boolean {
        return this.expandedClasses.has(className);
    }

    editDisplay(className: string, event: Event): void {
        event.stopPropagation();
        this.router.navigate(['/class-main-page', className], { queryParams: { tab: 'displays' } });
    }

    navigateToDisplayPage(display: DisplaySummary): void {
        this.router.navigate(['/display', display.id]);
    }

    refreshDisplays(): void {
        this.displayManager.fetchDisplayList();
        this.displayManager.fetchPublishedDisplays();
    }

    getLinkedSolutionCount(display: DisplaySummary): number {
        return display.linkedSolutions?.length || 0;
    }
}
