import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ConceptScoreReport, GroupAggregateReport, GroupCompareReport,
  ScoreConceptSummary, ScoreGroupRow, ScoringService,
} from '@services/scoring/scoring.service';
import {
  AccountabilityService, CriticalContextReport, SpecificityReport,
} from '@services/scoring/accountability.service';

/**
 * The Scoring home (/scoring, scr-1): context-based scoring as a
 * first-class system — the Political Scorecard's term/context/weight
 * model generalized over arbitrary Polari data. Lists every
 * ScoreConcept; selecting one runs the pipeline live and shows the
 * ranked subjects with full per-term breakdowns (raw value →
 * normalization spec → weighted contribution), every absent
 * measurement named. Definitions are edited as ScoreTerm /
 * ScoreContext / ScoreSubject / ContextualizedValue / ScoreConcept
 * rows (object-coherence — no hidden math).
 */
@Component({
  standalone: true,
  selector: 'scoring-home',
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './scoring-home.component.html',
  styleUrls: ['./scoring-home.component.scss'],
})
export class ScoringHomeComponent implements OnInit {
  concepts: ScoreConceptSummary[] = [];
  report: ConceptScoreReport | null = null;
  activeConcept = '';
  loading = true;
  scoring = false;
  loadError = '';
  expanded = new Set<string>();

  groupRows: ScoreGroupRow[] = [];
  aggregate: GroupAggregateReport | null = null;
  activeGroup = '';
  comparison: GroupCompareReport | null = null;
  aggregating = false;

  specificity: SpecificityReport | null = null;
  criticalContexts: CriticalContextReport | null = null;
  showFindings = false;

  constructor(private scoringService: ScoringService,
              private accountability: AccountabilityService) {}

  async ngOnInit(): Promise<void> {
    [this.concepts, this.groupRows] = await Promise.all([
      this.scoringService.concepts(),
      this.scoringService.groups(),
    ]);
    this.loading = false;
    if (!this.concepts.length) {
      this.loadError = 'No score concepts answered — is the backend '
        + 'up? (GET /api/scoring/concepts)';
      return;
    }
    void this.select(this.concepts[0].name);
    if (this.groupRows.length) {
      void this.selectGroup('');
      if (this.groupRows.length >= 2) {
        this.comparison = await this.scoringService.compareGroups(
          this.groupRows.map(g => g.name));
      }
    }
  }

  async selectGroup(name: string): Promise<void> {
    this.activeGroup = name;
    this.aggregating = true;
    this.aggregate = name
      ? await this.scoringService.groupAggregate(name)
      : await this.scoringService.groupsConsensus();
    this.aggregating = false;
  }

  stanceLabel(term: { dominantStance: string;
                      dominantFraction: number }): string {
    if (term.dominantStance === 'split') { return 'split 50/50'; }
    return `${term.dominantStance} `
      + `${Math.round(term.dominantFraction * 100)}%`;
  }

  async select(name: string): Promise<void> {
    this.activeConcept = name;
    this.scoring = true;
    this.expanded.clear();
    this.showFindings = false;
    [this.report, this.specificity, this.criticalContexts] =
      await Promise.all([
        this.scoringService.score(name),
        this.accountability.specificity(name),
        this.accountability.criticalContexts(name),
      ]);
    this.scoring = false;
  }

  findingsCount(): number {
    return (this.specificity?.findings?.length ?? 0)
      + (this.criticalContexts?.suggestions?.length ?? 0);
  }

  findingEvidence(finding: { evidence: unknown }): string {
    return typeof finding.evidence === 'string'
      ? finding.evidence : JSON.stringify(finding.evidence);
  }

  toggle(subject: string): void {
    if (this.expanded.has(subject)) {
      this.expanded.delete(subject);
    } else {
      this.expanded.add(subject);
    }
  }

  barWidth(subject: { levelizedScore: number | null;
                      initialScore: number }): string {
    const value = subject.levelizedScore ?? subject.initialScore * 100;
    return `${Math.max(0, Math.min(100, value))}%`;
  }

  scoreLabel(subject: { levelizedScore: number | null;
                        initialScore: number }): string {
    return subject.levelizedScore !== null
      ? subject.levelizedScore.toFixed(2)
      : subject.initialScore.toFixed(4);
  }

  normalizationLabel(entry: {
    normalization?: { method: string; min: number; max: number;
                      inverted: boolean };
  }): string {
    const spec = entry.normalization;
    if (!spec) { return ''; }
    return `${spec.method} [${spec.min}, ${spec.max}]`
      + (spec.inverted ? ' inverted (lower is better)' : '');
  }
}
