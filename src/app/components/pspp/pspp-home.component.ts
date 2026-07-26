import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * PSPP home — the scientist's entry point to the reactive-material
 * engine: what data exists (with citations), what the network knows,
 * and where to modify it. Everything links back to editable rows.
 */
@Component({
  selector: 'pspp-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="home">
    <h2>PSPP — Processing · Structure · Properties · Performance</h2>
    <p class="hint">A generic reactive-material engine: materials
      evolve through states; chemistry is a library of species +
      reaction rules (competing hypotheses, cited); book data lives
      as digitized rows every chart derives from. Swap the library —
      geopolymers today, sol-gels or cement hydration tomorrow —
      without redesigning anything.</p>
    <div class="cards">
      <a routerLink="/pspp/proofing" class="card">
        <b>Book proofing charts</b>
        <span>{{ readyCount }} datasets rendered straight from rows —
          lay the book figure beside each chart.</span></a>
      <a routerLink="/pspp/network" class="card">
        <b>Reaction network</b>
        <span>Species and rules as data: stages, transport selection,
          competing hypotheses, citations.</span></a>
      <a routerLink="/pspp/grader" class="card">
        <b>Composition grader</b>
        <span>Derive oxide ratios and grade a recipe against the
          patent reaction windows.</span></a>
      <a routerLink="/pspp/progress" class="card">
        <b>Cure progress</b>
        <span>Measured-curve estimates; unsupported conditions refuse
          and name the data that would help.</span></a>
      <a routerLink="/pspp/guide" class="card">
        <b>Experiment guide</b>
        <span>Enter what you know — graded windows, open reaction
          pathways, cure schedule; the gap list is the experiment
          plan.</span></a>
      <a routerLink="/pspp/benchmarks" class="card">
        <b>Benchmark overlays</b>
        <span>Book experiments beside engine predictions — match,
          mismatch, or an honest refusal naming the missing
          data.</span></a>
      <a routerLink="/pspp/states" class="card">
        <b>State DAGs</b>
        <span>Material state histories + the wax feedstock routes
          (pspp-11) — virtual states dashed.</span></a>
      <a routerLink="/pspp/structure" class="card">
        <b>Structure sampler</b>
        <span>Most-likely Q-motif groups + a representative 3D
          cluster sampled from the ensemble — amorphous, so a
          distribution, never THE structure.</span></a>
    </div>
    <h3>Dataset catalog</h3>
    <table *ngIf="catalog?.ok">
      <tr><th>dataset</th><th>source</th><th>points</th>
        <th>status</th></tr>
      <tr *ngFor="let d of catalog.datasets">
        <td>{{ d.name }}</td><td class="cite">{{ d.source }}</td>
        <td>{{ d.pointCount }}</td><td>{{ d.status }}</td></tr>
    </table>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .home { max-width: 720px; margin: 0 auto; padding: 12px; }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .cards { display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px; margin: 10px 0; }
    .card { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 10px; background: var(--surface-primary); text-decoration: none;
      color: var(--text-primary); display: flex; flex-direction: column;
      gap: 4px; font-size: 12px; }
    table { font-size: 11px; border-collapse: collapse; }
    td, th { padding: 3px 8px; border-bottom: 1px solid var(--border-light);
      text-align: left; }
    .cite { color: var(--text-secondary); }
  `],
})
export class PsppHomeComponent implements OnInit {
  catalog: any = null;
  readyCount = 0;

  constructor(private pspp: PsppService) {}

  async ngOnInit(): Promise<void> {
    this.catalog = await this.pspp.catalog();
    this.readyCount = (this.catalog?.datasets ?? [])
      .filter((d: any) => d.status === 'ready').length;
  }
}
