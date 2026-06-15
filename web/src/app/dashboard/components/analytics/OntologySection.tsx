import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOntology } from "~/app/dashboard/hooks/useAnalytics";
import {
  ONTOLOGY_VIEWBOX,
  type OntologyData,
  type OntologyNode,
  type OntologyRole,
} from "./ontology-types";
import { SectionCard, SectionError, SectionLoading } from "./SectionCard";

const ROLE_COLORS: Record<OntologyRole, string> = {
  接続点: "#5cb7bb", // teal-500
  争点: "#f4b860", // honey
  不満点: "#e76f7a", // berry
  満足点: "#8faf6f", // moss-500
  関心点: "#a8a29e", // snow-400
  セグメント: "#f4a06a", // apricot-500
};

const ROLE_DESC: Record<OntologyRole, string> = {
  接続点: "村内と村外をつなぐ",
  争点: "ポジとネガが混在",
  不満点: "ネガ優勢",
  満足点: "ポジ優勢",
  関心点: "中立的な関心",
  セグメント: "誰が（属性）",
};

const SEGMENT_ICONS: Record<string, string> = {
  村内住民: "🏠",
  観光客: "📷",
  移住検討者: "🧳",
  帰省者: "🎒",
  村外: "🌏",
  不明セグメント: "👤",
};

const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "ポジティブ", color: "#5cb7bb" }, // teal-500
  negative: { label: "ネガティブ", color: "#e76f7a" }, // berry
  request: { label: "要望", color: "#f4b860" }, // honey
  neutral: { label: "中立", color: "#89a8c0" }, // sky-500
};

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.5;

type SimNode = OntologyNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & {
  n: number;
  kind: "seg-topic" | "topic-ent" | "seg-ent";
};

const nodeRadius = (node: OntologyNode) => {
  if (node.kind === "segment") return 20;
  if (node.kind === "topic") return Math.max(14, Math.sqrt(node.count) * 1.1);
  return Math.max(7, Math.sqrt(node.count) * 2.4);
};

// 座標はサーバから来ないため、円環状の初期配置を d3-force のシードにする
const seedPositions = (nodes: OntologyNode[]) => {
  const { width, height } = ONTOLOGY_VIEWBOX;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  return Object.fromEntries(
    nodes.map((node, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return [
        node.id,
        { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) },
      ];
    }),
  );
};

interface BlockMeta {
  label: string;
  color: string;
  icon?: string;
}

const BreakdownBlocks = ({
  title,
  rows,
  getMeta,
}: {
  title: string;
  rows: Record<string, number>;
  getMeta: (key: string) => BlockMeta;
}) => (
  <div>
    <h5 className="text-xs font-medium text-stone-500 mt-3 mb-1.5">{title}</h5>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(rows)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => {
          const meta = getMeta(key);
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs border"
              style={{
                backgroundColor: `${meta.color}1f`,
                borderColor: `${meta.color}66`,
              }}
            >
              {meta.icon && <span aria-hidden="true">{meta.icon}</span>}
              <span className="text-stone-700">{meta.label}</span>
              <span className="font-bold text-stone-800 tabular-nums">
                {value}
              </span>
            </span>
          );
        })}
    </div>
  </div>
);

type Transform = { k: number; tx: number; ty: number };
type DragState =
  | { mode: "node"; id: string; moved: boolean }
  | { mode: "pan"; startX: number; startY: number; origin: Transform };

const OntologyGraph = ({ nodes, links }: OntologyData) => {
  const [selected, setSelected] = useState<OntologyNode | null>(null);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => seedPositions(nodes));
  const [transform, setTransform] = useState<Transform>({
    k: 1,
    tx: 0,
    ty: 0,
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());

  useEffect(() => {
    const { width, height } = ONTOLOGY_VIEWBOX;
    const seed = seedPositions(nodes);
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, ...seed[n.id] }));
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => (l.kind === "seg-topic" ? 210 : 110))
          .strength((l) => (l.kind === "seg-ent" ? 0.12 : 0.45)),
      )
      .force(
        "charge",
        forceManyBody<SimNode>().strength((d) =>
          d.kind === "entity" ? -220 : -780,
        ),
      )
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>((d) => nodeRadius(d) + 16),
      )
      .force("x", forceX<SimNode>(width / 2).strength(0.035))
      .force("y", forceY<SimNode>(height / 2).strength(0.045))
      .on("tick", () => {
        setPositions(
          Object.fromEntries(
            simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
          ),
        );
      });

    simRef.current = sim;
    simNodesRef.current = new Map(simNodes.map((n) => [n.id, n]));
    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  const toGraphPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scale = ONTOLOGY_VIEWBOX.width / rect.width;
    const vx = (clientX - rect.left) * scale;
    const vy = (clientY - rect.top) * scale;
    return {
      x: (vx - transform.tx) / transform.k,
      y: (vy - transform.ty) / transform.k,
    };
  };

  const zoomBy = (factor: number) => {
    setTransform((t) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
      const cx = ONTOLOGY_VIEWBOX.width / 2;
      const cy = ONTOLOGY_VIEWBOX.height / 2;
      const ratio = k / t.k;
      return {
        k,
        tx: cx - (cx - t.tx) * ratio,
        ty: cy - (cy - t.ty) * ratio,
      };
    });
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode: "node", id, moved: false };
    const node = simNodesRef.current.get(id);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      simRef.current?.alphaTarget(0.3).restart();
    }
  };

  const handleSvgPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      mode: "pan",
      startX: e.clientX,
      startY: e.clientY,
      origin: transform,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "node") {
      drag.moved = true;
      const point = toGraphPoint(e.clientX, e.clientY);
      const node = simNodesRef.current.get(drag.id);
      if (node) {
        node.fx = point.x;
        node.fy = point.y;
      }
    } else {
      const svg = svgRef.current;
      if (!svg) return;
      const scale = ONTOLOGY_VIEWBOX.width / svg.getBoundingClientRect().width;
      setTransform({
        ...drag.origin,
        tx: drag.origin.tx + (e.clientX - drag.startX) * scale,
        ty: drag.origin.ty + (e.clientY - drag.startY) * scale,
      });
    }
  };

  const releaseNode = (id: string) => {
    const node = simNodesRef.current.get(id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    simRef.current?.alphaTarget(0);
  };

  const handlePointerUp = (e: React.PointerEvent, node?: OntologyNode) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.mode === "node") {
      releaseNode(drag.id);
      if (node && !drag.moved) setSelected(node);
    }
    if (drag?.mode === "pan" && node === undefined) {
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (dx < 4 && dy < 4) setSelected(null);
    }
  };

  const connectedIds = useMemo(() => {
    if (!selected) return null;
    const ids = new Set<string>([selected.id]);
    for (const link of links) {
      if (link.source === selected.id) ids.add(link.target);
      if (link.target === selected.id) ids.add(link.source);
    }
    return ids;
  }, [selected, links]);

  const isLinkActive = (link: { source: string; target: string }) =>
    selected != null &&
    (link.source === selected.id || link.target === selected.id);

  const reset = () => {
    setTransform({ k: 1, tx: 0, ty: 0 });
    const seed = seedPositions(nodes);
    for (const node of simNodesRef.current.values()) {
      const origin = seed[node.id];
      if (origin) {
        node.x = origin.x;
        node.y = origin.y;
        node.fx = null;
        node.fy = null;
      }
    }
    simRef.current?.alpha(0.8).restart();
  };

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {(Object.keys(ROLE_COLORS) as OntologyRole[]).map((role) => (
          <span key={role} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-3 rounded-full flex-none"
              style={{ backgroundColor: ROLE_COLORS[role] }}
            />
            <span className="text-stone-700 font-medium">{role}</span>
            <span className="text-stone-400">{ROLE_DESC[role]}</span>
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_240px] gap-4">
        <div className="relative border border-stone-200 rounded-xl bg-stone-50/50 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${ONTOLOGY_VIEWBOX.width} ${ONTOLOGY_VIEWBOX.height}`}
            className="w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
            role="img"
            aria-label="村の声グラフ"
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e)}
            onPointerLeave={() => {
              if (dragRef.current?.mode === "node") {
                releaseNode(dragRef.current.id);
              }
              dragRef.current = null;
            }}
          >
            <g
              transform={`translate(${transform.tx},${transform.ty}) scale(${transform.k})`}
            >
              <g>
                {links.map((link) => {
                  const source = positions[link.source];
                  const target = positions[link.target];
                  if (!source || !target) return null;
                  const active = isLinkActive(link);
                  return (
                    <line
                      key={`${link.source}-${link.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={
                        active
                          ? "#0d9296"
                          : link.kind === "seg-ent"
                            ? "#99ebf3"
                            : "#d6d3d1"
                      }
                      strokeWidth={
                        Math.max(1, Math.sqrt(link.n) * 0.7) + (active ? 1 : 0)
                      }
                      strokeOpacity={selected ? (active ? 0.9 : 0.12) : 0.6}
                    />
                  );
                })}
              </g>
              <g>
                {nodes.map((node) => {
                  const color = ROLE_COLORS[node.role];
                  const r = nodeRadius(node);
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const isSelected = selected?.id === node.id;
                  const isDimmed =
                    connectedIds != null && !connectedIds.has(node.id);
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: SVG 内のドラッグ可能ノードのため
                    <g
                      key={node.id}
                      transform={`translate(${pos.x},${pos.y})`}
                      opacity={isDimmed ? 0.25 : 1}
                      onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                      onPointerUp={(e) => handlePointerUp(e, node)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(node)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.label}（${node.role}・${node.count}件）`}
                      className="cursor-pointer focus:outline-none"
                    >
                      {isSelected && (
                        <>
                          <circle
                            r={r + 10}
                            fill={color}
                            fillOpacity={0.12}
                            stroke={color}
                            strokeWidth={2}
                            strokeOpacity={0.8}
                            className="animate-pulse-subtle"
                          />
                          <circle
                            r={r + 5}
                            fill="none"
                            stroke="#fafaf9"
                            strokeWidth={2}
                          />
                        </>
                      )}
                      {node.kind === "segment" ? (
                        <>
                          <circle
                            r={r}
                            fill="#fff4ec"
                            stroke={color}
                            strokeWidth={isSelected ? 4 : 2.5}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={20}
                          >
                            {SEGMENT_ICONS[node.label] ?? "👤"}
                          </text>
                        </>
                      ) : (
                        <circle
                          r={r}
                          fill={color}
                          fillOpacity={
                            node.kind === "topic" ? 0.25 : isSelected ? 1 : 0.85
                          }
                          stroke={color}
                          strokeWidth={
                            isSelected ? 4 : node.kind === "topic" ? 2.5 : 1.2
                          }
                        />
                      )}
                      <text
                        y={-r - (isSelected ? 14 : 6)}
                        textAnchor="middle"
                        fontSize={
                          isSelected ? 14 : node.kind === "entity" ? 11 : 13
                        }
                        fontWeight={
                          isSelected || node.kind !== "entity" ? 700 : 500
                        }
                        fill={isSelected ? "#0f7177" : "#44403c"}
                        stroke="#fafaf9"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button
              type="button"
              onClick={() => zoomBy(1.25)}
              aria-label="拡大"
              className="w-8 h-8 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 text-base leading-none"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={() => zoomBy(0.8)}
              aria-label="縮小"
              className="w-8 h-8 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 text-base leading-none"
            >
              −
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="リセット"
              className="h-8 px-2 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 text-xs"
            >
              リセット
            </button>
          </div>
        </div>

        <div>
          <div className="min-h-[160px]">
            <h4 className="text-sm font-medium text-stone-700 mb-1">
              選択ノード
            </h4>
            {selected ? (
              <div>
                <p
                  className="font-bold text-sm"
                  style={{ color: ROLE_COLORS[selected.role] }}
                >
                  {selected.kind === "segment" &&
                    `${SEGMENT_ICONS[selected.label] ?? ""} `}
                  {selected.label}
                </p>
                <p className="text-xs text-stone-500">
                  {selected.kind === "segment"
                    ? "セグメント"
                    : selected.kind === "topic"
                      ? "トピック（全数集計）"
                      : "エンティティ（LLM抽出）"}
                  ・{selected.count.toLocaleString()} 件
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selected.roles.map((role) => (
                    <span
                      key={role}
                      className="text-[10px] px-1.5 py-0.5 rounded-full border"
                      style={{
                        color: ROLE_COLORS[role],
                        borderColor: ROLE_COLORS[role],
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>
                {selected.bySegment && (
                  <BreakdownBlocks
                    title="誰が"
                    rows={selected.bySegment}
                    getMeta={(key) => ({
                      label: key === "不明セグメント" ? "不明" : key,
                      color: "#f4a06a", // apricot-500
                      icon: SEGMENT_ICONS[key] ?? "👤",
                    })}
                  />
                )}
                {selected.bySentiment && (
                  <BreakdownBlocks
                    title="どんな感情で"
                    rows={selected.bySentiment}
                    getMeta={(key) =>
                      SENTIMENT_META[key] ?? { label: key, color: "#a8a29e" }
                    }
                  />
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                ノードをクリックすると「誰が・どんな感情で」の内訳を表示します。ノードはドラッグ、背景はパン、右下ボタンでズームできます。
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-500 mt-3">
        ※アイコン = セグメント（誰が）、大きい円 =
        トピック（全数集計）、小さい円 =
        具体エンティティ（LLM抽出）。役割は感情構成とセグメント構成から機械的に判定しています。
      </p>
    </>
  );
};

export const OntologySection = () => {
  const { data, isLoading, error } = useOntology();

  return (
    <SectionCard
      title="村の声グラフ"
      description={
        data
          ? `誰が・何に・どんな感情でつながっているかのグラフ（ペルソナ ${data.meta.personaTotal.toLocaleString()} 件）`
          : undefined
      }
    >
      {isLoading && <SectionLoading />}
      {error != null && <SectionError error={error} />}
      {data && (
        <OntologyGraph nodes={data.nodes} links={data.links} meta={data.meta} />
      )}
    </SectionCard>
  );
};
