import type { View } from "@/domain/schemas";

const stroke = { fill: "#e2e8f0", stroke: "#94a3b8", strokeWidth: 1.5 };

function Body({ back }: { back?: boolean }) {
  return (
    <g {...stroke} aria-hidden>
      <ellipse cx={150} cy={56} rx={36} ry={42} />
      <rect x={136} y={92} width={28} height={26} />
      {/* torso */}
      <path d="M 78 120 C 100 114 200 114 222 120 L 214 152 L 206 300 L 210 342 L 90 342 L 94 300 L 86 152 Z" />
      {/* arms */}
      <path d="M 78 120 L 66 130 L 48 210 L 38 290 L 62 292 L 76 212 L 88 150 Z" />
      <path d="M 222 120 L 234 130 L 252 210 L 262 290 L 238 292 L 224 212 L 212 150 Z" />
      {/* legs */}
      <path d="M 92 340 L 100 450 L 108 560 L 140 560 L 142 450 L 150 352 Z" />
      <path d="M 208 340 L 200 450 L 192 560 L 160 560 L 158 450 L 150 352 Z" />
      {!back && <path d="M 150 118 L 150 236" stroke="#cbd5e1" fill="none" />}
      <SideLabels left={back ? "L" : "R"} right={back ? "R" : "L"} y={20} />
    </g>
  );
}

function SideLabels({ left, right, y }: { left: string; right: string; y: number }) {
  return (
    <g fontSize={12} fill="#64748b" stroke="none" fontWeight={600}>
      <text x={12} y={y}>Pt {left}</text>
      <text x={288} y={y} textAnchor="end">
        Pt {right}
      </text>
    </g>
  );
}

function HeadNeck() {
  return (
    <g {...stroke} aria-hidden>
      <SideLabels left="R" right="L" y={20} />
      <path d="M 106 210 L 102 330 L 198 330 L 194 210 Z" />
      <ellipse cx={150} cy={122} rx={76} ry={96} />
      <path d="M 128 196 C 140 204 160 204 172 196" fill="none" />
    </g>
  );
}

function Chest() {
  return (
    <g aria-hidden>
      <SideLabels left="R" right="L" y={18} />
      <rect x={140} y={40} width={20} height={190} rx={6} fill="#cbd5e1" />
      {[60, 96, 136, 176, 214, 250].map((y) => (
        <path key={y} d={`M 60 ${y} Q 150 ${y + 20} 240 ${y}`} stroke="#cbd5e1" strokeWidth={1.2} fill="none" />
      ))}
      <path d="M 210 40 L 210 300" stroke="#e2e8f0" strokeDasharray="4 4" />
      <text x={212} y={295} fontSize={9} fill="#94a3b8">
        MCL
      </text>
    </g>
  );
}

export function Silhouette({ view }: { view: View }) {
  switch (view) {
    case "anterior":
      return <Body />;
    case "posterior":
      return <Body back />;
    case "head_neck":
      return <HeadNeck />;
    case "precordium":
      return <Chest />;
    default:
      return null;
  }
}
