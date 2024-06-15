import * as d3 from 'd3';

export abstract class D3Model {
  protected svg: any;
  protected data: any;

  constructor(svg: any, data: any) {
    this.svg = svg;
    this.data = data;
  }

  abstract render(): void;
}
