export type ToolId =
  | 'hand'
  | 'knife'
  | 'lighter'
  | 'freeze'
  | 'shock'
  | 'pump'
  | 'hammer'
  | 'vortex';

export type ToppingType = 'floam' | 'glitter' | 'eyes' | 'boba' | 'gold';

export type RoomThemeId = 'studio' | 'sunset' | 'uv_dark';

export interface SlimeMaterialPreset {
  id: string;
  name: string;
  subtitle: string;
  baseColor: [number, number, number]; // RGB
  highlightColor: [number, number, number];
  deepColor: [number, number, number];
  opacity: number;
  specularPower: number;
  specularIntensity: number;
  glowIntensity: number;
  defaultViscosity: number;
  defaultElasticity: number;
  defaultAdhesion: number;
}

export interface PhysicsSettings {
  viscosity: number;      // 0.1 to 1.0 (runny to thick putty)
  elasticity: number;     // 0.1 to 1.0 (doughy to bouncy jelly)
  wallAdhesion: number;   // 0.0 to 1.0 (bounces off corners vs sticks & oozes down corners)
  gravity: number;        // -0.2 to 1.5 (0 = Zero-G floating, 1 = Earth gravity)
  surfaceTension: number; // 0.2 to 1.0 (how strongly nodes pull into spherical droplets)
}

export interface SlimeNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  mass: number;
  temperature: number; // 24 = ambient, >80 = boiling, >140 = charring, <0 = freezing
  charLevel: number;   // 0.0 (fresh) to 1.0 (charred black crispy)
  frostLevel: number;  // 0.0 (normal) to 1.0 (solid ice)
  inflation: number;   // 1.0 (normal) to 2.8 (about to burst)
  charge: number;      // 0.0 to 1.0 (electrostatic excitement)
  pinnedWall: 'none' | 'left' | 'right' | 'ceiling' | 'corner_tl' | 'corner_tr' | 'corner_bl' | 'corner_br';
  adhesionTimer: number;
  colorOffset: [number, number, number];
}

export interface SlimeSpring {
  a: number; // index in nodes
  b: number; // index in nodes
  restLength: number;
  stiffness: number;
}

export interface InternalItem {
  id: number;
  type: ToppingType;
  nodeIndex: number; // attached to a slime node so when cut in half, toppings split naturally!
  offsetX: number;
  offsetY: number;
  angle: number;
  angularVel: number;
  size: number;
  color: string;
}

export interface WallStain {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  color: string;
  alpha: number;
  dripLength: number;
  maxDripLength: number;
  wall: 'back' | 'left' | 'right' | 'floor' | 'corner';
}

export interface FXParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'flame' | 'smoke' | 'spark' | 'frost' | 'slime_drop' | 'bubble' | 'ice_shard' | 'slash';
}

export interface SimulationTelemetry {
  blobCount: number;
  avgTemperature: number;
  burnPercentage: number;
  frostPercentage: number;
  activeStains: number;
  stateLabel: string;
  lastActionNotice: string;
}

export const SLIME_PRESETS: SlimeMaterialPreset[] = [
  {
    id: 'emerald_jelly',
    name: 'Thạch Ngọc Lục Bảo',
    subtitle: 'Trong suốt, bóng gương, đàn hồi cao',
    baseColor: [16, 185, 129],
    highlightColor: [209, 250, 229],
    deepColor: [6, 78, 59],
    opacity: 0.86,
    specularPower: 38,
    specularIntensity: 0.95,
    glowIntensity: 0.15,
    defaultViscosity: 0.55,
    defaultElasticity: 0.78,
    defaultAdhesion: 0.65,
  },
  {
    id: 'strawberry_milk',
    name: 'Mây Hồng Dâu Sữa',
    subtitle: 'Mềm mịn, dẻo kéo sợi, bám góc tường',
    baseColor: [244, 114, 182],
    highlightColor: [253, 242, 248],
    deepColor: [157, 23, 77],
    opacity: 0.94,
    specularPower: 24,
    specularIntensity: 0.75,
    glowIntensity: 0.1,
    defaultViscosity: 0.72,
    defaultElasticity: 0.62,
    defaultAdhesion: 0.82,
  },
  {
    id: 'cyber_plasma',
    name: 'Phát Quang Sinh Học',
    subtitle: 'Tự phát sáng rực rỡ trong phòng tối UV',
    baseColor: [56, 189, 248],
    highlightColor: [224, 242, 254],
    deepColor: [3, 105, 161],
    opacity: 0.82,
    specularPower: 45,
    specularIntensity: 1.0,
    glowIntensity: 0.85,
    defaultViscosity: 0.48,
    defaultElasticity: 0.85,
    defaultAdhesion: 0.6,
  },
  {
    id: 'honey_amber',
    name: 'Mật Ong Hổ Phách',
    subtitle: 'Siêu đặc quánh, chảy chậm từ trần & góc tường',
    baseColor: [245, 158, 11],
    highlightColor: [254, 243, 199],
    deepColor: [120, 53, 15],
    opacity: 0.88,
    specularPower: 50,
    specularIntensity: 0.98,
    glowIntensity: 0.25,
    defaultViscosity: 0.88,
    defaultElasticity: 0.45,
    defaultAdhesion: 0.95,
  },
  {
    id: 'galaxy_nebula',
    name: 'Tinh Vân Ngân Hà',
    subtitle: 'Ánh tím huyền ảo, phản quang đa sắc',
    baseColor: [168, 85, 247],
    highlightColor: [243, 232, 255],
    deepColor: [59, 7, 100],
    opacity: 0.9,
    specularPower: 36,
    specularIntensity: 0.9,
    glowIntensity: 0.45,
    defaultViscosity: 0.64,
    defaultElasticity: 0.74,
    defaultAdhesion: 0.7,
  },
  {
    id: 'magma_core',
    name: 'Dung Nham Núi Lửa',
    subtitle: 'Nhiệt lượng cao, âm ỉ phát sáng đỏ cam',
    baseColor: [239, 68, 68],
    highlightColor: [254, 215, 170],
    deepColor: [127, 29, 29],
    opacity: 0.92,
    specularPower: 30,
    specularIntensity: 0.85,
    glowIntensity: 0.65,
    defaultViscosity: 0.75,
    defaultElasticity: 0.58,
    defaultAdhesion: 0.75,
  },
];
