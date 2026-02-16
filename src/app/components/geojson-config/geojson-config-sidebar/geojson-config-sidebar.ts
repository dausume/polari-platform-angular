import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import {
  NamedGeoJsonConfig
} from '@models/geojson/NamedGeoJsonConfig';
import {
  CoordinateMode, TupleOrder, MarkerAnchor,
  SvgMarkerDefinition, DEFAULT_SVG_MARKER
} from '@models/geojson/GeoJsonConfigData';

@Component({
  standalone: false,
  selector: 'geojson-config-sidebar',
  templateUrl: 'geojson-config-sidebar.html',
  styleUrls: ['./geojson-config-sidebar.css']
})
export class GeoJsonConfigSidebarComponent implements OnChanges {
  @Input() config!: NamedGeoJsonConfig;
  @Input() classTypeData: any = {};
  @Output() configChange = new EventEmitter<NamedGeoJsonConfig>();

  availableFields: string[] = [];

  /** Index of marker currently being edited, or -1 for none */
  editingMarkerIndex: number = -1;

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

  // ===== Configuration Properties =====

  onNameChange(name: string): void {
    this.config.name = name;
    this.emitChange();
  }

  onDescriptionChange(description: string): void {
    this.config.description = description;
    this.emitChange();
  }

  // ===== Coordinate Mapping =====

  onCoordinateModeChange(mode: CoordinateMode): void {
    this.config.geoJsonConfig.coordinateMode = mode;
    this.emitChange();
  }

  onTupleVariableChange(variable: string): void {
    this.config.geoJsonConfig.tupleVariable = variable;
    this.emitChange();
  }

  onTupleOrderChange(order: TupleOrder): void {
    this.config.geoJsonConfig.tupleOrder = order;
    this.emitChange();
  }

  onLatitudeVariableChange(variable: string): void {
    this.config.geoJsonConfig.latitudeVariable = variable;
    this.emitChange();
  }

  onLongitudeVariableChange(variable: string): void {
    this.config.geoJsonConfig.longitudeVariable = variable;
    this.emitChange();
  }

  onParentGeoClassChange(className: string): void {
    this.config.geoJsonConfig.parentGeoClass = className;
    this.emitChange();
  }

  // ===== SVG Markers =====

  addMarker(): void {
    const newMarker: SvgMarkerDefinition = {
      ...DEFAULT_SVG_MARKER,
      name: `marker-${this.config.geoJsonConfig.svgMarkers.length + 1}`
    };
    this.config.geoJsonConfig.svgMarkers.push(newMarker);
    this.editingMarkerIndex = this.config.geoJsonConfig.svgMarkers.length - 1;
    this.emitChange();
  }

  removeMarker(index: number): void {
    this.config.geoJsonConfig.svgMarkers.splice(index, 1);
    if (this.editingMarkerIndex === index) {
      this.editingMarkerIndex = -1;
    } else if (this.editingMarkerIndex > index) {
      this.editingMarkerIndex--;
    }
    this.emitChange();
  }

  toggleEditMarker(index: number): void {
    this.editingMarkerIndex = this.editingMarkerIndex === index ? -1 : index;
  }

  onMarkerNameChange(index: number, name: string): void {
    this.config.geoJsonConfig.svgMarkers[index].name = name;
    this.emitChange();
  }

  onMarkerSvgChange(index: number, svg: string): void {
    this.config.geoJsonConfig.svgMarkers[index].svgString = svg;
    this.emitChange();
  }

  onMarkerWidthChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.geoJsonConfig.svgMarkers[index].width = num;
      this.emitChange();
    }
  }

  onMarkerHeightChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.geoJsonConfig.svgMarkers[index].height = num;
      this.emitChange();
    }
  }

  onMarkerAnchorChange(index: number, anchor: MarkerAnchor): void {
    this.config.geoJsonConfig.svgMarkers[index].anchor = anchor;
    this.emitChange();
  }

  onMarkerFillChange(index: number, color: string): void {
    this.config.geoJsonConfig.svgMarkers[index].fillColor = color;
    this.emitChange();
  }

  onMarkerStrokeChange(index: number, color: string): void {
    this.config.geoJsonConfig.svgMarkers[index].strokeColor = color;
    this.emitChange();
  }

  onMarkerStrokeWidthChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0) {
      this.config.geoJsonConfig.svgMarkers[index].strokeWidth = num;
      this.emitChange();
    }
  }

  onDefaultMarkerChange(name: string): void {
    this.config.geoJsonConfig.defaultMarkerName = name;
    this.emitChange();
  }

  // ===== Map Settings =====

  onCenterLngChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num)) {
      this.config.geoJsonConfig.mapOptions.center[0] = num;
      this.emitChange();
    }
  }

  onCenterLatChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num)) {
      this.config.geoJsonConfig.mapOptions.center[1] = num;
      this.emitChange();
    }
  }

  onZoomChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0 && num <= 22) {
      this.config.geoJsonConfig.mapOptions.zoom = num;
      this.emitChange();
    }
  }

  onStyleChange(style: string): void {
    this.config.geoJsonConfig.mapOptions.style = style;
    this.emitChange();
  }

  // ===== Helpers =====

  getStyledSvg(marker: SvgMarkerDefinition): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(marker.svgString, 'image/svg+xml');
      const svg = doc.documentElement;
      const elements = svg.querySelectorAll('path, circle, rect, polygon, ellipse');
      elements.forEach((el: Element) => {
        const currentFill = el.getAttribute('fill');
        if (currentFill !== 'white' && currentFill !== 'none' && currentFill !== '#ffffff' && currentFill !== '#fff') {
          el.setAttribute('fill', marker.fillColor);
        }
        el.setAttribute('stroke', marker.strokeColor);
        el.setAttribute('stroke-width', String(marker.strokeWidth));
      });
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return marker.svgString;
    }
  }

  emitChange(): void {
    this.configChange.emit(this.config);
  }
}
