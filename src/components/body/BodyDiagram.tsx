"use client";
import { useState } from "react";
import type { Region, View } from "@/domain/schemas";
import { NEURO_TILE_LABELS, SHAPES, VIEWBOX, type Shape } from "./shapes";
import { Silhouette } from "./Silhouettes";

interface Props {
  view: View;
  regions: Region[];
  selectedRegionId?: string | null;
  performingRegionId?: string | null;
  examinedRegionIds: Set<string>;
  onRegionClick: (region: Region) => void;
}

/** Renders one diagram view. Every clickable shape maps to a canonical regionId. */
export function BodyDiagram({ view, regions, selectedRegionId, performingRegionId, examinedRegionIds, onRegionClick }: Props) {
  const [hover, setHover] = useState<Region | null>(null);
  const shapes = SHAPES[view] ?? [];
  const bySvg = new Map(regions.filter((r) => r.view === view).map((r) => [r.svgPathId, r]));

  return (
    <div className="relative">
      <svg viewBox={VIEWBOX[view]} className="mx-auto h-[min(68vh,620px)] w-full select-none" role="group" aria-label={`${view} view`}>
        <Silhouette view={view} />
        {shapes.map((s) => {
          const region = bySvg.get(s.svgPathId);
          if (!region) return null;
          const selected = region.id === selectedRegionId;
          const performing = region.id === performingRegionId;
          const examined = examinedRegionIds.has(region.id);
          const isZoom = !!region.zoomTo;
          return (
            <RegionShape
              key={s.svgPathId}
              shape={s}
              region={region}
              className={[
                "cursor-pointer transition-[fill-opacity] outline-none",
                performing ? "region-performing" : "",
                selected ? "fill-cyan-600 [fill-opacity:0.55]" : isZoom ? "fill-sky-300 [fill-opacity:0.25] hover:[fill-opacity:0.5]" : examined ? "fill-emerald-400 [fill-opacity:0.35] hover:[fill-opacity:0.6]" : "fill-cyan-400 [fill-opacity:0.18] hover:[fill-opacity:0.5]",
                "stroke-cyan-700 [stroke-opacity:0.5] focus-visible:stroke-2",
              ].join(" ")}
              onClick={() => onRegionClick(region)}
              onHover={setHover}
            />
          );
        })}
        {view === "neuro" &&
          shapes.map((s) =>
            s.el === "rect" ? (
              <text key={`t-${s.svgPathId}`} x={s.x + s.width / 2} y={s.y + s.height / 2 + 4} textAnchor="middle" fontSize={11} className="pointer-events-none fill-slate-800 font-medium">
                {NEURO_TILE_LABELS[s.svgPathId]}
              </text>
            ) : null,
          )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm text-slate-600" aria-live="polite">
        {hover ? hover.label + (hover.zoomTo ? " — click to zoom" : "") : " "}
      </div>
    </div>
  );
}

function RegionShape({
  shape,
  region,
  className,
  onClick,
  onHover,
}: {
  shape: Shape;
  region: Region;
  className: string;
  onClick: () => void;
  onHover: (r: Region | null) => void;
}) {
  const common = {
    id: shape.svgPathId,
    "data-region": region.id,
    className,
    role: "button",
    tabIndex: 0,
    "aria-label": region.label,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    onMouseEnter: () => onHover(region),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover(region),
    onBlur: () => onHover(null),
  };
  const title = <title>{region.label}</title>;
  switch (shape.el) {
    case "circle":
      return (
        <circle {...common} cx={shape.cx} cy={shape.cy} r={shape.r}>
          {title}
        </circle>
      );
    case "ellipse":
      return (
        <ellipse {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}>
          {title}
        </ellipse>
      );
    case "rect":
      return (
        <rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx}>
          {title}
        </rect>
      );
    case "path":
      return (
        <path {...common} d={shape.d}>
          {title}
        </path>
      );
  }
}
