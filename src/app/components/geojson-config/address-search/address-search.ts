import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { GeocoderResult, GeocoderSummary } from '@models/geojson/GeocoderDefinition';
import { GeocoderDefinitionService } from '@services/geojson/geocoder-definition.service';
import { GeocoderService } from '@services/geojson/geocoder.service';

@Component({
    standalone: true,
    selector: 'address-search',
    template: `
        <div class="address-search">
            <!-- Geocoder selector (hidden when only one geocoder) -->
            <mat-form-field *ngIf="!geocoderId && availableGeocoders.length > 1"
                            appearance="outline" class="full-width geocoder-select">
                <mat-label>Geocoder</mat-label>
                <mat-select [(value)]="selectedGeocoderId">
                    <mat-option *ngFor="let g of availableGeocoders" [value]="g.id">
                        {{ g.name }} ({{ g.provider }})
                    </mat-option>
                </mat-select>
            </mat-form-field>

            <!-- Search input -->
            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Search address</mat-label>
                <input matInput [(ngModel)]="searchQuery" (ngModelChange)="onSearchInput($event)"
                       placeholder="e.g. 1600 Pennsylvania Ave, Washington DC">
                <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>

            <!-- Loading state -->
            <div *ngIf="searching" class="status-row">
                <mat-spinner diameter="20"></mat-spinner>
                <span>Searching...</span>
            </div>

            <!-- Error state -->
            <div *ngIf="error" class="status-row error-text">
                <mat-icon>warning</mat-icon>
                <span>{{ error }}</span>
            </div>

            <!-- No results -->
            <div *ngIf="searched && !searching && !error && results.length === 0" class="status-row">
                <mat-icon>location_off</mat-icon>
                <span>No results found</span>
            </div>

            <!-- Results list -->
            <mat-list *ngIf="results.length > 0" class="results-list">
                <mat-list-item *ngFor="let result of results" class="result-item"
                               (click)="selectResult(result)">
                    <mat-icon matListItemIcon>place</mat-icon>
                    <div matListItemTitle>{{ result.displayName }}</div>
                    <div matListItemLine class="coord-line">
                        {{ result.lat.toFixed(5) }}, {{ result.lng.toFixed(5) }}
                        <span *ngIf="result.confidence" class="confidence">
                            ({{ (result.confidence * 100).toFixed(0) }}%)
                        </span>
                    </div>
                </mat-list-item>
            </mat-list>
        </div>
    `,
    styles: [`
        .address-search { display: flex; flex-direction: column; }
        .full-width { width: 100%; }
        .geocoder-select { margin-bottom: 4px; }
        .status-row { display: flex; align-items: center; gap: 8px; color: #666; font-size: 13px; padding: 4px 0; }
        .error-text { color: #e15759; }
        .results-list { max-height: 240px; overflow-y: auto; margin-top: 0; }
        .result-item { cursor: pointer; }
        .result-item:hover { background: #f5f5f5; }
        .coord-line { font-size: 12px; color: #888; }
        .confidence { margin-left: 4px; color: #aaa; }
    `],
    imports: [
        CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatIconModule, MatListModule, MatProgressSpinnerModule
    ]
})
export class AddressSearchComponent implements OnInit, OnDestroy {
    @Input() geocoderId?: string;
    @Output() resultSelected = new EventEmitter<GeocoderResult>();

    availableGeocoders: GeocoderSummary[] = [];
    selectedGeocoderId: string = '';
    searchQuery = '';
    results: GeocoderResult[] = [];
    searching = false;
    searched = false;
    error = '';

    private searchSubject = new Subject<string>();
    private searchSub: Subscription | null = null;
    private geocoderSub: Subscription | null = null;

    constructor(
        private geocoderDefService: GeocoderDefinitionService,
        private geocoderService: GeocoderService
    ) {}

    ngOnInit(): void {
        // Load available geocoders
        this.geocoderSub = this.geocoderDefService.allGeocoders$.subscribe(geocoders => {
            this.availableGeocoders = geocoders;
            if (!this.selectedGeocoderId && geocoders.length > 0) {
                this.selectedGeocoderId = geocoders[0].id;
            }
        });
        this.geocoderDefService.fetchAll();

        // If a specific geocoder is locked, use it
        if (this.geocoderId) {
            this.selectedGeocoderId = this.geocoderId;
        }

        // Set up debounced search pipeline
        this.searchSub = this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            filter(q => q.length >= 3),
            switchMap(query => {
                this.searching = true;
                this.error = '';
                const gId = this.geocoderId || this.selectedGeocoderId || undefined;
                return this.geocoderService.forwardGeocode(query, gId);
            })
        ).subscribe({
            next: (results) => {
                this.results = results;
                this.searching = false;
                this.searched = true;
            },
            error: (err) => {
                this.searching = false;
                this.searched = true;
                this.error = err?.message || 'Search failed.';
                this.results = [];
                // Re-subscribe after error (switchMap unsubscribes on error)
                this.setupSearchPipeline();
            }
        });
    }

    ngOnDestroy(): void {
        this.searchSub?.unsubscribe();
        this.geocoderSub?.unsubscribe();
    }

    onSearchInput(query: string): void {
        if (query.length < 3) {
            this.results = [];
            this.searched = false;
            this.error = '';
            return;
        }
        this.searchSubject.next(query);
    }

    selectResult(result: GeocoderResult): void {
        this.resultSelected.emit(result);
    }

    private setupSearchPipeline(): void {
        this.searchSub?.unsubscribe();
        this.searchSub = this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            filter(q => q.length >= 3),
            switchMap(query => {
                this.searching = true;
                this.error = '';
                const gId = this.geocoderId || this.selectedGeocoderId || undefined;
                return this.geocoderService.forwardGeocode(query, gId);
            })
        ).subscribe({
            next: (results) => {
                this.results = results;
                this.searching = false;
                this.searched = true;
            },
            error: (err) => {
                this.searching = false;
                this.searched = true;
                this.error = err?.message || 'Search failed.';
                this.results = [];
                this.setupSearchPipeline();
            }
        });
    }
}
