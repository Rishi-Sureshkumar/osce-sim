"use client";
/**
 * Drapes (Phase 4 M3): the sheet over the pelvis and legs, built from the posed skin so the legs
 * never poke through it (sheetGeometry.ts), and the gown's pull tabs and folded edges.
 *
 * Direct manipulation:
 * - click the sheet over a leg to fold that leg's section back (the groin crease comes with it);
 *   click the part over the pelvis to cover the legs again (the pelvis itself is never uncovered);
 * - click a gown tab on the patient's right flank to fold the chest / abdomen gown back or cover it.
 * Folded edges are drawn but never take a click, so they can't steal one meant for an exam target.
 */
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, Quaternion, SkinnedMesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { DrapeSection } from "@/domain/schemas";
import type { Pose } from "@/exam3d/regionAnchors";
import { TAB_BIND, bodyAxes, gownRollFrames, nearestVertex } from "./drapeGeometry";
import { PATIENT_VARIANTS } from "./patientRig.generated";
import type { VariantId } from "./rig";
import { OWNER_SECTION, buildSheet, classifySheet, sheetCuts, sheetMesh, sheetOwnerAt, skinWorld, type Sheet, type SkinData } from "./sheetGeometry";

const SHEET_COLOR = "#a8cad8";
const GOWN_EDGE = "#9ec5d4";
const TAB = "#5f97ad";

export interface DrapeChange {
  section: DrapeSection;
  covered: boolean;
}
/** Applies drape changes in order (covering the chest is two section changes). */
export type DrapeHandler = (changes: DrapeChange[]) => void;

/** The skin's bind-space data from the patient GLB (same cached file the renderer draws). */
export function useSkinData(variant: VariantId): SkinData | null {
  const gltf = useGLTF(PATIENT_VARIANTS[variant].glb, false, true, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
  return useMemo(() => {
    let skin: SkinnedMesh | null = null;
    gltf.scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && o.name === "skin") skin = o as SkinnedMesh;
    });
    if (!skin) return null;
    const sm = skin as SkinnedMesh;
    const g = sm.geometry;
    const pos = g.getAttribute("position");
    const idx = g.getAttribute("skinIndex");
    const wts = g.getAttribute("skinWeight");
    const count = pos.count;
    const bind = new Float32Array(count * 3);
    const joints = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      bind[i * 3] = pos.getX(i);
      bind[i * 3 + 1] = pos.getY(i);
      bind[i * 3 + 2] = pos.getZ(i);
      const w = [wts.getX(i), wts.getY(i), wts.getZ(i), wts.getW(i)];
      const sum = w[0]! + w[1]! + w[2]! + w[3]! || 1;
      for (let k = 0; k < 4; k++) weights[i * 4 + k] = w[k]! / sum;
      joints[i * 4] = idx.getX(i);
      joints[i * 4 + 1] = idx.getY(i);
      joints[i * 4 + 2] = idx.getZ(i);
      joints[i * 4 + 3] = idx.getW(i);
    }
    return { bind, joints, weights, jointNames: sm.skeleton.bones.map((b) => b.name), count };
  }, [gltf]);
}

export function Drapes({
  pose,
  variant,
  sections,
  onDrape,
}: {
  pose: Pose;
  variant: VariantId;
  sections: Record<DrapeSection, boolean>;
  onDrape?: DrapeHandler;
}) {
  const skin = useSkinData(variant);
  const owner = useMemo(() => (skin ? classifySheet(skin, sheetCuts(variant, skin)) : null), [skin, variant]);
  const sheet = useMemo<Sheet | null>(() => {
    if (!skin || !owner) return null;
    return buildSheet(skinWorld(skin, pose, owner), owner, { lapOnly: pose.position === "sitting_dangling" });
  }, [skin, owner, pose]);
  const legs = { leg_left: sections.leg_left, leg_right: sections.leg_right };
  const geom = useMemo(() => {
    if (!sheet) return null;
    const m = sheetMesh(sheet, legs);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(m.positions, 3));
    g.setAttribute("normal", new BufferAttribute(m.normals, 3));
    g.setIndex(new BufferAttribute(m.indices, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, legs.leg_left, legs.leg_right]);
  useEffect(() => () => geom?.dispose(), [geom]);

  const rolls = useMemo(() => gownRollFrames(pose), [pose]);
  const tabs = useMemo(() => (skin ? gownTabs(skin, pose) : null), [skin, pose]);

  const onSheet = onDrape
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!sheet) return;
        const o = sheetOwnerAt(sheet, e.point.x, e.point.z);
        if (o === 2 || o === 3) onDrape([{ section: OWNER_SECTION[o], covered: false }]);
        // the pelvis part: pull the sheet back over any uncovered leg
        const back = (["leg_left", "leg_right"] as const).filter((sec) => !sections[sec]).map((section) => ({ section, covered: true }));
        if (o === 1 && back.length) onDrape(back);
      }
    : undefined;
  const hover = (on: boolean) => () => {
    if (onDrape) document.body.style.cursor = on ? "pointer" : "";
  };
  const chestCovered = sections.chest_left && sections.chest_right;
  const chestBare = !sections.chest_left && !sections.chest_right;

  return (
    <group name="drapes">
      {geom && (
        <mesh geometry={geom} name="sheet-legs" castShadow receiveShadow onClick={onSheet} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <meshPhysicalMaterial color={SHEET_COLOR} roughness={0.92} sheen={0.6} sheenRoughness={0.8} sheenColor="#e3f1f7" side={DoubleSide} />
        </mesh>
      )}
      {/* gown pull tabs on the right flank: fold the gown back / cover again */}
      {tabs && (
        <>
          <GownTab at={tabs.chest} name={chestCovered ? "fold-chest" : "tab-chest"} onClick={onDrape ? () => onDrape(chestChanges(sections)) : undefined} />
          <GownTab at={tabs.abdomen} name="fold-abdomen" onClick={onDrape ? () => onDrape([{ section: "abdomen", covered: !sections.abdomen }]) : undefined} />
        </>
      )}
      {/* folded gown edges (drawn only) */}
      {chestBare && <Roll name="roll-chest" frame={rolls.chest} />}
      {!chestCovered && !chestBare && <Roll name="roll-chest" frame={rolls.sternum} />}
      {!sections.abdomen && <Roll name="roll-abdomen" frame={rolls.abdomen} />}
    </group>
  );
}

/** The chest tab: fold the chest gown back when it's fully on, otherwise cover whatever is uncovered. */
export function chestChanges(sections: Record<DrapeSection, boolean>): DrapeChange[] {
  const both = sections.chest_left && sections.chest_right;
  return (["chest_left", "chest_right"] as const).filter((sec) => (both ? true : !sections[sec])).map((section) => ({ section, covered: !both }));
}

const noRay = () => null;

function Roll({ name, frame }: { name: string; frame: { pos: [number, number, number]; q: Quaternion; len: number } }) {
  return (
    <mesh position={frame.pos} quaternion={frame.q} name={name} castShadow raycast={noRay}>
      <capsuleGeometry args={[0.012, frame.len, 4, 10]} />
      <meshStandardMaterial color={GOWN_EDGE} roughness={0.92} />
    </mesh>
  );
}

function GownTab({ at, name, onClick }: { at: { pos: Vector3; q: Quaternion }; name: string; onClick?: () => void }) {
  return (
    <mesh
      position={at.pos}
      quaternion={at.q}
      name={name}
      castShadow
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = "") : undefined}
    >
      <boxGeometry args={[0.045, 0.012, 0.03]} />
      <meshStandardMaterial color={TAB} roughness={0.8} />
    </mesh>
  );
}

/** World pose of the gown tabs: on the skin of the right flank, lying flat on it. */
function gownTabs(skin: SkinData, pose: Pose): { chest: { pos: Vector3; q: Quaternion }; abdomen: { pos: Vector3; q: Quaternion } } {
  const { left } = bodyAxes(pose);
  const out = left.clone().negate();
  const place = (bindPt: [number, number, number]) => {
    const i = nearestVertex(skin, bindPt);
    const mask = new Uint8Array(skin.count);
    mask[i] = 1;
    const w = skinWorld(skin, pose, mask);
    const p = new Vector3(w[i * 3]!, w[i * 3 + 1]!, w[i * 3 + 2]!).addScaledVector(out, 0.012);
    // the tab's thin axis points out of the flank
    return { pos: p, q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), out) };
  };
  return { chest: place(TAB_BIND.chest), abdomen: place(TAB_BIND.abdomen) };
}

