import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TechTreeService } from '@services/techtree/techtree.service';
import {
  TechTreePayload, TechTreeSummary,
} from '@models/techtree/techtree-types';
import { TechTreeViewComponent } from './tech-tree-view.component';

/**
 * The Tech Tree page (/tech-tree, tt-4): technologies with derived
 * theory/real/business/politics segments, read straight from
 * /api/techtree. The header carries the tree's rolled-up completion
 * — when every node of the baseline tree completes, that IS the
 * Open Source Economic Baseline. Gaps arrive as evidence-bearing
 * suggestions (knob + action) and are only ever displayed.
 */
@Component({
  standalone: true,
  selector: 'tech-tree-home',
  imports: [CommonModule, FormsModule, MatIconModule,
            MatTooltipModule, TechTreeViewComponent],
  templateUrl: './tech-tree-home.component.html',
  styleUrls: ['./tech-tree-home.component.scss'],
})
export class TechTreeHomeComponent implements OnInit {
  summary: TechTreeSummary | null = null;
  payload: TechTreePayload | null = null;

  activeTree = '';
  loading = true;
  loadError = '';
  showGaps = true;

  constructor(private techTreeService: TechTreeService) {}

  async ngOnInit(): Promise<void> {
    this.summary = await this.techTreeService.summary();
    if (!this.summary?.ok) {
      this.loading = false;
      this.loadError = 'No tech tree answered — is the backend up? '
        + '(GET /api/techtree/summary)';
      return;
    }
    const first = this.summary.activeTree
      || this.summary.trees[0]?.name || '';
    if (!first) {
      this.loading = false;
      this.loadError = 'No tech trees defined yet — seed the '
        + 'baseline tree (tt-5) or POST /api/techtree/definition.';
      return;
    }
    await this.select(first);
  }

  async select(name: string): Promise<void> {
    this.activeTree = name;
    this.loading = true;
    this.loadError = '';
    this.payload = await this.techTreeService.tree(name);
    this.loading = false;
    if (!this.payload?.ok) {
      this.loadError = this.payload?.error
        || `Tree '${name}' did not answer (GET /api/techtree/tree)`;
    }
  }

  percent(level: number | undefined | null): string {
    return `${Math.round((level ?? 0) * 100)}%`;
  }

  // ------------------------------------------------------------------
  // B6: per-org trees — a business's tree is the technologies it
  // depends on to operate. Creation is one row write; nodes and
  // assignments follow through the same upserts the seed uses.
  // ------------------------------------------------------------------

  showCreate = false;
  creating = false;
  createError = '';
  newTree = { name: '', owner: '', description: '' };

  async createTree(): Promise<void> {
    const name = this.newTree.name.trim();
    if (!name) {
      this.createError = 'a tree needs a name';
      return;
    }
    this.creating = true;
    this.createError = '';
    const result = await this.techTreeService.createDefinition(
      name, this.newTree.owner.trim(),
      this.newTree.description.trim());
    this.creating = false;
    if (!result?.ok) {
      this.createError = result?.error
        || 'create did not land (POST /api/techtree/definition)';
      return;
    }
    this.showCreate = false;
    this.newTree = { name: '', owner: '', description: '' };
    this.summary = await this.techTreeService.summary();
    await this.select(name);
  }
}
