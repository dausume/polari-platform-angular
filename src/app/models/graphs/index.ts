/**
 * Graph / Visualization Models
 *
 * Core plot models wrap Observable Plot (@observablehq/plot) for
 * declarative chart configuration.  NamedGraphConfig is the
 * backend-persisted per-class configuration that stores a
 * serialisable subset of PlotFigure settings.
 */

// Core plot models
export { PlotFigure, PlotAxis, PlotFigureOptions, PlotRenderStyle } from './plotFigure';
export { PlotBoundDimension } from './plotBoundDimension';
export { PlotDimensionRenderer } from './plotDimensionRenderer';
export { PlotDimensionGroup } from './plotDimensionGroup';

// Named graph configuration (backend-persisted)
export { NamedGraphConfig, GraphDefinitionSummary, GraphConfigData } from './NamedGraphConfig';
