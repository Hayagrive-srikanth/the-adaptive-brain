'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Search, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GraphNode {
  id: string;
  name: string;
  mastery: number;      // 0-100
  importance: number;   // 1-10, used for sizing
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'prerequisite' | 'related';
}

interface InteractiveGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Base URL for the study link, node id will be appended */
  studyBaseUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Force simulation (simple spring-based, no d3)                      */
/* ------------------------------------------------------------------ */

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function initializePositions(nodes: GraphNode[], width: number, height: number): SimNode[] {
  const cx = width / 2;
  const cy = height / 2;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const radius = Math.min(width, height) * 0.3;
    return {
      ...n,
      x: n.x ?? cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: n.y ?? cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    };
  });
}

function runSimulationStep(
  nodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): SimNode[] {
  const REPULSION = 3000;
  const SPRING_K = 0.005;
  const SPRING_REST = 120;
  const CENTER_PULL = 0.01;
  const DAMPING = 0.85;
  const cx = width / 2;
  const cy = height / 2;

  const updated = nodes.map((n) => ({ ...n }));
  const nodeMap = new Map(updated.map((n) => [n.id, n]));

  // repulsion between all pairs
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const a = updated[i];
      const b = updated[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // spring along edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const displacement = dist - SPRING_REST;
    const fx = (dx / dist) * displacement * SPRING_K;
    const fy = (dy / dist) * displacement * SPRING_K;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // centering + damping + integration
  for (const n of updated) {
    n.vx += (cx - n.x) * CENTER_PULL;
    n.vy += (cy - n.y) * CENTER_PULL;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    // boundary clamp
    n.x = Math.max(40, Math.min(width - 40, n.x));
    n.y = Math.max(40, Math.min(height - 40, n.y));
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function masteryColor(mastery: number): string {
  if (mastery < 30) return '#EF4444';       // red
  if (mastery < 80) return '#EAB308';       // yellow
  return '#22C55E';                          // green
}

function nodeRadius(importance: number): number {
  return 14 + importance * 2.5; // 16.5 to 39
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InteractiveGraph({
  nodes,
  edges,
  studyBaseUrl = '/topic/',
}: InteractiveGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const stableRef = useRef(false);
  const frameRef = useRef(0);

  /* ---- Measure container ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- Initialize simulation ---- */
  useEffect(() => {
    if (nodes.length === 0) return;
    const initial = initializePositions(nodes, dimensions.width, dimensions.height);
    setSimNodes(initial);
    stableRef.current = false;
  }, [nodes, dimensions.width, dimensions.height]);

  /* ---- Simulation loop ---- */
  useEffect(() => {
    if (simNodes.length === 0 || stableRef.current) return;

    let iterations = 0;
    const maxIterations = 200;

    const tick = () => {
      setSimNodes((prev) => {
        const next = runSimulationStep(prev, edges, dimensions.width, dimensions.height);

        // check convergence
        let totalVelocity = 0;
        for (const n of next) {
          totalVelocity += Math.abs(n.vx) + Math.abs(n.vy);
        }
        iterations++;
        if (totalVelocity < 0.5 || iterations > maxIterations) {
          stableRef.current = true;
        }
        return next;
      });

      if (!stableRef.current) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [simNodes.length, edges, dimensions.width, dimensions.height]);

  /* ---- Node map for edge lookups ---- */
  const nodeMap = useMemo(
    () => new Map(simNodes.map((n) => [n.id, n])),
    [simNodes],
  );

  /* ---- Search filter ---- */
  const filteredNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // show all
    const q = searchQuery.toLowerCase();
    return new Set(simNodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
  }, [searchQuery, simNodes]);

  /* ---- Pan handlers ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-graph-node]')) return;
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [dragging, dragStart],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  /* ---- Zoom ---- */
  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.3));

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#F8F9FA] rounded-2xl overflow-hidden border border-gray-200">
      {/* ---- Top controls ---- */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-white/90 backdrop-blur border border-gray-200 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Zoom buttons */}
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur rounded-xl border border-gray-200 p-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs font-semibold text-gray-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ---- Legend ---- */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/90 backdrop-blur rounded-xl border border-gray-200 px-4 py-3">
        <p className="text-xs font-bold text-gray-500 mb-2">Legend</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#EF4444]" /> &lt;30% mastery
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#EAB308]" /> 30-79%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#22C55E]" /> 80%+
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs mt-2">
          <span className="flex items-center gap-1.5">
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6C63FF" strokeWidth="2" /></svg>
            Prerequisite
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6C63FF" strokeWidth="2" strokeDasharray="4 3" /></svg>
            Related
          </span>
        </div>
      </div>

      {/* ---- SVG Graph ---- */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="select-none"
        >
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: `${dimensions.width / 2}px ${dimensions.height / 2}px` }}
          >
            {/* Edges */}
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;

              const dimmed =
                filteredNodeIds &&
                !filteredNodeIds.has(edge.source) &&
                !filteredNodeIds.has(edge.target);

              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#6C63FF"
                  strokeWidth={1.5}
                  strokeOpacity={dimmed ? 0.1 : 0.4}
                  strokeDasharray={edge.type === 'related' ? '6 4' : undefined}
                />
              );
            })}

            {/* Nodes */}
            {simNodes.map((node) => {
              const r = nodeRadius(node.importance);
              const color = masteryColor(node.mastery);
              const dimmed = filteredNodeIds && !filteredNodeIds.has(node.id);
              const isSelected = selectedNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  data-graph-node
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(isSelected ? null : node);
                  }}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.15 : 1}
                >
                  {/* Glow ring when selected */}
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 6}
                      fill="none"
                      stroke={color}
                      strokeWidth={3}
                      strokeOpacity={0.4}
                    />
                  )}

                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={color}
                    fillOpacity={0.2}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-gray-800 font-semibold pointer-events-none"
                    fontSize={Math.max(9, Math.min(12, r * 0.55))}
                  >
                    {node.name.length > 14
                      ? node.name.slice(0, 12) + '...'
                      : node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ---- Node popup ---- */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 w-72"
          >
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-gray-900 mb-1 pr-6">
              {selectedNode.name}
            </h3>

            <div className="flex items-center gap-3 mb-3">
              <span
                className="text-sm font-bold"
                style={{ color: masteryColor(selectedNode.mastery) }}
              >
                {selectedNode.mastery}% mastery
              </span>
              <span className="text-xs text-gray-400">
                Importance: {selectedNode.importance}/10
              </span>
            </div>

            {/* Mastery bar */}
            <div className="w-full h-2 rounded-full bg-gray-100 mb-4">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: masteryColor(selectedNode.mastery) }}
                initial={{ width: 0 }}
                animate={{ width: `${selectedNode.mastery}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <Link
              href={`${studyBaseUrl}${selectedNode.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6C63FF] hover:text-[#5a52e0] transition-colors"
            >
              Study this topic
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
