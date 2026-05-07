// TODO(d3-force-3d-types): upstream d3-force-3d ships no .d.ts and no DT package
// exists. Mirroring the public API we use here; widen as we adopt more forces.
declare module 'd3-force-3d' {
  export interface Simulation<NodeDatum, LinkDatum> {
    nodes(nodes: NodeDatum[]): this;
    nodes(): NodeDatum[];
    alpha(value: number): this;
    alpha(): number;
    alphaDecay(value: number): this;
    alphaTarget(value: number): this;
    velocityDecay(value: number): this;
    force<F>(name: string, force?: F | null): this;
    on(event: 'tick' | 'end', listener: () => void): this;
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    numDimensions(n: 1 | 2 | 3): this;
  }
  export interface ForceLink<NodeDatum, LinkDatum> {
    (alpha: number): void;
    links(links?: LinkDatum[]): this;
    id(accessor: (d: NodeDatum) => string | number): this;
    distance(value: number | ((link: LinkDatum) => number)): this;
    strength(value: number | ((link: LinkDatum) => number)): this;
    iterations(n: number): this;
  }
  export interface ForceManyBody<NodeDatum> {
    (alpha: number): void;
    strength(value: number): this;
    distanceMin(value: number): this;
    distanceMax(value: number): this;
    theta(value: number): this;
  }
  export interface ForceCenter<NodeDatum> {
    (alpha: number): void;
    strength(value: number): this;
  }

  export function forceSimulation<NodeDatum, LinkDatum = unknown>(
    nodes?: NodeDatum[],
    numDimensions?: 1 | 2 | 3,
  ): Simulation<NodeDatum, LinkDatum>;
  export function forceLink<NodeDatum, LinkDatum>(
    links?: LinkDatum[],
  ): ForceLink<NodeDatum, LinkDatum>;
  export function forceManyBody<NodeDatum>(): ForceManyBody<NodeDatum>;
  export function forceCenter<NodeDatum>(
    x?: number,
    y?: number,
    z?: number,
  ): ForceCenter<NodeDatum>;
  export function forceCollide<NodeDatum>(
    radius?: number | ((d: NodeDatum) => number),
  ): {
    (alpha: number): void;
    radius(value: number | ((d: NodeDatum) => number)): unknown;
    strength(value: number): unknown;
    iterations(n: number): unknown;
  };
}
