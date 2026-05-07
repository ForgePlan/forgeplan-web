import type { ArtifactSummary } from '@/entities/artifact';
import type { GraphEdge } from '@/entities/graph';
import type { ScoreEntry } from '@/entities/score';

export interface Force3DProps {
  nodes?: ArtifactSummary[];
  edges?: GraphEdge[];
  scores?: ScoreEntry[];
  selectedId?: string | null;
  kindFilter?: Set<string>;
  statusFilter?: Set<string>;
  onSelect?: (detail: { id: string }) => void;
  onViewState?: (state: {
    nodes: Array<{ id: string; x: number; y: number; kind: string }>;
    transform: { x: number; y: number; k: number };
    viewport: { w: number; h: number };
  }) => void;
}

export interface Sim3DNode {
  id: string;
  kind: string;
  status: string;
  title: string;
  r_eff: number;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  index?: number;
}

export interface Sim3DLink {
  source: string | Sim3DNode;
  target: string | Sim3DNode;
  relation: string;
}
