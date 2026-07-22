'use client';

import React from 'react';

interface TraitPoint {
  label: string;
  value: number; // 0 to 1
  color: string;
}

interface RadarChartProps {
  ocean: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  darkTriad: {
    machiavellianism: number;
    narcissism: number;
    psychopathy: number;
  };
  prospectTheory: {
    lambda: number; // normalized 0.5-5.0 -> 0-1
  };
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  ocean,
  darkTriad,
  prospectTheory,
  size = 280,
}) => {
  const center = size / 2;
  const radius = size * 0.38;

  // Normalize traits into 8 radial axes
  const traits: TraitPoint[] = [
    { label: 'Openness', value: ocean.openness, color: '#a855f7' },
    { label: 'Conscientious', value: ocean.conscientiousness, color: '#c084fc' },
    { label: 'Extraversion', value: ocean.extraversion, color: '#e879f9' },
    { label: 'Agreeableness', value: ocean.agreeableness, color: '#38bdf8' },
    { label: 'Neuroticism', value: ocean.neuroticism, color: '#f43f5e' },
    { label: 'Machiavellian', value: darkTriad.machiavellianism, color: '#fb7185' },
    { label: 'Narcissism', value: darkTriad.narcissism, color: '#f472b6' },
    { label: 'Loss Aversion', value: Math.min(1, Math.max(0, (prospectTheory.lambda - 0.5) / 4.5)), color: '#fbbf24' },
  ];

  const totalAxes = traits.length;

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
    const r = radius * Math.min(1, Math.max(0.05, val));
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const points = traits.map((t, idx) => getCoordinates(idx, t.value));
  const polygonPointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Radial grid levels
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <svg width={size} height={size} className="overflow-visible select-none drop-shadow-2xl">
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#d946ef" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="polyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Ambient Center Glow */}
        <circle cx={center} cy={center} r={radius} fill="url(#radarGlow)" />

        {/* Concentric Grid Polygons */}
        {levels.map((lvl) => {
          const gridPts = traits.map((_, idx) => getCoordinates(idx, lvl));
          const gridStr = gridPts.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <polygon
              key={lvl}
              points={gridStr}
              fill="none"
              stroke="#334155"
              strokeDasharray={lvl === 1.0 ? 'none' : '2,2'}
              strokeWidth={lvl === 1.0 ? '1.5' : '1'}
              opacity={0.6}
            />
          );
        })}

        {/* Axis Lines */}
        {traits.map((_, idx) => {
          const edge = getCoordinates(idx, 1.0);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={edge.x}
              y2={edge.y}
              stroke="#475569"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        {/* Filled Trait Polygon */}
        <polygon
          points={polygonPointsStr}
          fill="url(#polyGrad)"
          stroke="#c084fc"
          strokeWidth="2"
          className="transition-all duration-300 ease-out"
        />

        {/* Point Markers */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={traits[idx].color}
            stroke="#0f172a"
            strokeWidth="1.5"
            className="transition-all duration-300 ease-out hover:scale-150"
          />
        ))}

        {/* Trait Labels */}
        {traits.map((t, idx) => {
          const angle = (Math.PI * 2 * idx) / totalAxes - Math.PI / 2;
          const labelDist = radius + 22;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);

          let anchor = 'middle';
          if (Math.abs(Math.cos(angle)) > 0.3) {
            anchor = Math.cos(angle) > 0 ? 'start' : 'end';
          }

          return (
            <text
              key={idx}
              x={lx}
              y={ly + 4}
              textAnchor={anchor}
              fill="#cbd5e1"
              fontSize="10"
              fontWeight="600"
              className="font-sans tracking-wide uppercase transition-colors"
            >
              {t.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
