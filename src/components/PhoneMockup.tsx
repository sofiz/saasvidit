import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  Quaternion,
  SRGBColorSpace,
  Texture
} from 'three';

interface Scene {
  id: string;
  title: string;
  image: string | null;
  showTouch: boolean;
  touchX: number;
  touchY: number;
}

interface SceneTiming {
  S: number;
  E: number;
}

interface PhoneMockupProps {
  scenes: Scene[];
  frame: number;
  sceneTimings: SceneTiming[];
  currentPhoneX: number;
  phoneRotationY: number;
  enableSpecialAnimation: boolean;
  interpolate: (frame: number, input: number[], output: number[], easing?: (t: number) => number) => number;
  isExporting?: boolean;
  FPS?: number;
}

const MODEL_URL = '/models/tabletop_macbook_iphone.glb';
const SCREEN_MESH_NAME = 'xXDHkMplTIDAXLN';
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1558;
const PHONE_MODEL_SCALE = 1.08;
const PHONE_STAGE_WIDTH = 620;
const PHONE_STAGE_HEIGHT = 900;
const PHONE_EXPORT_DPR = 2;
const IPHONE_FLOATING_QUATERNION = new Quaternion(0, 0, 0, 1);

function getVisibleSceneIndex(
  frame: number,
  scenes: Scene[],
  sceneTimings: SceneTiming[],
  enableSpecialAnimation: boolean
) {
  const switchOffset = enableSpecialAnimation ? 15 : 0;

  for (let idx = 0; idx < scenes.length; idx++) {
    const timing = sceneTimings[idx] || { S: 0, E: 120 };
    const isVisible =
      frame >= (idx === 0 ? 0 : timing.S + switchOffset) &&
      frame < (idx === scenes.length - 1 ? Number.MAX_SAFE_INTEGER : timing.E + switchOffset);

    if (isVisible) return idx;
  }

  return Math.max(0, scenes.length - 1);
}

function drawContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.min(SCREEN_WIDTH / image.naturalWidth, SCREEN_HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (SCREEN_WIDTH - width) / 2;
  const y = (SCREEN_HEIGHT - height) / 2;

  ctx.drawImage(image, x, y, width, height);
}

function drawEmptyState(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const cx = SCREEN_WIDTH / 2;
  const cy = SCREEN_HEIGHT / 2;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 12;
  ctx.roundRect(cx - 86, cy - 120, 172, 150, 24);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - 42, cy - 80, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 66, cy + 8);
  ctx.lineTo(cx - 8, cy - 44);
  ctx.lineTo(cx + 74, cy + 16);
  ctx.stroke();

  ctx.fillStyle = 'rgba(203, 213, 225, 0.68)';
  ctx.font = '600 34px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Empty Screen', cx, cy + 96);
}

function drawTouch(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  frame: number,
  timing: SceneTiming,
  interpolate: PhoneMockupProps['interpolate']
) {
  if (!scene.showTouch) return;

  const { S, E } = timing;
  const touchStart = E - Math.min(30, (E - S) / 2);
  const touchEnd = E;
  if (frame < touchStart || frame > touchEnd) return;

  const touchOpacity = interpolate(frame, [touchStart, touchStart + 5, touchEnd - 5, touchEnd], [0, 0.8, 0.8, 0]);
  const touchScale = interpolate(frame, [touchStart, touchStart + 10, touchStart + 15], [1.5, 0.8, 0.8]);
  const rippleScale = interpolate(frame, [touchStart + 10, touchStart + 25], [0.8, 2.5]);
  const rippleOpacity = interpolate(frame, [touchStart + 10, touchStart + 25], [0.6, 0]);
  const x = (scene.touchX / 100) * SCREEN_WIDTH;
  const y = (scene.touchY / 100) * SCREEN_HEIGHT;
  const radius = 46;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = rippleOpacity;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, radius * rippleScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = touchOpacity;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, radius * touchScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function useScreenTexture({
  scene,
  timing,
  frame,
  interpolate
}: {
  scene: Scene | undefined;
  timing: SceneTiming | undefined;
  frame: number;
  interpolate: PhoneMockupProps['interpolate'];
}) {
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const [, forceUpdate] = useState(0);

  const [{ canvas, sourceCanvas, texture }] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = SCREEN_WIDTH;
    sourceCanvas.height = SCREEN_HEIGHT;

    const nextTexture = new CanvasTexture(canvas);
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.minFilter = LinearFilter;
    nextTexture.magFilter = LinearFilter;
    nextTexture.flipY = false;
    return { canvas, sourceCanvas, texture: nextTexture };
  });

  useEffect(() => {
    const src = scene?.image;
    if (!src || imageCacheRef.current.has(src)) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => forceUpdate((tick) => tick + 1);
    image.src = src;
    imageCacheRef.current.set(src, image);
  }, [scene?.image]);

  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    const sourceCtx = sourceCanvas.getContext('2d');
    const textureCtx = canvas.getContext('2d');
    if (!sourceCtx || !textureCtx) return;

    sourceCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    sourceCtx.fillStyle = '#000000';
    sourceCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const cachedImage = scene?.image ? imageCacheRef.current.get(scene.image) : null;
    if (cachedImage?.complete && cachedImage.naturalWidth > 0) {
      drawContain(sourceCtx, cachedImage);
    } else {
      drawEmptyState(sourceCtx);
    }

    if (scene && timing) {
      drawTouch(sourceCtx, scene, frame, timing, interpolate);
    }

    textureCtx.save();
    textureCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    textureCtx.translate(0, SCREEN_HEIGHT);
    textureCtx.scale(1, -1);
    textureCtx.drawImage(sourceCanvas, 0, 0);
    textureCtx.restore();

    // Three textures are mutable render resources; flag the canvas upload after each redraw.
    texture.needsUpdate = true;
  }, [canvas, frame, interpolate, scene, sourceCanvas, texture, timing]);
  /* eslint-enable react-hooks/immutability */

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

function DeviceModel({
  screenTexture,
  phoneRotationY
}: {
  screenTexture: Texture;
  phoneRotationY: number;
}) {
  const gltf = useGLTF(MODEL_URL, '/draco/');

  const phone = useMemo(() => {
    const source = gltf.scene.getObjectByName('iphone');
    if (!source) return new Group();

    const clone = source.clone(true) as Object3D;

    clone.position.set(0, 0, 0);
    clone.quaternion.copy(IPHONE_FLOATING_QUATERNION);

    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      object.castShadow = true;
      object.receiveShadow = true;

      if (object.name === SCREEN_MESH_NAME) {
        object.material = new MeshBasicMaterial({
          map: screenTexture,
          side: DoubleSide,
          toneMapped: false
        });
        return;
      }

      const material = object.material;
      if (material instanceof MeshStandardMaterial) {
        object.material = material.clone();
        object.material.envMapIntensity = 0.8;
        object.material.roughness = Math.max(0.28, object.material.roughness);
      }
    });

    return clone;
  }, [gltf.scene, screenTexture]);

  useEffect(() => {
    const screen = phone.getObjectByName(SCREEN_MESH_NAME) as Mesh | undefined;
    if (screen) {
      screen.material = new MeshBasicMaterial({
        map: screenTexture,
        side: DoubleSide,
        toneMapped: false
      });
    }
  }, [phone, screenTexture]);

  return (
    <group scale={PHONE_MODEL_SCALE} position={[0, -0.08, 0]} rotation={[0, phoneRotationY * (Math.PI / 180), 0]}>
      <primitive object={phone} />
    </group>
  );
}

function SceneEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new PMREMGenerator(gl);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;

    scene.environment = environmentMap;

    return () => {
      scene.environment = null;
      environmentMap.dispose();
      roomEnvironment.clear();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

function PhoneScene({
  scenes,
  frame,
  sceneTimings,
  phoneRotationY,
  enableSpecialAnimation,
  interpolate,
  isExporting = false
}: Omit<PhoneMockupProps, 'currentPhoneX' | 'FPS'>) {
  const activeSceneIndex = getVisibleSceneIndex(frame, scenes, sceneTimings, enableSpecialAnimation);
  const activeScene = scenes[activeSceneIndex];
  const activeTiming = sceneTimings[activeSceneIndex];
  const screenTexture = useScreenTexture({
    scene: activeScene,
    timing: activeTiming,
    frame,
    interpolate
  });

  return (
    <Canvas
      shadows
      dpr={isExporting ? PHONE_EXPORT_DPR : [1, 2]}
      gl={{
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      }}
      camera={{ position: [0, 0, 10.2], fov: 30 }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneEnvironment />
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 5, 6]} intensity={2.4} castShadow />
      <directionalLight position={[-4, -1, 4]} intensity={0.75} color="#8fb7ff" />
      <Suspense fallback={null}>
        <DeviceModel screenTexture={screenTexture} phoneRotationY={phoneRotationY} />
      </Suspense>
    </Canvas>
  );
}

const PhoneMockup: React.FC<PhoneMockupProps> = ({
  scenes,
  frame,
  sceneTimings,
  currentPhoneX,
  phoneRotationY,
  enableSpecialAnimation,
  interpolate,
  isExporting = false,
  FPS = 30
}) => {
  return (
    <div
      className="absolute top-1/2 left-1/2 z-10 phone-wrapper"
      style={{
        transform: `translate(calc(-50% + ${currentPhoneX}px), -50%) scale(var(--phone-scale, 1))`
      }}
    >
      <div
        className="phone-device-float"
        style={{
          ...(isExporting
            ? {
                animationPlayState: 'paused',
                animationDelay: `-${frame / FPS}s`
              }
            : {})
        }}
      >
        <div
          className="phone-device-stage"
          style={{
            width: PHONE_STAGE_WIDTH,
            height: PHONE_STAGE_HEIGHT
          }}
        >
          <div
            className="phone-shadow"
            style={{
              ...(isExporting
                ? {
                    animationPlayState: 'paused',
                    animationDelay: `-${frame / FPS}s`
                  }
                : {})
            }}
          />
          <PhoneScene
            scenes={scenes}
            frame={frame}
            sceneTimings={sceneTimings}
            phoneRotationY={phoneRotationY}
            enableSpecialAnimation={enableSpecialAnimation}
            interpolate={interpolate}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
};

useGLTF.preload(MODEL_URL, '/draco/');

export default PhoneMockup;
