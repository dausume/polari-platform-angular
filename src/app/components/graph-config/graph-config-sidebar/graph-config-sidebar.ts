import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { NamedGraphConfig, GraphConfigData } from '@models/graphs/NamedGraphConfig';
import { PlotRenderStyle } from '@models/graphs/plotFigure';

@Component({
  standalone: false,
  selector: 'graph-config-sidebar',
  templateUrl: 'graph-config-sidebar.html',
  styleUrls: ['./graph-config-sidebar.css']
})
export class GraphConfigSidebarComponent implements OnChanges {
  @Input() config!: NamedGraphConfig;
  @Input() classTypeData: any = {};
  @Output() configChange = new EventEmitter<NamedGraphConfig>();

  availableFields: string[] = [];
  renderStyleOptions: { value: PlotRenderStyle; label: string }[] = [
    { value: 'lineY', label: 'Line (Y)' },
    { value: 'barY', label: 'Bar (Y)' },
    { value: 'dot', label: 'Scatter' },
    { value: 'area', label: 'Area' },
    { value: 'areaY', label: 'Area (Y)' },
    { value: 'lineX', label: 'Line (X)' },
    { value: 'barX', label: 'Bar (X)' }
  ];

  defaultColors: string[] = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
    '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    '#9c755f', '#bab0ac'
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['classTypeData']) {
      this.buildFieldList();
    }
  }

  private buildFieldList(): void {
    if (!this.classTypeData) {
      this.availableFields = [];
      return;
    }
    this.availableFields = Object.keys(this.classTypeData);
  }

  onNameChange(name: string): void {
    this.config.name = name;
    this.emitChange();
  }

  onDescriptionChange(description: string): void {
    this.config.description = description;
    this.emitChange();
  }

  onRenderStyleChange(style: PlotRenderStyle): void {
    this.config.graphConfig.renderStyle = style;
    this.emitChange();
  }

  onXDimensionChange(dimension: string): void {
    this.config.graphConfig.xDimension = dimension;
    this.emitChange();
  }

  toggleYDimension(field: string): void {
    const yDims = this.config.graphConfig.yDimensions;
    const colors = this.config.graphConfig.seriesColors;
    const idx = yDims.indexOf(field);
    if (idx >= 0) {
      yDims.splice(idx, 1);
      colors.splice(idx, 1);
    } else {
      yDims.push(field);
      colors.push(this.defaultColors[yDims.length - 1] || '#4e79a7');
    }
    this.emitChange();
  }

  isYDimension(field: string): boolean {
    return this.config.graphConfig.yDimensions.includes(field);
  }

  onSeriesColorChange(index: number, color: string): void {
    this.config.graphConfig.seriesColors[index] = color;
    this.emitChange();
  }

  onWidthChange(value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.graphConfig.options.width = num;
      this.emitChange();
    }
  }

  onHeightChange(value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.graphConfig.options.height = num;
      this.emitChange();
    }
  }

  onLegendToggle(value: boolean): void {
    this.config.graphConfig.options.showLegend = value;
    this.emitChange();
  }

  onGridToggle(value: boolean): void {
    this.config.graphConfig.options.showGrid = value;
    this.emitChange();
  }

  emitChange(): void {
    this.configChange.emit(this.config);
  }
}
