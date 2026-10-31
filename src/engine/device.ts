import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CanvasTexture,
  DirectionalLight,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Texture,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Pose } from './types';

const MODEL_URL = '/models/tabletop_macbook_iphone.glb';
const SCREEN_MESH = 'xXDHkMplTIDAXLN';
const FOV = 20;
const CAMERA_Z = 20;
const VIEW_HEIGHT = 2 * CAMERA_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
const DEG = Math.PI / 180;

let modelPromise: Promise<GLTF> | null = null;

export function loadDeviceModel() {
  if (!modelPromise) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    modelPromise = loader.loadAsync(MODEL_URL);
  }
  return modelPromise;
}

/** Least-squares affine map from screen UVs to positions in the screen mesh's local space. */
function fitUvToLocal(mesh: Mesh) {
  const uv = mesh.geometry.attributes.uv;
  const pos = mesh.geometry.attributes.position;
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const R = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < uv.count; i++) {
    const row = [uv.getX(i), uv.getY(i), 1];
    const c = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) M[a * 3 + b] += row[a] * row[b];
      for (let k = 0; k < 3; k++) R[k][a] += row[a] * c[k];
    }
  }
  const det = (m: number[]) =>
    m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const D = det(M) || 1e-12;
  const solve = (rhs: number[]) =>
    [0, 1, 2].map((col) => {
      const m = [...M];
      for (let r = 0; r < 3; r++) m[r * 3 + col] = rhs[r];
      return det(m) / D;
    });
  const coef = R.map(solve);
  return (u: number, v: number) => new Vector3(...coef.map(([a, b, c]) => a * u + b * v + c));
}

export class DeviceRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  readonly ready: Promise<void>;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
  private pivot = new Group();
  private screenMesh: Mesh | null = null;
  private uvToLocal: ((u: number, v: number) => Vector3) | null = null;
  private raycaster = new Raycaster();
  private stageW = 1920;
  private stageH = 1080;
  private envTexture: Texture | null = null;

  constructor(screenCanvas: HTMLCanvasElement, quality: 'preview' | 'export' = 'preview') {
    this.canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.texture = new CanvasTexture(screenCanvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.flipY = true;
    if (quality === 'export') {
      this.texture.generateMipmaps = true;
      this.texture.minFilter = LinearMipmapLinearFilter;
      this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    } else {
      this.texture.generateMipmaps = false;
      this.texture.minFilter = LinearFilter;
    }
    this.texture.magFilter = LinearFilter;

    this.camera.position.set(0, 0, CAMERA_Z);
    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTexture = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.envTexture;
    room.clear();
    pmrem.dispose();

    this.scene.add(new AmbientLight(0xffffff, 0.7));
    const key = new DirectionalLight(0xffffff, 2.3);
    key.position.set(3, 5, 6);
    const fill = new DirectionalLight(0x9ab8ff, 0.75);
    fill.position.set(-4, -1, 4);
    const rim = new DirectionalLight(0xffffff, 1.6);
    rim.position.set(-3, 4, -6);
    this.scene.add(key, fill, rim, this.pivot);

    this.ready = this.load();
  }

  private async load() {
    const gltf = await loadDeviceModel();
    const source = gltf.scene.getObjectByName('iphone');
    if (!source) throw new Error('Phone model not found in GLB.');
    const clone = source.clone(true) as Object3D;
    clone.position.set(0, 0, 0);
    clone.quaternion.identity();
    clone.scale.setScalar(1);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const center = box.getCenter(new Vector3());
    clone.position.sub(center);

    const holder = new Group();
    holder.add(clone);
    holder.scale.setScalar(1 / (box.max.y - box.min.y));
    holder.rotation.y = Math.PI;

    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (object.name === SCREEN_MESH) {
        object.material = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
        this.screenMesh = object;
        this.uvToLocal = fitUvToLocal(object);
        return;
      }
      if (object.material instanceof MeshStandardMaterial) {
        const material = object.material.clone();
        material.envMapIntensity = 0.85;
        material.roughness = Math.max(0.26, material.roughness);
        object.material = material;
      }
    });
    this.pivot.add(holder);
  }

  get isReady() {
    return this.screenMesh !== null;
  }

  setSize(pixelW: number, pixelH: number, stageW: number, stageH: number) {
    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) this.renderer.setSize(pixelW, pixelH, false);
    this.stageW = stageW;
    this.stageH = stageH;
    this.camera.aspect = stageW / stageH;
    this.camera.updateProjectionMatrix();
  }

  setPose(p: Pose) {
    const ppu = this.stageH / VIEW_HEIGHT;
    this.pivot.position.set((p.cx - this.stageW / 2) / ppu, -(p.cy - this.stageH / 2) / ppu, 0);
    this.pivot.scale.setScalar(p.h / ppu);
    this.pivot.rotation.set(p.rx * DEG, p.ry * DEG, p.rz * DEG, 'XYZ');
    this.scene.updateMatrixWorld(true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }

  /** Projects a point on the display (percent coordinates) into stage pixels. */
  project(x: number, y: number) {
    if (!this.screenMesh || !this.uvToLocal) return null;
    const p = this.uvToLocal(x / 100, 1 - y / 100).applyMatrix4(this.screenMesh.matrixWorld).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.stageW, y: ((1 - p.y) / 2) * this.stageH };
  }

  /** Finds the display point under a stage-pixel position, in percent coordinates. */
  pick(sx: number, sy: number) {
    if (!this.screenMesh) return null;
    this.raycaster.setFromCamera(new Vector2((sx / this.stageW) * 2 - 1, 1 - (sy / this.stageH) * 2), this.camera);
    const hit = this.raycaster.intersectObject(this.screenMesh, false)[0];
    if (!hit?.uv) return null;
    return { x: hit.uv.x * 100, y: (1 - hit.uv.y) * 100 };
  }

  dispose() {
    this.texture.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
