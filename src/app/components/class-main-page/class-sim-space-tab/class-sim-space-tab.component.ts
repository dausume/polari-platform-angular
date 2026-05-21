/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @consumers
 *   - class-main-page (registered in app.module.ts via standalone imports)
 * @impact-on-edit
 *   This is the per-class Sim Space binding editor. Both 2D and 3D
 *   bindings are edited here under top-level sub-tabs. The 2D and 3D
 *   forms share most of their UX — only Z field + Mesh3D/Material3D
 *   refs differ for 3D.
 * @see /OVERLAP_MAP.md
 */

import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatOptgroup } from '@angular/material/core';

import { ClassTypingService } from '@services/class-typing-service';
import { SimSpaceBindingService } from '@services/sim-space/sim-space-binding.service';
import { Shape2DLibraryService, Shape2DDef } from '@services/sim-space-2d/shape-2d-library.service';
import { Style2DLibraryService, Style2DDef } from '@services/sim-space-2d/style-2d-library.service';
import { Mesh3DLibraryService, Mesh3DDef } from '@services/sim-space-3d/mesh-3d-library.service';
import { Material3DLibraryService, Material3DDef } from '@services/sim-space-3d/material-3d-library.service';
import {
  SimSpaceBinding,
  SimSpaceDimensionality,
  SimSpaceTemporalBinding,
} from '@models/sim-space/sim-space-types';
import { TIME_UNITS, TimeUnitDef, TimeUnitId } from '@models/sim-space/time-units';

/** Per-dimensionality form state — one record per 2D / 3D. */
interface DimBindingForm {
  enabled: boolean;
  /**
   * Emission kind of the loaded binding. The form only edits object-mode
   * bindings; when a stored binding is kind='connection' we show a
   * read-only notice and disable Save so the user doesn't accidentally
   * downgrade the connection into a broken object binding.
   */
  kind: 'object' | 'connection';
  posX: string;
  posY: string;
  posZ: string;          // ignored for 2D
  shapeRef: string;
  styleRef: string;
  clickAction: 'navigate-to-instance' | 'show-overlay' | 'none';
  defaultVisible: boolean;
  // Temporal binding state — optional. When `enabledTemporal` is false,
  // the binding is treated as static (no scrubber).
  enabledTemporal: boolean;
  temporalKind: 'time' | 'step';
  temporalField: string;
  temporalUnit: TimeUnitId;
  temporalCumulative: boolean;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

@Component({
  standalone: true,
  selector: 'class-sim-space-tab',
  imports: [
    CommonModule, FormsModule, MatTabsModule, MatCardModule,
    MatSlideToggleModule, MatFormFieldModule, MatSelectModule,
    MatInputModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatOptgroup,
  ],
  templateUrl: './class-sim-space-tab.component.html',
  styleUrls: ['./class-sim-space-tab.component.css'],
})
export class ClassSimSpaceTabComponent implements OnInit, OnChanges {
  @Input() className?: string;

  selectedSubTab = 0;

  numericFields: string[] = [];
  shapes2D: Shape2DDef[] = [];
  styles2D: Style2DDef[] = [];
  meshes3D: Mesh3DDef[] = [];
  materials3D: Material3DDef[] = [];
  readonly timeUnits = TIME_UNITS;
  // Precomputed once at construction — the template iterates this via
  // |keyvalue, and a method call here would rebuild the object every CD
  // cycle (Material's mat-select triggers many).
  readonly timeUnitGroupsMap: Record<string, TimeUnitDef[]> = TIME_UNITS.reduce((acc, u) => {
    (acc[u.group] ??= []).push(u);
    return acc;
  }, {} as Record<string, TimeUnitDef[]>);

  form2D: DimBindingForm = this.emptyForm('2d');
  form3D: DimBindingForm = this.emptyForm('3d');

  constructor(
    private bindings: SimSpaceBindingService,
    private shapesLib: Shape2DLibraryService,
    private stylesLib: Style2DLibraryService,
    private meshesLib: Mesh3DLibraryService,
    private materialsLib: Material3DLibraryService,
    private typingService: ClassTypingService
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['className'] && !changes['className'].firstChange) {
      this.refresh();
    }
  }

  markDirty(form: DimBindingForm): void {
    form.dirty = true;
    form.saved = false;
    form.error = null;
  }

  private async refresh(): Promise<void> {
    if (!this.className) return;
    this.numericFields = this.detectNumericFields(this.className);
    [this.shapes2D, this.styles2D, this.meshes3D, this.materials3D] = await Promise.all([
      this.shapesLib.load(),
      this.stylesLib.load(),
      this.meshesLib.load(),
      this.materialsLib.load(),
    ]);
    // Hydrate both forms.
    await this.hydrateForm('2d', this.form2D);
    await this.hydrateForm('3d', this.form3D);
  }

  private async hydrateForm(dim: SimSpaceDimensionality, form: DimBindingForm): Promise<void> {
    if (!this.className) return;
    Object.assign(form, this.emptyForm(dim));
    const { enabled, binding } = await this.bindings.getBinding(this.className, dim);
    form.enabled = enabled;
    if (binding) {
      form.kind = binding.kind ?? 'object';
      // Connection-mode bindings have no `position`; this tab edits the
      // object-mode form, so we only hydrate when fields are present.
      if (binding.position?.kind === 'fields') {
        form.posX = binding.position.fields.x ?? '';
        form.posY = binding.position.fields.y ?? '';
        form.posZ = binding.position.fields.z ?? '';
      }
      if (typeof binding.visual.shapeRef === 'string') form.shapeRef = binding.visual.shapeRef;
      if (typeof binding.visual.styleRef === 'string') form.styleRef = binding.visual.styleRef;
      form.clickAction = binding.clickAction ?? 'navigate-to-instance';
      form.defaultVisible = binding.defaultVisible ?? true;
      if (binding.temporal) {
        form.enabledTemporal = true;
        form.temporalKind = binding.temporal.kind;
        form.temporalField = binding.temporal.field;
        form.temporalUnit = binding.temporal.unit ?? 'second';
        form.temporalCumulative = !!binding.temporal.cumulative;
      }
    }
    form.dirty = false;
  }

  private detectNumericFields(className: string): string[] {
    const typing = (this.typingService.polyTyping as any)[className];
    if (!typing) return [];
    const completeData = typing.completeVariableTypingData ?? {};
    const out: string[] = [];
    for (const [name, info] of Object.entries(completeData as Record<string, any>)) {
      const t = (info?.varType ?? info?.type ?? '').toString().toLowerCase();
      if (t === 'int' || t === 'float' || t === 'number' || t === 'numeric') {
        out.push(name);
      }
    }
    return out.sort();
  }

  private emptyForm(dim: SimSpaceDimensionality): DimBindingForm {
    return {
      enabled: false,
      kind: 'object',
      posX: '',
      posY: '',
      posZ: '',
      shapeRef: dim === '2d' ? 'circle' : 'cube',
      styleRef: dim === '2d' ? 'default' : 'matte-blue',
      clickAction: 'navigate-to-instance',
      defaultVisible: true,
      enabledTemporal: false,
      temporalKind: 'time',
      temporalField: '',
      temporalUnit: 'second',
      temporalCumulative: false,
      dirty: false,
      saving: false,
      saved: false,
      error: null,
    };
  }

  async save(dim: SimSpaceDimensionality): Promise<void> {
    if (!this.className) return;
    const form = dim === '2d' ? this.form2D : this.form3D;
    form.saving = true;
    form.error = null;
    const fields: { x: string; y: string; z?: string } = { x: form.posX, y: form.posY };
    if (dim === '3d') fields.z = form.posZ;
    const binding: SimSpaceBinding = {
      enabled: form.enabled,
      dimensionality: dim,
      position: { kind: 'fields', fields },
      visual: { shapeRef: form.shapeRef, styleRef: form.styleRef },
      clickAction: form.clickAction,
      defaultVisible: form.defaultVisible,
    };
    if (form.enabledTemporal && form.temporalField) {
      const temporal: SimSpaceTemporalBinding = {
        kind: form.temporalKind,
        field: form.temporalField,
        cumulative: form.temporalCumulative,
      };
      if (form.temporalKind === 'time') temporal.unit = form.temporalUnit;
      binding.temporal = temporal;
    }
    try {
      await this.bindings.saveBinding(this.className, dim, form.enabled, binding);
      form.dirty = false;
      form.saved = true;
      setTimeout(() => (form.saved = false), 2500);
    } catch (err: any) {
      form.error = err?.message || String(err);
    } finally {
      form.saving = false;
    }
  }
}
