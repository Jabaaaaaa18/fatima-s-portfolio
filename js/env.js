// Pink-tinted studio environment used for reflections on rose-gold and glass.
// A dark plum room lit by blush softboxes and rose light strips.
import * as THREE from 'three';

export function createStudioEnvironment(renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 20),
    new THREE.MeshBasicMaterial({ color: '#1a0614', side: THREE.BackSide }),
  );
  scene.add(room);

  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  panel(8, 3, '#fff1f6', 3.2, [0, 5.8, 0], [0, 0, 0]);          // overhead softbox
  panel(2.2, 7, '#ff8fbf', 2.4, [-9.5, 1, 2], [0, 1, 2]);        // left pink strip
  panel(2.2, 7, '#f6c9d8', 1.8, [9.5, 1, -1], [0, 1, -1]);       // right blush strip
  panel(6, 1.4, '#ffb59f', 1.6, [0, 2, -9.5], [0, 2, 0]);        // warm rose-gold back light
  panel(3, 3, '#ff6faa', 1.2, [3, -3, 9.5], [0, 0, 0]);          // low front kicker

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return env;
}
