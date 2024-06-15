import { D3Model } from './d3-model';
import * as d3 from 'd3';

export class CircleStateModel extends D3Model {
  private radius: number;

  constructor(svg: any, data: any, radius: number) {
    super(svg, data);
    this.radius = radius;
  }

  render(): void {
    this.svg.selectAll('circle')
      .data(this.data)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', this.radius)
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
      .call(this.drag());
  }

  private drag(): any {
    const dragstarted = (event, d) => {
      d3.select(event.sourceEvent.target).raise().attr('stroke', 'black');
    };

    const dragged = (event, d) => {
      d3.select(event.sourceEvent.target).attr('cx', d.x = event.x).attr('cy', d.y = event.y);
    };

    const dragended = (event, d) => {
      d3.select(event.sourceEvent.target).attr('stroke', null);
    };

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
}
