'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ConceptNode {
  id: string;
  label: string;
  mastery: number;
}

interface ConceptEdge {
  from: string;
  to: string;
  type: string;
}

interface ConceptMapData {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

interface ConceptMapProps {
  data: ConceptMapData;
}

function getMasteryColor(mastery: number): string {
  if (mastery < 30) return '#EF4444';
  if (mastery < 80) return '#EAB308';
  return '#22C55E';
}

function getMasteryBg(mastery: number): string {
  if (mastery < 30) return 'rgba(239,68,68,0.15)';
  if (mastery < 80) return 'rgba(234,179,8,0.15)';
  return 'rgba(34,197,94,0.15)';
}

export default function ConceptMap({ data }: ConceptMapProps) {
  const [scale, setScale] = useState(1);
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const count = data.nodes.length;
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(200, count * 40);

    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
    return positions;
  }, [data.nodes]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.2, 2.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.2, 0.4));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
  }, []);

  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleReset}
          className="w-9 h-9 bg-white shadow-md rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Map area */}
      <div className="w-full h-[500px] overflow-auto">
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
            width: '800px',
            height: '600px',
            position: 'relative',
            margin: '0 auto',
          }}
        >
          {/* SVG edges */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 800 600"
          >
            {data.edges.map((edge, i) => {
              const from = nodePositions[edge.from];
              const to = nodePositions[edge.to];
              if (!from || !to) return null;
              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#D1D5DB"
                  strokeWidth="2"
                  strokeDasharray={edge.type === 'prerequisite' ? '6,4' : undefined}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const color = getMasteryColor(node.mastery);
            const bg = getMasteryBg(node.mastery);

            return (
              <motion.button
                key={node.id}
                className="absolute flex flex-col items-center justify-center rounded-full cursor-pointer"
                style={{
                  left: pos.x - 36,
                  top: pos.y - 36,
                  width: 72,
                  height: 72,
                  backgroundColor: bg,
                  border: `3px solid ${color}`,
                }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedNode(node)}
              >
                <span
                  className="text-xs font-bold leading-tight text-center px-1"
                  style={{ color }}
                >
                  {node.label.length > 12
                    ? node.label.substring(0, 10) + '...'
                    : node.label}
                </span>
                <span className="text-[10px] font-semibold mt-0.5" style={{ color }}>
                  {node.mastery}%
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Node popup */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-30"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{selectedNode.label}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getMasteryColor(selectedNode.mastery) }}
                  />
                  <span className="text-sm text-gray-600">
                    Mastery: {selectedNode.mastery}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" /> &lt;30%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#EAB308]" /> 30-79%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#22C55E]" /> 80%+
        </span>
      </div>
    </div>
  );
}
