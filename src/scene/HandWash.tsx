"use client";
/**
 * First-person hand hygiene: two hands lather and rub in front of the camera with growing foam,
 * for `durationMs`. Purely visual; the hygiene Action is logged by the caller when it ends.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

const SKIN = "#c99a82";
const FOAM = 70;

/** small seeded PRNG (mulberry32) so the foam pattern is the same every run (stable screenshots) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Hand({ side }: { side: 1 | -1 }) {
  return (
    <group>
      {/* palm */}
      <mesh scale={[0.085, 0.022, 0.095]}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      {/* fingers */}
      {[-0.033, -0.011, 0.011, 0.033].map((x, i) => (
        <mesh key={x} position={[x, 0, -0.1 - (i === 0 || i === 3 ? 0 : 0.008)]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.0095, 0.06, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.6} />
        </mesh>
      ))}
      {/* thumb */}
      <mesh position={[side * 0.07, 0.005, -0.02]} rotation={[Math.PI / 2, 0, side * 0.9]}>
        <capsuleGeometry args={[0.011, 0.045, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function HandWash({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const { camera } = useThree();
  const rig = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const foam = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rnd = seeded(20251);
    return Array.from({ length: FOAM }, () => [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, 0.5 + rnd()] as const);
  }, []);
  const m = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const t = (performance.now() - startedAt) / durationMs;
    const g = rig.current;
    if (!g) return;
    // stay in front of the camera, slightly below eye level
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    g.translateZ(-0.5);
    g.translateY(-0.17);
    g.scale.setScalar(0.72);
    const k = performance.now() / 1000;
    const rub = Math.sin(k * 9) * 0.035;
    const twist = Math.sin(k * 4.5) * 0.35;
    if (left.current) {
      left.current.position.set(-0.05 + rub, 0, 0);
      left.current.rotation.set(-0.3, 0.2 + twist, Math.PI / 2 - 0.2);
    }
    if (right.current) {
      right.current.position.set(0.05 - rub, 0.01, 0);
      right.current.rotation.set(-0.3, -0.2 - twist, -Math.PI / 2 + 0.2);
    }
    const f = foam.current;
    if (f) {
      const grow = Math.min(1, t * 1.6);
      seeds.forEach((sd, i) => {
        const s = 0.006 + 0.01 * sd[3] * grow;
        m.compose(new Vector3(sd[0] * 0.14, sd[1] * 0.05 + Math.sin(k * 6 + i) * 0.004, sd[2] * 0.12 - 0.04), q, new Vector3(s, s, s));
        f.setMatrixAt(i, m);
      });
      f.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={rig}>
      <pointLight position={[0, 0.2, 0.2]} intensity={0.6} distance={1.2} />
      <group ref={left}>
        <Hand side={-1} />
      </group>
      <group ref={right}>
        <Hand side={1} />
      </group>
      <instancedMesh ref={foam} args={[undefined, undefined, FOAM]} raycast={() => null}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  );
}
