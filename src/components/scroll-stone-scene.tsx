'use client';
import { Component, ReactNode, RefObject, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
import { stoneFrame } from '@/lib/stone-choreography';
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function physicalBox(width: number, height: number, depth: number) {
  const g = new THREE.BoxGeometry(width, height, depth);
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)),
      ny = Math.abs(n.getY(i));
    uv.setXY(
      i,
      (ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i)) / 1.5 + 0.5,
      (ny > 0.5 ? p.getZ(i) : p.getY(i)) / 1.5 + 0.5,
    );
  }
  uv.needsUpdate = true;
  return g;
}
function Specimen({
  asset,
  progress,
  onReady,
  roughness,
  reflectivity,
}: {
  asset: Asset;
  progress: RefObject<number>;
  onReady: () => void;
  roughness: number;
  reflectivity: number;
}) {
  const mobile = useThree((s) => s.size.width < 760);
  const { gl, camera, scene } = useThree();
  const url = imageUrl(asset.url, mobile ? 1024 : 2048);
  const loaded = useTexture(url);
  const top = useRef<THREE.Mesh>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const ready = useRef(false);
  const texture = useMemo(() => {
    const t = loaded.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, asset.width / asset.height);
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  }, [loaded, asset.width, asset.height, gl]);
  const geometry = useMemo(() => physicalBox(3.35, 0.065, 1.65), []);
  const side = useMemo(() => physicalBox(0.065, 0.92, 1.65), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness,
        metalness: 0,
        reflectivity,
        clearcoat: Math.max(0, 0.5 - roughness),
        clearcoatRoughness: roughness,
      }),
    [texture, roughness, reflectivity],
  );
  const dark = useMemo(() => new THREE.Color('#191918'), []);
  const light = useMemo(() => new THREE.Color('#d6d0c5'), []);
  const background = useMemo(() => new THREE.Color(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      geometry.dispose();
      side.dispose();
    },
    [geometry, side],
  );
  useEffect(
    () => () => {
      loaded.dispose();
      useTexture.clear(url);
    },
    [loaded, url],
  );
  useFrame(() => {
    const f = stoneFrame(progress.current, mobile);
    if (top.current) {
      top.current.position.set(f.position[0], f.position[1], f.position[2]);
      top.current.rotation.set(f.rotation[0], f.rotation[1], f.rotation[2]);
    }
    for (const [mesh, x] of [
      [left.current, -1.61],
      [right.current, 1.61],
    ] as const) {
      if (mesh) {
        mesh.visible = f.sideReveal > 0.005;
        mesh.scale.y = Math.max(0.001, f.sideReveal);
        mesh.position.set(x + f.position[0], 0.46 * f.sideReveal - 0.35 * (1 - f.sideReveal), 0);
      }
    }
    camera.position.set(f.camera[0], f.camera[1], f.camera[2]);
    camera.lookAt(f.target[0], f.target[1], f.target[2]);
    background.copy(dark).lerp(light, f.background);
    scene.background = background;
    gl.domElement.dataset.scrollPose = JSON.stringify({
      rotation: f.rotation,
      camera: f.camera,
      sideReveal: f.sideReveal,
    });
  });
  return (
    <group>
      <mesh
        ref={top}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onAfterRender={(renderer) => {
          if (!ready.current && renderer.getRenderTarget() === null) {
            ready.current = true;
            onReady();
          }
        }}
      />
      <mesh ref={left} geometry={side} material={material} castShadow receiveShadow />
      <mesh ref={right} geometry={side} material={material} castShadow receiveShadow />
    </group>
  );
}
export default function ScrollStoneScene({
  asset,
  progress,
  invalidateRef,
  onReady,
  onFailure,
  roughness,
  reflectivity,
}: {
  asset: Asset;
  progress: RefObject<number>;
  invalidateRef: RefObject<() => void>;
  onReady: () => void;
  onFailure: () => void;
  roughness: number;
  reflectivity: number;
}) {
  return (
    <div className="journey-canvas" aria-hidden="true">
      <SceneBoundary onFailure={onFailure}>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.15]}
          camera={{ position: [0, 1.8, 7.4], fov: 38, near: 0.1, far: 60 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'low-power',
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          onCreated={({ gl, invalidate }) => {
            invalidateRef.current = invalidate;
            gl.toneMappingExposure = 1.05;
            gl.domElement.addEventListener('webglcontextlost', onFailure, { once: true });
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 7, 4]} intensity={2.8} />
          <directionalLight position={[-4, 3, -2]} intensity={1.3} />
          <Suspense fallback={null}>
            <Specimen
              asset={asset}
              progress={progress}
              onReady={onReady}
              roughness={roughness}
              reflectivity={reflectivity}
            />
            <Environment resolution={128} frames={1}>
              <Lightformer
                position={[0, 6, -2]}
                rotation-x={Math.PI / 2}
                scale={[7, 4, 1]}
                intensity={4}
              />
              <Lightformer
                position={[-5, 2, 1]}
                rotation-y={Math.PI / 2}
                scale={[3, 5, 1]}
                intensity={2}
              />
            </Environment>
            <ContactShadows
              position={[0, -0.02, 0]}
              opacity={0.35}
              scale={12}
              far={5}
              blur={2.2}
              resolution={128}
              smooth={false}
              frames={Infinity}
            />
          </Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
