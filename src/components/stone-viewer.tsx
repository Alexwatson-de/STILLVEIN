'use client';
import { Component, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Expand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Product, Visualization, models } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
import { modelDimensions, textureRepeat } from '@/lib/visualization';
class ViewerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
function Stone({ product, settings: s }: { product: Product; settings: Visualization }) {
  const url = imageUrl(
    product.texture!.url,
    typeof window !== 'undefined' && window.innerWidth < 700 ? 1024 : 2048,
  );
  const source = useTexture(url);
  // Keep an active texture cached during model changes, release GPU and loader
  // cache when its material leaves the viewer. Browser HTTP caching remains.
  useEffect(
    () => () => {
      useTexture.clear(url);
      source.dispose();
    },
    [url, source],
  );
  const { gl } = useThree();
  const texture = useMemo(() => {
    const t = source.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const r = textureRepeat(product.texture!.width, product.texture!.height, s);
    t.repeat.set(r[0], r[1]);
    t.center.set(0.5, 0.5);
    t.rotation = THREE.MathUtils.degToRad(s.rotation);
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  }, [source, product.texture, s, gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  const dims = modelDimensions[s.model];
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(...dims);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    const normals = g.attributes.normal;
    const a = 1.5;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normals.getX(i)),
        ny = Math.abs(normals.getY(i));
      let u, v;
      if (ny > 0.5) {
        u = pos.getX(i) / a;
        v = pos.getZ(i) / a;
      } else if (nx > 0.5) {
        u = pos.getZ(i) / a;
        v = pos.getY(i) / a;
      } else {
        u = pos.getX(i) / a;
        v = pos.getY(i) / a;
      }
      uv.setXY(i, u + 0.5, v + 0.5);
    }
    uv.needsUpdate = true;
    return g;
  }, [dims]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const y = s.model === 'countertop' ? 0.9 : dims[1] / 2 + 0.06;
  return (
    <group>
      <mesh geometry={geometry} position={[0, y, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={texture}
          roughness={s.roughness}
          metalness={0}
          reflectivity={s.reflectivity}
          clearcoat={Math.max(0, 0.5 - s.roughness)}
          clearcoatRoughness={s.roughness}
        />
      </mesh>
      {s.model === 'countertop' && (
        <>
          <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.68, 0.86, 0.75]} />
            <meshStandardMaterial color="#bebdb0" roughness={0.8} />
          </mesh>
          {[-0.89, 0, 0.89].map((x) => (
            <mesh key={x} position={[x, 0.46, 0.378]}>
              <boxGeometry args={[0.875, 0.72, 0.015]} />
              <meshStandardMaterial color="#d1cfc1" roughness={0.7} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
function Camera({
  preset,
  reset,
  zoom,
}: {
  preset: Visualization['camera'];
  reset: number;
  zoom: number;
}) {
  const { camera, invalidate } = useThree();
  const ref = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const p: Record<string, [number, number, number]> = {
      perspective: [4, 3.1, 4.8],
      top: [0.01, 6, 0.01],
      front: [0, 1.3, 6],
    };
    camera.position.set(...p[preset]);
    camera.lookAt(0, 0.6, 0);
    ref.current?.target.set(0, 0.6, 0);
    ref.current?.update();
    invalidate();
  }, [camera, preset, reset, invalidate]);
  useEffect(() => {
    if (zoom === 0) return;
    const target = ref.current?.target || new THREE.Vector3(0, 0.6, 0);
    camera.position
      .sub(target)
      .multiplyScalar(zoom > 0 ? 0.85 : 1.17)
      .clampLength(2, 12)
      .add(target);
    ref.current?.update();
    invalidate();
  }, [zoom, camera, invalidate]);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      minDistance={2}
      maxDistance={12}
      maxPolarAngle={Math.PI * 0.49}
      enablePan={false}
    />
  );
}
export default function StoneViewer({
  product,
  settings: external,
  onSettingsChange,
}: {
  product: Product;
  settings?: Visualization;
  onSettingsChange?: (s: Visualization) => void;
}) {
  const [settings, setSettings] = useState(external || product.visualization);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reset, setReset] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [lost, setLost] = useState(false);
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      setSupported(!!context);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
  }, []);
  useEffect(() => {
    if (external) setSettings(external);
  }, [external]);
  const change = (patch: Partial<Visualization>) => {
    const s = { ...settings, ...patch };
    setSettings(s);
    onSettingsChange?.(s);
  };
  const fallback = (
    <div className="empty">
      {product.galleryImages[0] && (
        <img
          style={{ height: 250, margin: '0 auto 20px' }}
          src={imageUrl(product.galleryImages[0].url, 1000)}
          alt={product.galleryImages[0].alt}
        />
      )}
      <h3>3D preview unavailable</h3>
      <p>
        The texture could not load, or this device does not support WebGL 2. Gallery and
        specifications are still available.
      </p>
    </div>
  );
  if (!product.texture || supported === false || lost) return fallback;
  const backgrounds = { neutral: '#e6e5dd', warm: '#ded3bd', dark: '#282c28' };
  return (
    <div className="viewer" ref={root}>
      <div className="canvas-wrap">
        <div
          className="viewer-watermark"
          style={{ color: settings.background === 'dark' ? '#d6dacb' : '#696e5c' }}
        >
          MATERIAL STUDY / {product.sku}
        </div>
        {supported === null ? (
          <div className="empty">Preparing your studio…</div>
        ) : (
          <ViewerBoundary key={product.texture.assetId} fallback={fallback}>
            <Canvas
              frameloop="demand"
              shadows
              dpr={[1, 1.5]}
              camera={{ position: [4, 3, 4.8], fov: 40 }}
              gl={{
                antialias: true,
                // Transparent clear is required by the contact-shadow render target.
                alpha: true,
                powerPreference: 'low-power',
                toneMapping: THREE.ACESFilmicToneMapping,
              }}
              onCreated={({ gl }) => {
                gl.domElement.addEventListener('webglcontextlost', () => setLost(true), {
                  once: true,
                });
                gl.toneMappingExposure = 1.05;
              }}
            >
              <color attach="background" args={[backgrounds[settings.background]]} />
              <ambientLight intensity={0.45} />
              <directionalLight
                castShadow
                position={[3, 6, 4]}
                intensity={2}
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0002}
                shadow-camera-left={-5}
                shadow-camera-right={5}
                shadow-camera-top={5}
                shadow-camera-bottom={-5}
              />
              <directionalLight position={[-4, 2, -2]} intensity={0.7} />
              <Suspense
                fallback={
                  <Html center>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        background: '#f6f5f1',
                        padding: 12,
                        fontSize: 12,
                      }}
                    >
                      Loading stone texture…
                    </span>
                  </Html>
                }
              >
                <Stone product={product} settings={settings} />
                <Environment resolution={128} frames={1}>
                  <Lightformer
                    position={[0, 5, -3]}
                    rotation-x={Math.PI / 2}
                    scale={[6, 4, 1]}
                    intensity={3}
                  />
                  <Lightformer
                    position={[-4, 2, 0]}
                    rotation-y={Math.PI / 2}
                    scale={[3, 4, 1]}
                    intensity={2}
                  />
                </Environment>
                <ContactShadows
                  key={settings.model}
                  position={[0, 0.005, 0]}
                  opacity={0.35}
                  scale={12}
                  blur={2.5}
                  far={4}
                  resolution={256}
                  frames={1}
                />
              </Suspense>
              <Camera preset={settings.camera} reset={reset} zoom={zoom} />
            </Canvas>
          </ViewerBoundary>
        )}
        <span className="viewer-hint">Drag to rotate · Scroll or pinch to zoom</span>
      </div>
      <div className="viewer-controls">
        <label>
          Model preset
          <select
            aria-label="Model preset"
            value={settings.model}
            onChange={(e) => change({ model: e.target.value as Visualization['model'] })}
          >
            {models.map((m) => (
              <option value={m} key={m}>
                {
                  {
                    slab: 'Flat slab',
                    vertical: 'Vertical slab',
                    countertop: 'Kitchen countertop',
                    floor: 'Floor panel',
                    wall: 'Wall cladding',
                  }[m]
                }
              </option>
            ))}
          </select>
        </label>
        <label>
          Environment
          <select
            aria-label="Studio background"
            value={settings.background}
            onChange={(e) => change({ background: e.target.value as Visualization['background'] })}
          >
            <option value="neutral">Neutral studio</option>
            <option value="warm">Warm architecture</option>
            <option value="dark">Dark showcase</option>
          </select>
        </label>
        <label>
          Camera
          <select
            aria-label="Camera angle"
            value={settings.camera}
            onChange={(e) => change({ camera: e.target.value as Visualization['camera'] })}
          >
            <option value="perspective">Perspective</option>
            <option value="top">Top</option>
            <option value="front">Front</option>
          </select>
        </label>
        <button aria-label="Zoom in" onClick={() => setZoom(Math.abs(zoom) + 1)}>
          <ZoomIn size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => setZoom(-Math.abs(zoom) - 1)}>
          <ZoomOut size={18} />
        </button>
        <button aria-label="Reset camera" onClick={() => setReset((v) => v + 1)}>
          <RotateCcw size={17} />
        </button>
        <button
          aria-label="Fullscreen viewer"
          onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
              else setMessage('Fullscreen is not supported in this browser.');
            } catch {
              setMessage('Fullscreen is unavailable.');
            }
          }}
        >
          <Expand size={17} />
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <p className="viewer-caption">
        Texture-mapped visualization, not a 3D scan. Preset dimensions are illustrative; veining and
        colour vary by slab.
      </p>
    </div>
  );
}
