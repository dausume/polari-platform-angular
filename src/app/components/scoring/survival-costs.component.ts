import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccountabilityService } from '@services/scoring/accountability.service';
import {
  ContextRow, ContributorRow,
  SurvivalReport, SurvivalSubmitResult, SurvivalWalkthrough,
} from '@models/scoring/scoring-types';

/** One in-progress wizard entry. */
interface StepEntry {
  amount: number | null;
  notes: string;
  skipped: boolean;
}

/**
 * Survival-cost walkthrough (/scoring/survival, scr-12a): walks a
 * person through one month of survival costs, category by category —
 * the steps and their guidance ('open your bank app…') are generated
 * from the editable CostCategory rows. Skips are honest gaps.
 * Submitted amounts land as engine-native values; the area report
 * shows what surviving here costs and how much of it is pseudo-tax.
 */
@Component({
  standalone: true,
  selector: 'survival-costs',
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './survival-costs.component.html',
  styleUrls: ['./survival-costs.component.scss'],
})
export class SurvivalCostsComponent implements OnInit {
  walkthrough: SurvivalWalkthrough | null = null;
  locations: ContextRow[] = [];
  months: ContextRow[] = [];
  contributors: ContributorRow[] = [];
  loading = true;

  // Wizard state.
  contributor = '';
  location = '';
  month = '';
  householdSize = 1;
  workers = 1;
  carsNeeded = 0;
  stepIndex = -1;  // -1 = the household/setup page
  entries = new Map<string, StepEntry>();
  submitting = false;
  result: SurvivalSubmitResult | null = null;

  // Area report state.
  reportLocation = '';
  reportMonth = '';
  report: SurvivalReport | null = null;

  constructor(private accountability: AccountabilityService) {}

  async ngOnInit(): Promise<void> {
    const [walkthrough, contexts, contributors] = await Promise.all([
      this.accountability.survivalWalkthrough(),
      this.accountability.contexts(),
      this.accountability.contributors(),
    ]);
    this.walkthrough = walkthrough;
    this.locations = contexts.filter(
      c => c.context_type === 'location');
    this.months = contexts.filter(
      c => c.context_type === 'timeframe');
    this.contributors = contributors;
    for (const step of walkthrough?.steps ?? []) {
      this.entries.set(step.category,
        { amount: null, notes: '', skipped: false });
    }
    this.location = this.locations[0]?.name ?? '';
    this.month = this.months[0]?.name ?? '';
    this.reportLocation = this.location;
    this.loading = false;
  }

  get steps() { return this.walkthrough?.steps ?? []; }

  get currentStep() {
    return this.stepIndex >= 0 && this.stepIndex < this.steps.length
      ? this.steps[this.stepIndex] : null;
  }

  entry(category: string): StepEntry {
    let entry = this.entries.get(category);
    if (!entry) {
      entry = { amount: null, notes: '', skipped: false };
      this.entries.set(category, entry);
    }
    return entry;
  }

  begin(): void { this.stepIndex = 0; }

  next(): void {
    if (this.stepIndex < this.steps.length) { this.stepIndex++; }
  }

  back(): void {
    if (this.stepIndex > -1) { this.stepIndex--; }
  }

  skipCurrent(): void {
    const step = this.currentStep;
    if (step) {
      const entry = this.entry(step.category);
      entry.skipped = true;
      entry.amount = null;
      this.next();
    }
  }

  get atReview(): boolean {
    return this.stepIndex >= this.steps.length;
  }

  enteredSteps(): { category: string; displayName: string;
                    kind: string; amount: number }[] {
    return this.steps
      .filter(s => {
        const entry = this.entries.get(s.category);
        return entry && !entry.skipped && entry.amount !== null;
      })
      .map(s => ({
        category: s.category, displayName: s.displayName,
        kind: s.kind,
        amount: this.entries.get(s.category)!.amount!,
      }));
  }

  skippedSteps(): string[] {
    return this.steps
      .filter(s => {
        const entry = this.entries.get(s.category);
        return !entry || entry.skipped || entry.amount === null;
      })
      .map(s => s.displayName);
  }

  runningTotal(): number {
    return this.enteredSteps()
      .reduce((sum, s) => sum + s.amount, 0);
  }

  async submit(): Promise<void> {
    this.submitting = true;
    const entries: Record<string, {
      amount: number; notes: string;
    }> = {};
    for (const s of this.enteredSteps()) {
      entries[s.category] = {
        amount: s.amount,
        notes: this.entries.get(s.category)?.notes ?? '',
      };
    }
    this.result = await this.accountability.survivalSubmit({
      contributor: this.contributor,
      location: this.location,
      month: this.month,
      household_size: this.householdSize,
      workers: this.workers,
      cars_needed: this.carsNeeded,
      entries,
    });
    this.submitting = false;
    if (this.result?.ok) {
      this.reportLocation = this.location;
      this.reportMonth = this.month;
      await this.loadReport();
    }
  }

  async loadReport(): Promise<void> {
    if (!this.reportLocation) { return; }
    this.report = await this.accountability.survivalReport(
      this.reportLocation, this.reportMonth);
  }

  kindEntries(subtotals: Record<string, number>):
      { kind: string; amount: number }[] {
    return Object.entries(subtotals)
      .map(([kind, amount]) => ({ kind, amount }));
  }

  percent(fraction: number | null): string {
    return fraction === null || fraction === undefined
      ? '—' : `${(fraction * 100).toFixed(1)}%`;
  }
}
