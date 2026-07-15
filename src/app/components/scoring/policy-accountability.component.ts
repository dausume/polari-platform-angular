import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccountabilityService } from '@services/scoring/accountability.service';
import { ScoringService } from '@services/scoring/scoring.service';
import {
  AssertionRow, CohortReport, ContributorRow,
  ContributorRecord, ElectionRow, ElectionTally, GroupBiasReport,
  OutletAccuracyReport, PolicyScoreReport, PoliticianScoreReport,
  SubjectRow, SuggestionReport, ValidityReport,
  ScoreConceptSummary, ScoreGroupRow,
} from '@models/scoring/scoring-types';

/**
 * Policy accountability (/scoring/accountability, scr-5/6/8): the
 * chain from asserted policy text spans → evidence-weighted policy
 * scores → vote-weighted politician scores → cohort reads → worldview
 * elections. Everything shown carries its evidence; the only writes
 * are the explicit knob actions (assertion status transitions,
 * election apply) — both refuse dishonest moves server-side.
 */
@Component({
  standalone: true,
  selector: 'policy-accountability',
  imports: [CommonModule, FormsModule, RouterModule, MatTooltipModule],
  templateUrl: './policy-accountability.component.html',
  styleUrls: ['./policy-accountability.component.scss'],
})
export class PolicyAccountabilityComponent implements OnInit {
  concepts: ScoreConceptSummary[] = [];
  activeConcept = '';
  loading = true;

  policies: SubjectRow[] = [];
  policyReports = new Map<string, PolicyScoreReport>();
  expandedPolicies = new Set<string>();

  assertions: AssertionRow[] = [];
  expandedAssertions = new Set<string>();
  suggestions = new Map<string, SuggestionReport>();
  validity = new Map<string, ValidityReport>();
  transitionBy = '';
  transitionError = '';

  politicians: SubjectRow[] = [];
  politicianReports = new Map<string, PoliticianScoreReport>();
  expandedPoliticians = new Set<string>();
  cohorts: ScoreGroupRow[] = [];
  cohortReports = new Map<string, CohortReport>();

  elections: ElectionRow[] = [];
  tallies = new Map<string, ElectionTally>();
  applyResults = new Map<string, string>();

  contributors: ContributorRow[] = [];
  records = new Map<string, ContributorRecord>();

  outlets: SubjectRow[] = [];
  outletRecords = new Map<string, OutletAccuracyReport>();
  expandedOutlets = new Set<string>();

  biasGroups: ScoreGroupRow[] = [];
  biasReports = new Map<string, GroupBiasReport>();
  expandedBias = new Set<string>();

  /** Lifecycle moves the transition endpoint will accept. */
  private static readonly NEXT_STATUSES: Record<string, string[]> = {
    'asserted': ['under-review', 'confirmed', 'rejected'],
    'under-review': ['confirmed', 'rejected'],
    'confirmed': ['under-review'],
    'rejected': ['under-review'],
  };

  constructor(private accountability: AccountabilityService,
              private scoringService: ScoringService) {}

  async ngOnInit(): Promise<void> {
    const [concepts, subjects, assertions, groups, elections,
           contributors] = await Promise.all([
      this.scoringService.concepts(),
      this.accountability.subjects(),
      this.accountability.assertions(),
      this.scoringService.groups(),
      this.accountability.elections(),
      this.accountability.contributors(),
    ]);
    this.concepts = concepts;
    this.policies = subjects.filter(s => s.kind === 'policy');
    this.politicians = subjects.filter(s => s.kind === 'politician');
    this.outlets = subjects.filter(s => s.kind === 'media-outlet');
    this.biasGroups = groups.filter(g => {
      try {
        return JSON.parse(
          (g as unknown as {
            member_contributor_names_json?: string;
          }).member_contributor_names_json || '[]').length > 0;
      } catch { return false; }
    });
    this.assertions = assertions;
    this.cohorts = groups.filter(g => {
      try {
        return JSON.parse(
          (g as unknown as { member_subject_names_json?: string })
            .member_subject_names_json || '[]').length > 0;
      } catch { return false; }
    });
    this.elections = elections;
    this.contributors = contributors;
    this.loading = false;
    this.activeConcept = concepts.find(
      c => c.name === 'labor-quality')?.name ?? concepts[0]?.name ?? '';
    if (this.activeConcept) { await this.rescore(); }
    void this.loadElections();
    void this.loadContributors();
    void this.loadOutlets();
    void this.loadBias();
  }

  private async loadOutlets(): Promise<void> {
    await Promise.all(this.outlets.map(async o => {
      const record = await this.accountability.outletAccuracy(o.name);
      if (record) { this.outletRecords.set(o.name, record); }
    }));
  }

  private async loadBias(): Promise<void> {
    await Promise.all(this.biasGroups.map(async g => {
      const report = await this.accountability.groupBias(g.name);
      if (report?.ok) { this.biasReports.set(g.name, report); }
    }));
  }

  toggleOutlet(name: string): void {
    this.toggleIn(this.expandedOutlets, name);
  }

  toggleBias(name: string): void {
    this.toggleIn(this.expandedBias, name);
  }

  errorPercent(error: number | null): string {
    return error === null || error === undefined
      ? '—' : `${(error * 100).toFixed(2)}%`;
  }

  outletEntries(cited: Record<string, {
    citations: number; meanRelativeError: number | null;
  }>): { name: string; citations: number;
         meanRelativeError: number | null }[] {
    return Object.entries(cited)
      .map(([name, v]) => ({ name, ...v }));
  }

  gradeEntries(grades: Record<string, number>):
      { grade: string; count: number }[] {
    return Object.entries(grades)
      .map(([grade, count]) => ({ grade, count }));
  }

  async selectConcept(name: string): Promise<void> {
    this.activeConcept = name;
    this.policyReports.clear();
    this.politicianReports.clear();
    this.cohortReports.clear();
    await this.rescore();
  }

  private async rescore(): Promise<void> {
    const concept = this.activeConcept;
    await Promise.all([
      ...this.policies.map(async p => {
        const report = await this.accountability.policyScore(
          p.name, concept);
        if (report) { this.policyReports.set(p.name, report); }
      }),
      ...this.politicians.map(async p => {
        const report = await this.accountability.politicianScore(
          p.name, concept);
        if (report) { this.politicianReports.set(p.name, report); }
      }),
      ...this.cohorts.map(async g => {
        const report = await this.accountability.cohortReport(
          g.name, concept);
        if (report) { this.cohortReports.set(g.name, report); }
      }),
    ]);
  }

  private async loadElections(): Promise<void> {
    await Promise.all(this.elections.map(async e => {
      const tally = await this.accountability.electionTally(e.name);
      if (tally) { this.tallies.set(e.name, tally); }
    }));
  }

  private async loadContributors(): Promise<void> {
    await Promise.all(this.contributors.map(async c => {
      const record = await this.accountability.contributorRecord(
        c.name);
      if (record?.ok) { this.records.set(c.name, record); }
    }));
  }

  togglePolicy(name: string): void {
    this.toggleIn(this.expandedPolicies, name);
  }

  togglePolitician(name: string): void {
    this.toggleIn(this.expandedPoliticians, name);
  }

  async toggleAssertion(name: string): Promise<void> {
    this.toggleIn(this.expandedAssertions, name);
    if (!this.expandedAssertions.has(name)) { return; }
    if (!this.validity.has(name)) {
      const report = await this.accountability.validity(name);
      if (report) { this.validity.set(name, report); }
    }
    const assertion = this.assertions.find(a => a.name === name);
    if (assertion && !assertion.conceptName && !assertion.termName
        && !this.suggestions.has(name)) {
      const report = await this.accountability.suggestions(name);
      if (report) { this.suggestions.set(name, report); }
    }
  }

  private toggleIn(set: Set<string>, name: string): void {
    if (set.has(name)) { set.delete(name); } else { set.add(name); }
  }

  nextStatuses(assertion: AssertionRow): string[] {
    return PolicyAccountabilityComponent
      .NEXT_STATUSES[assertion.status] ?? [];
  }

  async transition(assertion: AssertionRow, to: string):
      Promise<void> {
    this.transitionError = '';
    const result = await this.accountability.transition(
      assertion.name, to, this.transitionBy || 'anonymous',
      'via accountability page');
    if (result?.ok) {
      assertion.status = to;
      this.validity.delete(assertion.name);
      const refreshed = await this.accountability.assertions(
        assertion.subject);
      const updated = refreshed.find(a => a.name === assertion.name);
      if (updated) { assertion.statusHistory = updated.statusHistory; }
      await this.rescore();
    } else {
      this.transitionError = result?.error
        ?? 'transition failed (backend unreachable?)';
    }
  }

  async applyElection(election: ElectionRow): Promise<void> {
    const result = await this.accountability.electionApply(
      election.name);
    this.applyResults.set(election.name, result?.ok
      ? `applied — ${result.weightsProvenance}`
      : (result?.error ?? 'apply failed'));
  }

  scorePercent(score: number | null | undefined): string {
    return score === null || score === undefined
      ? '0%' : `${Math.max(0, Math.min(100, score * 100))}%`;
  }

  weightEntries(weights: Record<string, number>):
      { name: string; weight: number }[] {
    return Object.entries(weights)
      .map(([name, weight]) => ({ name, weight }))
      .sort((a, b) => b.weight - a.weight);
  }

  statusChipClass(status: string): string {
    return `chip status-${status}`;
  }
}
