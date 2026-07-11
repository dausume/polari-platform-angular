/**
 * @xr
 * @module services/sim-space-3d/xr/xr-mirror-ghost
 *
 * The desktop-mirror headset ghost (xr-2): the wearer never sees
 * their own headset, but the flat viewer (mirroring the same live
 * scene) shows a stylized headset at the wearer's head pose — the
 * demo-to-a-colleague story. Controller/hand models are ordinary
 * layer-0 rig children (both sides see those); ONLY the head ghost is
 * mirror-exclusive, via a dedicated layer the session enables on the
 * flat camera while bound (and restores exactly on unbind — the
 * byte-identical-exit guarantee covers the camera's layer mask).
 *
 * Multi-user presence is out of scope by decision (research app, not
 * social) — this ghost is the whole story.
 */

import * as THREE from 'three';

/** Layers 1/2 are three's per-eye XR layers; 3 is ours. */
export const XR_MIRROR_GHOST_LAYER = 3;

export class XrMirrorGhost {
  private group: THREE.Group;
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor(private rig: THREE.Group,
              private camera: THREE.Camera) {
    this.group = new THREE.Group();
    this.group.name = 'xr-headset-ghost';

    const headGeometry = new THREE.SphereGeometry(0.11, 16, 12);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: 0x455a64, transparent: true, opacity: 0.85,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);

    const visorGeometry = new THREE.BoxGeometry(0.19, 0.09, 0.1);
    const visorMaterial = new THREE.MeshBasicMaterial({
      color: 0x159588,
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 0.01, -0.08);

    this.group.add(head, visor);
    this.group.traverse(o => o.layers.set(XR_MIRROR_GHOST_LAYER));
    this.disposables.push(headGeometry, headMaterial,
      visorGeometry, visorMaterial);
    rig.add(this.group);
  }

  /** Per-frame: the camera is a rig sibling whose LOCAL pose is the
   *  headset pose in reference space — copy it verbatim. */
  update(): void {
    this.group.position.copy(this.camera.position);
    this.group.quaternion.copy(this.camera.quaternion);
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
