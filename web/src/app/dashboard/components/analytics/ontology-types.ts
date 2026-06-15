export type OntologyRole =
  | "接続点"
  | "争点"
  | "不満点"
  | "満足点"
  | "関心点"
  | "セグメント";

export interface OntologyNode {
  id: string;
  label: string;
  kind: "segment" | "topic" | "entity";
  type?: string;
  topic?: string;
  count: number;
  role: OntologyRole;
  roles: OntologyRole[];
  bySegment?: Record<string, number>;
  bySentiment?: Record<string, number>;
}

export interface OntologyLink {
  source: string;
  target: string;
  n: number;
  kind: "seg-topic" | "topic-ent" | "seg-ent";
}

export interface OntologyMeta {
  personaTotal: number;
  generatedAt: string;
  entityLayerStatus: "none" | "ready" | "stale";
  note: string;
}

export interface OntologyData {
  nodes: OntologyNode[];
  links: OntologyLink[];
  meta: OntologyMeta;
}

export const ONTOLOGY_VIEWBOX = { width: 1200, height: 760 };
