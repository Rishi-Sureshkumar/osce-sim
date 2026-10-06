import type { ActionInput } from "@/domain/schemas";
import { NotImplemented } from "./notImplemented";

/**
 * Stretch goal. A VR/3D adapter maps a controller ray hit on a mesh (named with a canonical
 * regionId from content/catalog/regions.json) plus a menu choice to an examine action.
 */
export function actionFromRayHit(_meshName: string, _maneuverId: string): ActionInput {
  throw new NotImplemented("VR input");
}
