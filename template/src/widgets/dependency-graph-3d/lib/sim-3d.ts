import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from 'd3-force-3d';
import type { Sim3DLink, Sim3DNode } from '../model/types';

export interface Sim3DConfig {
  reducedMotion: boolean;
}

export function buildSimulation(
  nodes: Sim3DNode[],
  links: Sim3DLink[],
  config: Sim3DConfig,
): Simulation<Sim3DNode, Sim3DLink> {
  const sim = forceSimulation<Sim3DNode, Sim3DLink>(nodes, 3)
    .force(
      'link',
      forceLink<Sim3DNode, Sim3DLink>(links)
        .id((d: Sim3DNode) => d.id)
        .distance(22)
        .strength(0.6),
    )
    .force('charge', forceManyBody<Sim3DNode>().strength(-65).distanceMax(220))
    .force('center', forceCenter<Sim3DNode>(0, 0, 0).strength(0.08))
    .alpha(1)
    .alphaDecay(config.reducedMotion ? 0.05 : 0.025)
    .velocityDecay(0.4);

  return sim;
}
