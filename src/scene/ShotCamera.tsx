"use client";
/**
 * Camera for the shot state machine: eased tweens (0.6–1.2 s) between shot framings, plus a
 * little free look inside a shot: drag to yaw around the target (± the shot's limit) and the
 * wheel to zoom within its range. No orbiting, panning or going under the table.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3 } from "@/exam3d/regionAnchors";
import { QA } from "@/exam3d/qa";
import { ease, tweenSeconds } from "./shots";

export interface CameraGoal {
  position: Vec3;
  target: Vec3;
  fov: number;
  /** changes whenever a new move is requested */
  key: string;
}

export function ShotCamera({ goal, freeLook, enabled = true }: { goal: CameraGoal; freeLook: { yawDeg: number; zoomMin: number; zoomMax: number }; enabled?: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const tween = useRef<{ fromPos: Vector3; fromTarget: Vector3; fromFov: number; start: number; dur: number } | null>(null);
  const base = useRef({ pos: new Vector3(...goal.position), target: new Vector3(...goal.target), fov: goal.fov });
  const look = useRef({ yaw: 0, zoom: 1 });
  const lastTarget = useRef(new Vector3(...goal.target));
  const free = useRef(freeLook);
  free.current = freeLook;
  const on = useRef(enabled);
  on.current = enabled;

  useEffect(() => {
    const pc = camera as PerspectiveCamera;
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: lastTarget.current.clone(),
      fromFov: pc.fov,
      start: performance.now(),
      dur: QA.enabled && QA.fast ? 1 : tweenSeconds([camera.position.x, camera.position.y, camera.position.z], goal.position) * 1000,
    };
    QA.cameraSettled = false;
    base.current = { pos: new Vector3(...goal.position), target: new Vector3(...goal.target), fov: goal.fov };
    look.current = { yaw: 0, zoom: 1 };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.key]);

  // free look: horizontal drag = yaw, wheel = zoom
  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; yaw: number } | null = null;
    const down = (e: PointerEvent) => {
      if (on.current && e.button === 0) drag = { x: e.clientX, yaw: look.current.yaw };
    };
    const move = (e: PointerEvent) => {
      if (!drag || !on.current || !(e.buttons & 1)) return;
      const lim = (free.current.yawDeg * Math.PI) / 180;
      look.current.yaw = Math.max(-lim, Math.min(lim, drag.yaw - (e.clientX - drag.x) * 0.004));
    };
    const up = () => {
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!on.current) return;
      e.preventDefault();
      look.current.zoom = Math.max(free.current.zoomMin, Math.min(free.current.zoomMax, look.current.zoom * (e.deltaY > 0 ? 1.06 : 1 / 1.06)));
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useFrame(() => {
    const pc = camera as PerspectiveCamera;
    const b = base.current;
    // free-look offset applied to the shot framing
    const offset = b.pos.clone().sub(b.target).multiplyScalar(look.current.zoom).applyAxisAngle(new Vector3(0, 1, 0), look.current.yaw);
    const wantPos = b.target.clone().add(offset);
    const tw = tween.current;
    if (tw) {
      const k = ease((performance.now() - tw.start) / tw.dur);
      camera.position.lerpVectors(tw.fromPos, wantPos, k);
      lastTarget.current.lerpVectors(tw.fromTarget, b.target, k);
      pc.fov = tw.fromFov + (b.fov - tw.fromFov) * k;
      if (k >= 1) {
        tween.current = null;
        QA.cameraSettled = true;
      }
    } else {
      camera.position.copy(wantPos);
      lastTarget.current.copy(b.target);
      pc.fov = b.fov;
    }
    pc.updateProjectionMatrix();
    camera.lookAt(lastTarget.current);
  });
  return null;
}
