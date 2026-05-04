export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface GraphResponse {
  edges: GraphEdge[];
  _next_action?: string | null;
}
