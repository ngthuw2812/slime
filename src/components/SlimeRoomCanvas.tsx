import React, { useEffect, useRef, useCallback } from 'react';
import {
  ToolId,
  ToppingType,
  RoomThemeId,
  SlimeMaterialPreset,
  PhysicsSettings,
  SlimeNode,
  SlimeSpring,
  InternalItem,
  WallStain,
  FXParticle,
  SimulationTelemetry,
} from '../types/slime';
import { asmrAudio } from '../audio/asmrAudio';

interface SlimeRoomCanvasProps {
  activeTool: ToolId;
  preset: SlimeMaterialPreset;
  physics: PhysicsSettings;
  roomTheme: RoomThemeId;
  resetTrigger: number;
  mergeTrigger: number;
  throwCornerTrigger: number;
  cleanRoomTrigger: number;
  pendingTopping: { type: ToppingType; count: number; seq: number } | null;
  onTelemetryUpdate: (telemetry: SimulationTelemetry) => void;
}

const NODE_COUNT = 88;

export const SlimeRoomCanvas: React.FC<SlimeRoomCanvasProps> = ({
  activeTool,
  preset,
  physics,
  roomTheme,
  resetTrigger,
  mergeTrigger,
  throwCornerTrigger,
  cleanRoomTrigger,
  pendingTopping,
  onTelemetryUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation state stored in refs for 60fps loop without re-renders
  const nodesRef = useRef<SlimeNode[]>([]);
  const springsRef = useRef<SlimeSpring[]>([]);
  const itemsRef = useRef<InternalItem[]>([]);
  const stainsRef = useRef<WallStain[]>([]);
  const particlesRef = useRef<FXParticle[]>([]);
  const bubblesRef = useRef<{ nodeIdx: number; ox: number; oy: number; r: number; phase: number }[]>([]);

  // Pointer & interaction state
  const pointerRef = useRef<{
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    vx: number;
    vy: number;
    isDown: boolean;
    grabbedNodes: { idx: number; weight: number; dx: number; dy: number }[];
    slicePath: { x: number; y: number; time: number }[];
  }>({
    x: 400,
    y: 300,
    prevX: 400,
    prevY: 300,
    vx: 0,
    vy: 0,
    isDown: false,
    grabbedNodes: [],
    slicePath: [],
  });

  const activeToolRef = useRef<ToolId>(activeTool);
  activeToolRef.current = activeTool;

  const presetRef = useRef<SlimeMaterialPreset>(preset);
  presetRef.current = preset;

  const physicsRef = useRef<PhysicsSettings>(physics);
  physicsRef.current = physics;

  const roomThemeRef = useRef<RoomThemeId>(roomTheme);
  roomThemeRef.current = roomTheme;

  const lastNoticeRef = useRef<string>('Sẵn sàng tương tác — Nắm kéo, dùng dao cắt hoặc bật lửa đốt');
  const frameCountRef = useRef<number>(0);

  // Helper to spawn FX particles
  const spawnParticles = useCallback(
    (
      x: number,
      y: number,
      count: number,
      type: FXParticle['type'],
      customColor?: string,
      speedMult = 1
    ) => {
      const list = particlesRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1 + Math.random() * 5.5) * speedMult;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        let size = 3 + Math.random() * 5;
        let maxLife = 25 + Math.random() * 30;
        let color = customColor || `rgb(${presetRef.current.baseColor.join(',')})`;

        if (type === 'flame') {
          vx = (Math.random() - 0.5) * 2.2;
          vy = -2.5 - Math.random() * 4.5;
          size = 7 + Math.random() * 10;
          maxLife = 16 + Math.random() * 14;
          const colors = ['#FFFBEB', '#FDE047', '#FB923C', '#EF4444'];
          color = colors[Math.floor(Math.random() * colors.length)];
        } else if (type === 'smoke') {
          vx = (Math.random() - 0.5) * 1.6;
          vy = -1.5 - Math.random() * 2.5;
          size = 8 + Math.random() * 14;
          maxLife = 40 + Math.random() * 35;
          color = Math.random() > 0.4 ? '#334155' : '#1E293B';
        } else if (type === 'frost') {
          vx = (Math.random() - 0.5) * 5;
          vy = (Math.random() - 0.5) * 5;
          size = 4 + Math.random() * 7;
          maxLife = 22 + Math.random() * 20;
          color = Math.random() > 0.5 ? '#E0F2FE' : '#38BDF8';
        } else if (type === 'ice_shard') {
          vy -= 3;
          size = 5 + Math.random() * 6;
          maxLife = 35 + Math.random() * 20;
          color = '#BAE6FD';
        } else if (type === 'spark') {
          size = 2 + Math.random() * 3.5;
          maxLife = 14 + Math.random() * 12;
          color = Math.random() > 0.5 ? '#FEF08A' : '#38BDF8';
        }

        list.push({
          x,
          y,
          vx,
          vy,
          size,
          color,
          alpha: 1,
          life: 0,
          maxLife,
          type,
        });
      }
      if (list.length > 360) {
        list.splice(0, list.length - 360);
      }
    },
    []
  );

  // Initialize or reset the cohesive slime blob
  const initSlime = useCallback((width: number, height: number) => {
    const cx = width * 0.5;
    const cy = height * 0.54;
    const nodes: SlimeNode[] = [];
    const springs: SlimeSpring[] = [];
    const bubbles: { nodeIdx: number; ox: number; oy: number; r: number; phase: number }[] = [];

    // Arrange nodes in concentric organic rings
    let id = 0;
    const rings = [
      { count: 1, rad: 0 },
      { count: 8, rad: 22 },
      { count: 16, rad: 44 },
      { count: 26, rad: 66 },
      { count: 37, rad: 88 },
    ];

    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        if (id >= NODE_COUNT) break;
        const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const r = ring.rad + (Math.random() - 0.5) * 4;
        const baseR = ring.rad > 60 ? 29 : 33;
        nodes.push({
          id,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
          radius: baseR,
          baseRadius: baseR,
          mass: 1.0,
          temperature: 24,
          charLevel: 0,
          frostLevel: 0,
          inflation: 1.0,
          charge: 0,
          pinnedWall: 'none',
          adhesionTimer: 0,
          colorOffset: [0, 0, 0],
        });
        id++;
      }
    }

    // Build cohesive elastic network between nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 62) {
          springs.push({
            a: i,
            b: j,
            restLength: dist,
            stiffness: dist < 34 ? 0.24 : 0.12,
          });
        }
      }
    }

    // Internal natural air bubbles for realistic jelly look
    for (let b = 0; b < 32; b++) {
      bubbles.push({
        nodeIdx: Math.floor(Math.random() * nodes.length),
        ox: (Math.random() - 0.5) * 18,
        oy: (Math.random() - 0.5) * 18,
        r: 2 + Math.random() * 5.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Default cute pair of googly eyes + some glitter inside so it's immediately charming
    const initialItems: InternalItem[] = [
      {
        id: 1,
        type: 'eyes',
        nodeIndex: Math.min(3, nodes.length - 1),
        offsetX: -14,
        offsetY: -8,
        angle: 0,
        angularVel: 0,
        size: 13,
        color: '#FFFFFF',
      },
      {
        id: 2,
        type: 'eyes',
        nodeIndex: Math.min(6, nodes.length - 1),
        offsetX: 14,
        offsetY: -8,
        angle: 0,
        angularVel: 0,
        size: 13,
        color: '#FFFFFF',
      },
    ];

    nodesRef.current = nodes;
    springsRef.current = springs;
    bubblesRef.current = bubbles;
    itemsRef.current = initialItems;
    lastNoticeRef.current = 'Khối slime mới đã sẵn sàng trên bàn thí nghiệm';
    asmrAudio.playSquish(0.7);
  }, []);

  // Re-merge scattered/cut slime blobs back into one cohesive mass
  const mergeAllBlobs = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    // Reset extreme states and pull toward center
    let cx = 0;
    let cy = 0;
    for (const n of nodes) {
      cx += n.x;
      cy += n.y;
      n.pinnedWall = 'none';
      n.adhesionTimer = 0;
      n.frostLevel = Math.max(0, n.frostLevel - 0.5);
      n.inflation = 1.0;
    }
    cx /= nodes.length;
    cy /= nodes.length;

    // Arrange target distances and rebuild springs
    const newSprings: SlimeSpring[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const dx = cx - nodes[i].x;
      const dy = cy - nodes[i].y;
      nodes[i].vx += dx * 0.14;
      nodes[i].vy += dy * 0.14;
    }

    // Reconnect nearest neighbors so cut halves fuse back
    for (let i = 0; i < nodes.length; i++) {
      // Find closest 9 nodes
      const dists: { idx: number; d: number }[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
        dists.push({ idx: j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(8, dists.length); k++) {
        const j = dists[k].idx;
        if (i < j) {
          newSprings.push({
            a: i,
            b: j,
            restLength: 26 + (k > 4 ? 16 : 0),
            stiffness: k < 4 ? 0.22 : 0.11,
          });
        }
      }
    }

    springsRef.current = newSprings;
    lastNoticeRef.current = 'Đã hợp nhất tất cả các mảnh slime thành một khối nguyên vẹn';
    asmrAudio.playSquish(0.95);
  }, []);

  // Throw the slime forcefully into a corner of the room!
  const throwIntoCorner = useCallback(() => {
    const canvas = canvasRef.current;
    const nodes = nodesRef.current;
    if (!canvas || nodes.length === 0) return;

    const corners: {
      name: string;
      tx: number;
      ty: number;
      pin: SlimeNode['pinnedWall'];
    }[] = [
      { name: 'Góc Trên Bên Trái', tx: 65, ty: 65, pin: 'corner_tl' },
      { name: 'Góc Trên Bên Phải', tx: canvas.width - 65, ty: 65, pin: 'corner_tr' },
      { name: 'Góc Dưới Bên Trái', tx: 70, ty: canvas.height - 75, pin: 'corner_bl' },
      { name: 'Góc Dưới Bên Phải', tx: canvas.width - 70, ty: canvas.height - 75, pin: 'corner_br' },
    ];

    const chosen = corners[Math.floor(Math.random() * corners.length)];
    for (const n of nodes) {
      n.pinnedWall = 'none';
      const dx = chosen.tx - n.x;
      const dy = chosen.ty - n.y;
      const dist = Math.max(40, Math.hypot(dx, dy));
      const speed = 34 + Math.random() * 8;
      n.vx = (dx / dist) * speed + (Math.random() - 0.5) * 4;
      n.vy = (dy / dist) * speed + (Math.random() - 0.5) * 4;
    }

    lastNoticeRef.current = `Đã ném mạnh khối slime bay thẳng vào ${chosen.name}!`;
    asmrAudio.playSquish(0.9);
  }, []);

  // Handle line segment intersection for Knife slicing
  const lineSegmentsIntersect = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
  ) => {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-6) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  // Perform knife slice between (x1, y1) and (x2, y2)
  const performKnifeSlice = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const nodes = nodesRef.current;
      const springs = springsRef.current;
      const sliceLen = Math.hypot(x2 - x1, y2 - y1);
      if (sliceLen < 4) return;

      // Normal vector perpendicular to the knife path
      const nx = -(y2 - y1) / sliceLen;
      const ny = (x2 - x1) / sliceLen;

      let severedCount = 0;
      const remainingSprings: SlimeSpring[] = [];

      for (const s of springs) {
        const na = nodes[s.a];
        const nb = nodes[s.b];
        if (lineSegmentsIntersect(x1, y1, x2, y2, na.x, na.y, nb.x, nb.y)) {
          severedCount++;
          // Push the two severed nodes apart along the blade normal so the cut visually opens up!
          const sideA = (na.x - x1) * nx + (na.y - y1) * ny >= 0 ? 1 : -1;
          na.vx += nx * sideA * 6.5;
          na.vy += ny * sideA * 6.5;
          nb.vx -= nx * sideA * 6.5;
          nb.vy -= ny * sideA * 6.5;
        } else {
          remainingSprings.push(s);
        }
      }

      // Also push any node whose body is directly grazed by the knife
      for (const n of nodes) {
        // Distance from point to segment
        const l2 = sliceLen * sliceLen;
        let t = ((n.x - x1) * (x2 - x1) + (n.y - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        const d = Math.hypot(n.x - projX, n.y - projY);

        if (d < n.radius * 0.95) {
          const side = (n.x - x1) * nx + (n.y - y1) * ny >= 0 ? 1 : -1;
          n.vx += nx * side * 5.2;
          n.vy += ny * side * 5.2;
          severedCount++;
        }
      }

      if (severedCount > 0) {
        springsRef.current = remainingSprings;
        asmrAudio.playKnifeSlice();
        const midX = (x1 + x2) * 0.5;
        const midY = (y1 + y2) * 0.5;
        spawnParticles(midX, midY, 8, 'slime_drop');
        lastNoticeRef.current = 'Đã dùng dao sắc cắt rời liên kết khối chất nhầy!';
      }
    },
    [spawnParticles]
  );

  // React to external triggers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initSlime(canvas.width, canvas.height);
  }, [resetTrigger, initSlime]);

  useEffect(() => {
    if (mergeTrigger > 0) {
      mergeAllBlobs();
    }
  }, [mergeTrigger, mergeAllBlobs]);

  useEffect(() => {
    if (throwCornerTrigger > 0) {
      throwIntoCorner();
    }
  }, [throwCornerTrigger, throwIntoCorner]);

  useEffect(() => {
    if (cleanRoomTrigger > 0) {
      stainsRef.current = [];
      for (const n of nodesRef.current) {
        n.charLevel = 0;
        n.frostLevel = 0;
        n.temperature = 24;
        n.inflation = 1.0;
        n.charge = 0;
      }
      lastNoticeRef.current = 'Đã lau sạch vết bẩn trên tường và làm mới bề mặt slime';
      asmrAudio.playBubblePop(1.2);
    }
  }, [cleanRoomTrigger]);

  // Add toppings / mix-ins into the slime
  useEffect(() => {
    if (!pendingTopping) return;
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const palette: Record<ToppingType, string[]> = {
      floam: ['#F472B6', '#38BDF8', '#A78BFA', '#FBBF24', '#34D399', '#FB7185'],
      glitter: ['#FEF08A', '#E0F2FE', '#F5D0FE', '#FFFFFF'],
      eyes: ['#FFFFFF'],
      boba: ['#27272A', '#3F3F46', '#18181B'],
      gold: ['#FDE047', '#F59E0B', '#FEF9C3'],
    };

    const colors = palette[pendingTopping.type];
    for (let i = 0; i < pendingTopping.count; i++) {
      const nodeIdx = Math.floor(Math.random() * nodes.length);
      itemsRef.current.push({
        id: Date.now() + Math.random(),
        type: pendingTopping.type,
        nodeIndex: nodeIdx,
        offsetX: (Math.random() - 0.5) * 22,
        offsetY: (Math.random() - 0.5) * 22,
        angle: Math.random() * Math.PI * 2,
        angularVel: (Math.random() - 0.5) * 0.04,
        size:
          pendingTopping.type === 'eyes'
            ? 12 + Math.random() * 3
            : pendingTopping.type === 'boba'
            ? 8 + Math.random() * 3
            : 5 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    if (itemsRef.current.length > 120) {
      itemsRef.current.splice(0, itemsRef.current.length - 120);
    }

    asmrAudio.playBubblePop(1.1);
    setTimeout(() => asmrAudio.playSquish(0.5), 45);
    lastNoticeRef.current = `Đã trộn thêm topping vào bên trong khối slime`;
  }, [pendingTopping]);

  // Count connected components (blobs) via BFS
  const countConnectedBlobs = (nodeCount: number, springs: SlimeSpring[]): number => {
    if (nodeCount === 0) return 0;
    const adj: number[][] = Array.from({ length: nodeCount }, () => []);
    for (const s of springs) {
      adj[s.a].push(s.b);
      adj[s.b].push(s.a);
    }
    const visited = new Uint8Array(nodeCount);
    let components = 0;
    for (let i = 0; i < nodeCount; i++) {
      if (!visited[i]) {
        components++;
        const queue = [i];
        visited[i] = 1;
        while (queue.length > 0) {
          const curr = queue.pop()!;
          for (const nxt of adj[curr]) {
            if (!visited[nxt]) {
              visited[nxt] = 1;
              queue.push(nxt);
            }
          }
        }
      }
    }
    // Cap reported visual clusters to realistic macro-blobs
    return Math.min(12, Math.max(1, components));
  };

  // Main Physics + Metaball Shader + Room Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup initial dimensions
    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      } else {
        canvas.width = 920;
        canvas.height = 620;
      }
      if (nodesRef.current.length === 0) {
        initSlime(canvas.width, canvas.height);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Create offscreen canvas for the 3D-shaded Metaball Scalar Field
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenRef.current;
    const FIELD_SCALE = 0.36;

    let animationFrameId: number;

    const renderLoop = () => {
      frameCountRef.current++;
      const W = canvas.width;
      const H = canvas.height;
      const nodes = nodesRef.current;
      const springs = springsRef.current;
      const phys = physicsRef.current;
      const mat = presetRef.current;
      const tool = activeToolRef.current;
      const ptr = pointerRef.current;

      // ---------------------------------------------------------
      // 1. TOOL INTERACTIONS WHILE POINTER IS DOWN OR HOVERING
      // ---------------------------------------------------------
      if (ptr.isDown) {
        if (tool === 'hand') {
          // Move grabbed nodes with spring-like pull so throwing imparts huge momentum!
          for (const g of ptr.grabbedNodes) {
            const n = nodes[g.idx];
            if (!n) continue;
            n.pinnedWall = 'none';
            const targetX = ptr.x + g.dx;
            const targetY = ptr.y + g.dy;
            n.vx = (targetX - n.x) * (0.32 * g.weight) + ptr.vx * 0.45 * g.weight;
            n.vy = (targetY - n.y) * (0.32 * g.weight) + ptr.vy * 0.45 * g.weight;
          }
          if (Math.hypot(ptr.vx, ptr.vy) > 5 && frameCountRef.current % 7 === 0) {
            asmrAudio.playSquish(Math.min(1, Math.hypot(ptr.vx, ptr.vy) / 25));
          }
        } else if (tool === 'lighter') {
          // Emit realistic rising flame particles at lighter nozzle
          const flameX = ptr.x;
          const flameY = ptr.y - 18;
          spawnParticles(flameX, flameY, 3, 'flame');

          let burningAny = false;
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const dist = Math.hypot(n.x - flameX, n.y - (flameY - 12));
            if (dist < 95) {
              burningAny = true;
              const heatFactor = (1 - dist / 95) * 4.2;
              n.temperature = Math.min(320, n.temperature + heatFactor);
              // Thaw frost first
              if (n.frostLevel > 0) {
                n.frostLevel = Math.max(0, n.frostLevel - 0.04);
              }
              // Boil agitation
              if (n.temperature > 85) {
                n.vx += (Math.random() - 0.5) * 2.2;
                n.vy += (Math.random() - 0.5) * 2.2 - 0.6;
              }
              // Char surface black when hot enough
              if (n.temperature > 125) {
                n.charLevel = Math.min(1, n.charLevel + 0.012 * (1 - dist / 95));
                if (Math.random() < 0.18) {
                  spawnParticles(n.x + (Math.random() - 0.5) * 16, n.y - 10, 1, 'smoke');
                }
              }
              // Extreme heat snaps weak springs (melting/popping!)
              if (n.temperature > 240 && Math.random() < 0.03) {
                spawnParticles(n.x, n.y, 4, 'spark');
                asmrAudio.playBubblePop(1.5);
              }
            }
          }
          if (burningAny) {
            asmrAudio.playBurnSizzle(0.9);
            lastNoticeRef.current = 'Đang đốt cháy slime — Bề mặt sôi sùng sục và cháy xém đen!';
          }
        } else if (tool === 'freeze') {
          spawnParticles(ptr.x, ptr.y, 4, 'frost');
          let freezingAny = false;
          for (const n of nodes) {
            const dist = Math.hypot(n.x - ptr.x, n.y - ptr.y);
            if (dist < 100) {
              freezingAny = true;
              n.temperature = Math.max(-196, n.temperature - (1 - dist / 100) * 6.5);
              n.frostLevel = Math.min(1, n.frostLevel + 0.025 * (1 - dist / 100));
              n.vx *= 0.8;
              n.vy *= 0.8;
            }
          }
          if (freezingAny) {
            asmrAudio.playFreezeSpray();
            lastNoticeRef.current = 'Đang xịt Nitơ lỏng (-196°C) — Slime đóng băng cứng và giòn!';
          }
        } else if (tool === 'shock') {
          asmrAudio.playElectricZap();
          if (frameCountRef.current % 2 === 0) {
            spawnParticles(ptr.x, ptr.y, 2, 'spark');
          }
          for (const n of nodes) {
            const dist = Math.hypot(n.x - ptr.x, n.y - ptr.y);
            if (dist < 135) {
              n.charge = Math.min(1, n.charge + 0.08);
              n.vx += (Math.random() - 0.5) * 9;
              n.vy += (Math.random() - 0.5) * 9 - 1.2;
            }
          }
          lastNoticeRef.current = 'Dòng điện cao áp Tesla làm khối slime co giật và phát sáng!';
        } else if (tool === 'pump') {
          let maxInf = 1;
          for (const n of nodes) {
            const dist = Math.hypot(n.x - ptr.x, n.y - ptr.y);
            if (dist < 120) {
              n.inflation += 0.018;
              maxInf = Math.max(maxInf, n.inflation);
              // Push outward from cursor slightly
              const angle = Math.atan2(n.y - ptr.y, n.x - ptr.x);
              n.vx += Math.cos(angle) * 0.6;
              n.vy += Math.sin(angle) * 0.6;
            }
          }
          if (frameCountRef.current % 8 === 0) {
            asmrAudio.playBubblePop(Math.max(0.5, 1.4 - (maxInf - 1) * 0.4));
          }
          lastNoticeRef.current = `Đang bơm phồng khối slime (${Math.round(maxInf * 100)}% thể tích)...`;

          // EXPLODE if pumped beyond limit!
          if (maxInf > 2.35) {
            asmrAudio.playGiantBurst();
            // Sever half the springs and blast nodes into all 4 room corners!
            springsRef.current = springsRef.current.filter(() => Math.random() > 0.55);
            for (const n of nodes) {
              n.inflation = 1.0;
              const ang = Math.atan2(n.y - ptr.y, n.x - ptr.x) + (Math.random() - 0.5) * 0.5;
              const spd = 24 + Math.random() * 18;
              n.vx = Math.cos(ang) * spd;
              n.vy = Math.sin(ang) * spd;
            }
            spawnParticles(ptr.x, ptr.y, 40, 'slime_drop', undefined, 2.4);
            lastNoticeRef.current = 'BÙM! Khối slime quá căng đã nổ tung văng khắp các góc phòng!';
          }
        } else if (tool === 'vortex') {
          for (const n of nodes) {
            n.pinnedWall = 'none';
            const dx = ptr.x - n.x;
            const dy = ptr.y - n.y;
            const dist = Math.max(20, Math.hypot(dx, dy));
            // Centripetal pull + tangential swirl
            n.vx += (dx / dist) * 2.2 - (dy / dist) * 3.4;
            n.vy += (dy / dist) * 2.2 + (dx / dist) * 3.4;
          }
          if (frameCountRef.current % 12 === 0) {
            asmrAudio.playSquish(0.65);
          }
          // Re-link nearby unlinked nodes in the vortex!
          if (frameCountRef.current % 15 === 0 && springsRef.current.length < 320) {
            for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                const d = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
                if (d < 34 && Math.random() < 0.25) {
                  const exists = springsRef.current.some(
                    (s) => (s.a === i && s.b === j) || (s.a === j && s.b === i)
                  );
                  if (!exists) {
                    springsRef.current.push({ a: i, b: j, restLength: 28, stiffness: 0.16 });
                  }
                }
              }
            }
          }
          lastNoticeRef.current = 'Xoáy hút trọng lực đang cuốn và xoắn khối slime giữa không trung!';
        }
      }

      // ---------------------------------------------------------
      // 2. SOFT-BODY SPRING & FLUID COHESION PHYSICS STEP
      // ---------------------------------------------------------
      const stiffnessMult = 0.4 + phys.elasticity * 1.15;
      const damping = 0.96 - phys.viscosity * 0.08;

      // Spring forces
      for (let i = springs.length - 1; i >= 0; i--) {
        const s = springs[i];
        const na = nodes[s.a];
        const nb = nodes[s.b];
        if (!na || !nb) continue;

        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const targetLen = s.restLength * ((na.inflation + nb.inflation) * 0.5);

        // If frozen solid and stretched hard, shatter the link!
        const avgFrost = (na.frostLevel + nb.frostLevel) * 0.5;
        if (avgFrost > 0.65 && dist > targetLen * 1.65) {
          springs.splice(i, 1);
          spawnParticles((na.x + nb.x) * 0.5, (na.y + nb.y) * 0.5, 4, 'ice_shard');
          asmrAudio.playIceShatter();
          continue;
        }

        // If pulled wildly far apart by a violent throw, tear naturally
        if (dist > targetLen * 4.2) {
          springs.splice(i, 1);
          continue;
        }

        const diff = (dist - targetLen) / dist;
        const k = s.stiffness * stiffnessMult * (1 + avgFrost * 1.8);
        const fx = dx * diff * k;
        const fy = dy * diff * k;

        na.vx += fx;
        na.vy += fy;
        nb.vx -= fx;
        nb.vy -= fy;

        // Viscous velocity matching along springs
        const visc = phys.viscosity * 0.09;
        const dvx = (nb.vx - na.vx) * visc;
        const dvy = (nb.vy - na.vy) * visc;
        na.vx += dvx;
        na.vy += dvy;
        nb.vx -= dvx;
        nb.vy -= dvy;
      }

      // Pairwise short-range repulsion & surface tension cohesion
      for (let i = 0; i < nodes.length; i++) {
        const na = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const nb = nodes[j];
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const distSq = dx * dx + dy * dy;
          const minDist = (na.radius + nb.radius) * 0.58;

          if (distSq < minDist * minDist && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const overlap = (minDist - dist) / dist;
            const push = overlap * 0.32;
            na.vx -= dx * push;
            na.vy -= dy * push;
            nb.vx += dx * push;
            nb.vy += dy * push;
          } else if (distSq < 3600 && distSq >= minDist * minDist) {
            // Subtle surface tension rounding
            const dist = Math.sqrt(distSq);
            const pull = phys.surfaceTension * 0.008;
            na.vx += (dx / dist) * pull;
            na.vy += (dy / dist) * pull;
            nb.vx -= (dx / dist) * pull;
            nb.vy -= (dy / dist) * pull;
          }
        }
      }

      // Room boundaries (Floor, Ceiling, Left Wall, Right Wall, and 4 Corners!)
      const wallMargin = 38;
      const floorY = H - 42;
      const ceilingY = 42;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.radius = n.baseRadius * n.inflation * (1 - n.charLevel * 0.18);

        // Cool down temperature gradually toward ambient 24C
        n.temperature += (24 - n.temperature) * 0.005;
        n.charge *= 0.96;

        // Gravity (unless stuck strongly to wall/corner)
        let grav = phys.gravity * 0.42;
        if (n.pinnedWall !== 'none') {
          // Viscous oozing down the wall or corner!
          const slipRate = Math.max(0.02, 1 - phys.wallAdhesion * 0.92);
          n.vx *= 0.65;
          n.vy = n.vy * 0.75 + grav * slipRate * 0.35;
          n.adhesionTimer--;
          if (n.adhesionTimer <= 0 || phys.wallAdhesion < 0.15) {
            n.pinnedWall = 'none';
          }
        } else {
          n.vy += grav;
        }

        n.vx *= damping;
        n.vy *= damping;

        n.x += n.vx;
        n.y += n.vy;

        const speed = Math.hypot(n.vx, n.vy);

        // Check if slammed into one of the 4 Room Corners!
        const inLeft = n.x < wallMargin + 48;
        const inRight = n.x > W - wallMargin - 48;
        const inTop = n.y < ceilingY + 52;
        const inBottom = n.y > floorY - 52;
        const isCornerHit = (inLeft || inRight) && (inTop || inBottom);

        // Left wall collision
        if (n.x < wallMargin) {
          n.x = wallMargin;
          if (speed > 10) {
            // Leave wall stain decal!
            if (Math.random() < 0.35 && stainsRef.current.length < 45) {
              stainsRef.current.push({
                x: wallMargin - 6 + Math.random() * 14,
                y: n.y,
                radiusX: 12 + Math.random() * 16,
                radiusY: 18 + Math.random() * 24,
                color: `rgb(${mat.baseColor.join(',')})`,
                alpha: 0.55,
                dripLength: 0,
                maxDripLength: 35 + Math.random() * 75,
                wall: isCornerHit ? 'corner' : 'left',
              });
            }
            if (n.frostLevel > 0.6) {
              asmrAudio.playIceShatter();
              spawnParticles(n.x, n.y, 3, 'ice_shard');
            } else {
              asmrAudio.playWallSplat(speed / 18, isCornerHit);
            }
          }
          if (phys.wallAdhesion > 0.3 && speed > 4) {
            n.pinnedWall = inTop ? 'corner_tl' : inBottom ? 'corner_bl' : 'left';
            n.adhesionTimer = Math.floor(80 + phys.wallAdhesion * 240);
            n.vx = 0;
            n.vy *= 0.2;
          } else {
            n.vx = -n.vx * (0.3 + phys.elasticity * 0.45);
          }
        }

        // Right wall collision
        if (n.x > W - wallMargin) {
          n.x = W - wallMargin;
          if (speed > 10) {
            if (Math.random() < 0.35 && stainsRef.current.length < 45) {
              stainsRef.current.push({
                x: W - wallMargin - 8 + Math.random() * 14,
                y: n.y,
                radiusX: 12 + Math.random() * 16,
                radiusY: 18 + Math.random() * 24,
                color: `rgb(${mat.baseColor.join(',')})`,
                alpha: 0.55,
                dripLength: 0,
                maxDripLength: 35 + Math.random() * 75,
                wall: isCornerHit ? 'corner' : 'right',
              });
            }
            if (n.frostLevel > 0.6) {
              asmrAudio.playIceShatter();
              spawnParticles(n.x, n.y, 3, 'ice_shard');
            } else {
              asmrAudio.playWallSplat(speed / 18, isCornerHit);
            }
          }
          if (phys.wallAdhesion > 0.3 && speed > 4) {
            n.pinnedWall = inTop ? 'corner_tr' : inBottom ? 'corner_br' : 'right';
            n.adhesionTimer = Math.floor(80 + phys.wallAdhesion * 240);
            n.vx = 0;
            n.vy *= 0.2;
          } else {
            n.vx = -n.vx * (0.3 + phys.elasticity * 0.45);
          }
        }

        // Ceiling collision
        if (n.y < ceilingY) {
          n.y = ceilingY;
          if (speed > 10) {
            asmrAudio.playWallSplat(speed / 18, isCornerHit);
            if (Math.random() < 0.3 && stainsRef.current.length < 45) {
              stainsRef.current.push({
                x: n.x,
                y: ceilingY,
                radiusX: 20 + Math.random() * 20,
                radiusY: 10 + Math.random() * 12,
                color: `rgb(${mat.baseColor.join(',')})`,
                alpha: 0.5,
                dripLength: 0,
                maxDripLength: 45 + Math.random() * 65,
                wall: isCornerHit ? 'corner' : 'back',
              });
            }
          }
          if (phys.wallAdhesion > 0.35 && speed > 5) {
            n.pinnedWall = inLeft ? 'corner_tl' : inRight ? 'corner_tr' : 'ceiling';
            n.adhesionTimer = Math.floor(70 + phys.wallAdhesion * 220);
            n.vy = 0;
            n.vx *= 0.25;
          } else {
            n.vy = -n.vy * (0.3 + phys.elasticity * 0.45);
          }
        }

        // Floor collision
        if (n.y > floorY) {
          n.y = floorY;
          if (speed > 12) {
            asmrAudio.playWallSplat(speed / 20, isCornerHit);
          }
          n.vy = -n.vy * (0.25 + phys.elasticity * 0.45);
          n.vx *= 0.88 - phys.wallAdhesion * 0.25;
        }
      }

      // Decay pointer velocity
      ptr.vx *= 0.6;
      ptr.vy *= 0.6;

      // ---------------------------------------------------------
      // 3. RENDER 3D-PERSPECTIVE ROOM STAGE & CORNERS
      // ---------------------------------------------------------
      const theme = roomThemeRef.current;
      ctx.clearRect(0, 0, W, H);

      // Room inner back wall rectangle for 3D perspective depth
      const innerLeft = Math.floor(W * 0.11);
      const innerRight = Math.floor(W * 0.89);
      const innerTop = Math.floor(H * 0.13);
      const innerBottom = Math.floor(H * 0.82);

      // Wall palette by theme
      const wallColors =
        theme === 'studio'
          ? {
              back: '#131C2E',
              left: '#0F172A',
              right: '#0F172A',
              ceiling: '#1E293B',
              floor: '#0B1120',
              line: 'rgba(148, 163, 184, 0.16)',
              grid: 'rgba(148, 163, 184, 0.05)',
            }
          : theme === 'sunset'
          ? {
              back: '#231528',
              left: '#1B1020',
              right: '#190F1E',
              ceiling: '#2D1A32',
              floor: '#120B16',
              line: 'rgba(251, 146, 60, 0.18)',
              grid: 'rgba(251, 146, 60, 0.05)',
            }
          : {
              back: '#070913',
              left: '#05070F',
              right: '#05070F',
              ceiling: '#090D1A',
              floor: '#03050A',
              line: 'rgba(56, 189, 248, 0.22)',
              grid: 'rgba(168, 85, 247, 0.07)',
            };

      // Ceiling polygon
      ctx.fillStyle = wallColors.ceiling;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(innerRight, innerTop);
      ctx.lineTo(innerLeft, innerTop);
      ctx.closePath();
      ctx.fill();

      // Left Wall polygon
      ctx.fillStyle = wallColors.left;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(innerLeft, innerTop);
      ctx.lineTo(innerLeft, innerBottom);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Right Wall polygon
      ctx.fillStyle = wallColors.right;
      ctx.beginPath();
      ctx.moveTo(W, 0);
      ctx.lineTo(innerRight, innerTop);
      ctx.lineTo(innerRight, innerBottom);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Floor polygon
      ctx.fillStyle = wallColors.floor;
      ctx.beginPath();
      ctx.moveTo(innerLeft, innerBottom);
      ctx.lineTo(innerRight, innerBottom);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Back Wall rectangle
      ctx.fillStyle = wallColors.back;
      ctx.fillRect(innerLeft, innerTop, innerRight - innerLeft, innerBottom - innerTop);

      // Subtle architectural grid on back wall & floor
      ctx.strokeStyle = wallColors.grid;
      ctx.lineWidth = 1;
      const gridStep = 56;
      for (let gx = innerLeft + gridStep; gx < innerRight; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, innerTop);
        ctx.lineTo(gx, innerBottom);
        ctx.stroke();
      }
      for (let gy = innerTop + gridStep; gy < innerBottom; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(innerLeft, gy);
        ctx.lineTo(innerRight, gy);
        ctx.stroke();
      }

      // 3D Room Corner Crease Lines
      ctx.strokeStyle = wallColors.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(innerLeft, innerTop, innerRight - innerLeft, innerBottom - innerTop);

      ctx.beginPath();
      // Top-Left Corner edge
      ctx.moveTo(0, 0);
      ctx.lineTo(innerLeft, innerTop);
      // Top-Right Corner edge
      ctx.moveTo(W, 0);
      ctx.lineTo(innerRight, innerTop);
      // Bottom-Left Corner edge
      ctx.moveTo(0, H);
      ctx.lineTo(innerLeft, innerBottom);
      // Bottom-Right Corner edge
      ctx.moveTo(W, H);
      ctx.lineTo(innerRight, innerBottom);
      ctx.stroke();

      // Corner target subtle indicators when dragging with Hand tool
      if (tool === 'hand' && ptr.isDown) {
        ctx.save();
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillText('↖ Góc Trên Trái', 18, 26);
        ctx.fillText('Góc Trên Phải ↗', W - 110, 26);
        ctx.restore();
      }

      // Render glossy slime wall stains & viscous drips on walls/corners
      for (const st of stainsRef.current) {
        if (st.dripLength < st.maxDripLength) {
          st.dripLength += 0.18 * (1.2 - phys.viscosity * 0.7);
        }
        ctx.save();
        ctx.globalAlpha = st.alpha;
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.ellipse(st.x, st.y, st.radiusX, st.radiusY, 0, 0, Math.PI * 2);
        ctx.fill();

        // Viscous drip streak down the wall
        ctx.beginPath();
        ctx.moveTo(st.x - st.radiusX * 0.45, st.y);
        ctx.lineTo(st.x + st.radiusX * 0.45, st.y);
        ctx.lineTo(st.x + 3.5, st.y + st.dripLength);
        ctx.arc(st.x, st.y + st.dripLength, 3.5, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        // Specular glint on the stain
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(
          st.x - st.radiusX * 0.25,
          st.y - st.radiusY * 0.25,
          st.radiusX * 0.22,
          st.radiusY * 0.28,
          -0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      // Soft floor shadow underneath slime clusters
      if (nodes.length > 0) {
        let avgX = 0;
        let maxY = 0;
        for (const n of nodes) {
          avgX += n.x;
          if (n.y > maxY) maxY = n.y;
        }
        avgX /= nodes.length;
        const shadowGrad = ctx.createRadialGradient(
          avgX,
          floorY + 12,
          10,
          avgX,
          floorY + 12,
          140
        );
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(avgX, floorY + 12, 145, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---------------------------------------------------------
      // 4. 3D-SHADED METABALL SCALAR FIELD + PHONG SPECULAR SHADER
      // ---------------------------------------------------------
      const fw = Math.max(64, Math.floor(W * FIELD_SCALE));
      const fh = Math.max(64, Math.floor(H * FIELD_SCALE));
      if (offCanvas.width !== fw || offCanvas.height !== fh) {
        offCanvas.width = fw;
        offCanvas.height = fh;
      }
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        const imgData = offCtx.createImageData(fw, fh);
        const pixels = imgData.data;
        const totalCells = fw * fh;

        const field = new Float32Array(totalCells);
        const gradX = new Float32Array(totalCells);
        const gradY = new Float32Array(totalCells);
        const charField = new Float32Array(totalCells);
        const frostField = new Float32Array(totalCells);
        const chargeField = new Float32Array(totalCells);

        // Accumulate metaball polynomial field in bounding boxes
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const nx = n.x * FIELD_SCALE;
          const ny = n.y * FIELD_SCALE;
          const nr = n.radius * FIELD_SCALE * 1.68;
          const invR2 = 1 / (nr * nr);

          const minX = Math.max(0, Math.floor(nx - nr));
          const maxX = Math.min(fw - 1, Math.ceil(nx + nr));
          const minY = Math.max(0, Math.floor(ny - nr));
          const maxY = Math.min(fh - 1, Math.ceil(ny + nr));

          for (let py = minY; py <= maxY; py++) {
            const dy = py - ny;
            const dy2 = dy * dy;
            const rowOffset = py * fw;

            for (let px = minX; px <= maxX; px++) {
              const dx = px - nx;
              const r2 = (dx * dx + dy2) * invR2;
              if (r2 < 1.0) {
                const oneMinusR2 = 1.0 - r2;
                const weight = oneMinusR2 * oneMinusR2 * oneMinusR2;
                const deriv = -6.0 * oneMinusR2 * oneMinusR2 * invR2;

                const idx = rowOffset + px;
                field[idx] += weight;
                gradX[idx] += deriv * dx;
                gradY[idx] += deriv * dy;
                charField[idx] += weight * n.charLevel;
                frostField[idx] += weight * n.frostLevel;
                chargeField[idx] += weight * n.charge;
              }
            }
          }
        }

        // Shade every active slime pixel with 3D Normal, Subsurface Scattering, Specular & States
        const threshold = 0.24;
        const [baseR, baseG, baseB] = mat.baseColor;
        const [highR, highG, highB] = mat.highlightColor;
        const [deepR, deepG, deepB] = mat.deepColor;

        // Directional studio light vector (top-left-front)
        const lx = -0.42;
        const ly = -0.58;
        const lz = 0.7;

        for (let idx = 0; idx < totalCells; idx++) {
          const f = field[idx];
          if (f >= threshold) {
            const pIdx = idx * 4;

            // Normalized surface normal from analytical gradient
            const gx = -gradX[idx];
            const gy = -gradY[idx];
            const gLen = Math.hypot(gx, gy);
            const nx = gLen > 0.0001 ? (gx / (gLen + 0.35)) : 0;
            const ny = gLen > 0.0001 ? (gy / (gLen + 0.35)) : 0;
            const nz = Math.sqrt(Math.max(0.08, 1.0 - nx * nx - ny * ny));

            // Normalize state weights
            const invF = 1 / f;
            const charAmt = Math.min(1, charField[idx] * invF);
            const frostAmt = Math.min(1, frostField[idx] * invF);
            const chargeAmt = Math.min(1, chargeField[idx] * invF);

            // Depth / Subsurface scattering factor
            const thickness = Math.min(1, (f - threshold) * 0.75);

            // Diffuse + Subsurface Scattering blend
            const ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);
            const sss = Math.pow(1 - nz, 1.6) * 0.45 + thickness * 0.35;

            let r = deepR * (1 - ndotl * 0.6) + baseR * (ndotl * 0.85 + sss * 0.4);
            let g = deepG * (1 - ndotl * 0.6) + baseG * (ndotl * 0.85 + sss * 0.4);
            let b = deepB * (1 - ndotl * 0.6) + baseB * (ndotl * 0.85 + sss * 0.4);

            // Fresnel rim glow
            const fresnel = Math.pow(1 - nz, 2.6);
            r += highR * fresnel * 0.32;
            g += highG * fresnel * 0.32;
            b += highB * fresnel * 0.32;

            // Blinn-Phong wet specular highlight (dual studio lights)
            const halfX = lx * 0.5;
            const halfY = ly * 0.5;
            const halfZ = (lz + 1.0) * 0.5;
            const hLen = Math.hypot(halfX, halfY, halfZ);
            const ndoth = Math.max(
              0,
              (nx * halfX + ny * halfY + nz * halfZ) / hLen
            );
            const spec1 =
              Math.pow(ndoth, mat.specularPower) *
              mat.specularIntensity *
              (1 - charAmt * 0.85);

            // Secondary crisp rim reflection
            const spec2 =
              Math.pow(Math.max(0, nx * 0.45 - ny * 0.45 + nz * 0.75), 55) *
              0.55 *
              (1 - charAmt * 0.85);

            r += (spec1 + spec2) * 255;
            g += (spec1 + spec2) * 255;
            b += (spec1 + spec2) * 255;

            // Apply Liquid Nitrogen Frost effect (icy crystalline blue-white)
            if (frostAmt > 0.01) {
              const iceFacet = Math.sin(nx * 14 + ny * 14) > 0.3 ? 35 : 0;
              r = r * (1 - frostAmt * 0.8) + (195 + iceFacet) * frostAmt * 0.8;
              g = g * (1 - frostAmt * 0.8) + (235 + iceFacet) * frostAmt * 0.8;
              b = b * (1 - frostAmt * 0.8) + 255 * frostAmt * 0.8;
            }

            // Apply Lighter Burn / Charred Crust effect (caramel -> dark carbon + ember glow)
            if (charAmt > 0.01) {
              const carbonR = charAmt > 0.6 ? 24 : 95;
              const carbonG = charAmt > 0.6 ? 20 : 42;
              const carbonB = charAmt > 0.6 ? 18 : 14;
              r = r * (1 - charAmt) + carbonR * charAmt;
              g = g * (1 - charAmt) + carbonG * charAmt;
              b = b * (1 - charAmt) + carbonB * charAmt;
            }

            // Apply Tesla Electric Shock glow
            if (chargeAmt > 0.05) {
              r += 90 * chargeAmt;
              g += 200 * chargeAmt;
              b += 255 * chargeAmt;
            }

            // Smooth anti-aliased edge alpha
            const edgeSmooth = Math.min(1, (f - threshold) / 0.08);
            const alpha = Math.min(255, Math.floor(edgeSmooth * (mat.opacity * 255)));

            pixels[pIdx] = Math.min(255, Math.max(0, r));
            pixels[pIdx + 1] = Math.min(255, Math.max(0, g));
            pixels[pIdx + 2] = Math.min(255, Math.max(0, b));
            pixels[pIdx + 3] = alpha;
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        // Draw the 3D-shaded metaball slime onto main canvas
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (theme === 'uv_dark' || mat.glowIntensity > 0.4) {
          ctx.shadowColor = `rgba(${mat.baseColor.join(',')}, ${mat.glowIntensity})`;
          ctx.shadowBlur = theme === 'uv_dark' ? 32 : 16;
        }
        ctx.drawImage(offCanvas, 0, 0, W, H);
        ctx.restore();
      }

      // ---------------------------------------------------------
      // 5. INTERNAL AIR BUBBLES & MIX-IN TOPPINGS (FLOAM, GLITTER, GOOGLY EYES)
      // ---------------------------------------------------------
      // Internal translucent air bubbles
      ctx.save();
      for (const b of bubblesRef.current) {
        const host = nodes[b.nodeIdx];
        if (!host) continue;
        const bx = host.x + b.ox + Math.sin(frameCountRef.current * 0.04 + b.phase) * 2.5;
        const by = host.y + b.oy + Math.cos(frameCountRef.current * 0.04 + b.phase) * 2.5;
        const br = b.r * host.inflation * (host.temperature > 85 ? 1.45 : 1);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Internal mix-in items (Googly eyes, Floam beads, Glitter, Boba, Gold leaf)
      ctx.save();
      for (const item of itemsRef.current) {
        const host = nodes[item.nodeIndex];
        if (!host) continue;
        const ix = host.x + item.offsetX;
        const iy = host.y + item.offsetY;
        item.angle += item.angularVel + (host.vx - host.vy) * 0.008;

        if (item.type === 'eyes') {
          // Cute Googly Eye that tracks pointer or jiggles on impact!
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ix, iy, item.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pupil looks toward cursor
          const lookAng = Math.atan2(ptr.y - iy, ptr.x - ix);
          const pupilDist = Math.min(item.size * 0.38, Math.hypot(ptr.x - ix, ptr.y - iy) * 0.05);
          const px = ix + Math.cos(lookAng) * pupilDist;
          const py = iy + Math.sin(lookAng) * pupilDist;

          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(px, py, item.size * 0.46, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px - 2, py - 2, item.size * 0.16, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'floam') {
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(ix, iy, item.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(ix - item.size * 0.3, iy - item.size * 0.3, item.size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'boba') {
          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(ix, iy, item.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(ix - 2.5, iy - 2.5, item.size * 0.28, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'glitter' || item.type === 'gold') {
          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(item.angle);
          ctx.fillStyle = item.color;
          ctx.beginPath();
          // 4-point sparkle diamond
          const s = item.size;
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.35, -s * 0.35);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.35, s * 0.35);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.35, s * 0.35);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.35, -s * 0.35);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // ---------------------------------------------------------
      // 6. FX PARTICLES (FLAMES, SMOKE, SPARKS, FROST, SLIME DROPS)
      // ---------------------------------------------------------
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        if (p.life >= p.maxLife) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === 'slime_drop' || p.type === 'ice_shard') {
          p.vy += 0.35;
        }
        const progress = p.life / p.maxLife;
        p.alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const r =
          p.type === 'smoke'
            ? p.size * (0.7 + progress * 1.1)
            : p.size * (1 - progress * 0.5);
        ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ---------------------------------------------------------
      // 7. ACTIVE TOOL VISUAL OVERLAYS (KNIFE BLADE, LIGHTER, TESLA ARCS)
      // ---------------------------------------------------------
      // Knife slash trail
      if (ptr.slicePath.length > 1) {
        const now = performance.now();
        ptr.slicePath = ptr.slicePath.filter((pt) => now - pt.time < 220);
        if (ptr.slicePath.length > 1) {
          ctx.save();
          ctx.strokeStyle = '#E2E8F0';
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 12;
          ctx.lineCap = 'round';
          for (let i = 1; i < ptr.slicePath.length; i++) {
            const p0 = ptr.slicePath[i - 1];
            const p1 = ptr.slicePath[i];
            ctx.lineWidth = (i / ptr.slicePath.length) * 5;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Draw interactive tool instrument at cursor position
      ctx.save();
      if (tool === 'knife') {
        // Gleaming Chef Knife at cursor
        ctx.translate(ptr.x, ptr.y);
        const angle = ptr.isDown ? -0.65 : -0.35;
        ctx.rotate(angle);
        // Blade
        ctx.fillStyle = '#F1F5F9';
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-42, 0);
        ctx.lineTo(14, -12);
        ctx.lineTo(14, 4);
        ctx.quadraticCurveTo(-18, 6, -42, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Handle
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(14, -10, 26, 10);
      } else if (tool === 'lighter') {
        // Metallic Zippo Lighter + Pilot Flame
        ctx.translate(ptr.x, ptr.y);
        // Dynamic warm glow on room when lighter is active
        const glowGrad = ctx.createRadialGradient(0, -24, 4, 0, -24, ptr.isDown ? 150 : 65);
        glowGrad.addColorStop(0, ptr.isDown ? 'rgba(251, 146, 60, 0.45)' : 'rgba(251, 146, 60, 0.2)');
        glowGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, -24, ptr.isDown ? 150 : 65, 0, Math.PI * 2);
        ctx.fill();

        // Pilot flame
        const flicker = Math.sin(frameCountRef.current * 0.6) * 3;
        const flameH = ptr.isDown ? 38 + flicker : 18 + flicker * 0.5;
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.moveTo(-8, -10);
        ctx.quadraticCurveTo(0, -10 - flameH, 8, -10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(-4, -10);
        ctx.quadraticCurveTo(0, -10 - flameH * 0.65, 4, -10);
        ctx.closePath();
        ctx.fill();

        // Lighter metallic body
        ctx.fillStyle = '#94A3B8';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-11, -10, 22, 30);
        ctx.strokeRect(-11, -10, 22, 30);
      } else if (tool === 'shock' && ptr.isDown) {
        // Draw branching lightning bolts from cursor to closest slime nodes
        ctx.strokeStyle = '#7DD3FC';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        for (let b = 0; b < 3; b++) {
          const target = nodes[Math.floor(Math.random() * nodes.length)];
          if (!target) continue;
          if (Math.hypot(target.x - ptr.x, target.y - ptr.y) < 160) {
            ctx.beginPath();
            ctx.moveTo(ptr.x, ptr.y);
            const mid1X = (ptr.x + target.x) * 0.5 + (Math.random() - 0.5) * 28;
            const mid1Y = (ptr.y + target.y) * 0.5 + (Math.random() - 0.5) * 28;
            ctx.lineTo(mid1X, mid1Y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // ---------------------------------------------------------
      // 8. UPDATE TELEMETRY EVERY 12 FRAMES
      // ---------------------------------------------------------
      if (frameCountRef.current % 12 === 0 && nodes.length > 0) {
        let sumTemp = 0;
        let sumChar = 0;
        let sumFrost = 0;
        let pinnedCount = 0;

        for (const n of nodes) {
          sumTemp += n.temperature;
          sumChar += n.charLevel;
          sumFrost += n.frostLevel;
          if (n.pinnedWall !== 'none') pinnedCount++;
        }

        const avgTemp = Math.round(sumTemp / nodes.length);
        const burnPct = Math.round((sumChar / nodes.length) * 100);
        const frostPct = Math.round((sumFrost / nodes.length) * 100);
        const blobs = countConnectedBlobs(nodes.length, springs);

        let stateLabel = 'Đàn hồi tự nhiên';
        if (burnPct > 25) stateLabel = 'Cháy xém & Sôi';
        else if (frostPct > 30) stateLabel = 'Đóng băng tinh thể';
        else if (pinnedCount > 8) stateLabel = 'Đang bám góc tường';
        else if (blobs > 1) stateLabel = `Đã tách thành ${blobs} khối`;

        onTelemetryUpdate({
          blobCount: blobs,
          avgTemperature: avgTemp,
          burnPercentage: burnPct,
          frostPercentage: frostPct,
          activeStains: stainsRef.current.length,
          stateLabel,
          lastActionNotice: lastNoticeRef.current,
        });
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
    };
  }, [initSlime, onTelemetryUpdate, spawnParticles]);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const ptr = pointerRef.current;
    ptr.x = x;
    ptr.y = y;
    ptr.prevX = x;
    ptr.prevY = y;
    ptr.vx = 0;
    ptr.vy = 0;
    ptr.isDown = true;

    const nodes = nodesRef.current;
    const tool = activeToolRef.current;

    if (tool === 'hand') {
      // Grab nodes within reach
      const grabbed: { idx: number; weight: number; dx: number; dy: number }[] = [];
      const grabRadius = 92;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - x, nodes[i].y - y);
        if (d < grabRadius) {
          grabbed.push({
            idx: i,
            weight: Math.pow(1 - d / grabRadius, 0.6),
            dx: (nodes[i].x - x) * 0.55,
            dy: (nodes[i].y - y) * 0.55,
          });
        }
      }
      // If clicked slightly outside, grab closest cluster so it always responds immediately
      if (grabbed.length === 0 && nodes.length > 0) {
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          const d = Math.hypot(nodes[i].x - x, nodes[i].y - y);
          if (d < minDist) {
            minDist = d;
            closestIdx = i;
          }
        }
        const anchor = nodes[closestIdx];
        for (let i = 0; i < nodes.length; i++) {
          const d = Math.hypot(nodes[i].x - anchor.x, nodes[i].y - anchor.y);
          if (d < 75) {
            grabbed.push({
              idx: i,
              weight: 0.85,
              dx: nodes[i].x - anchor.x,
              dy: nodes[i].y - anchor.y,
            });
          }
        }
      }
      ptr.grabbedNodes = grabbed;
      asmrAudio.playSquish(0.65);
    } else if (tool === 'knife') {
      ptr.slicePath = [{ x, y, time: performance.now() }];
    } else if (tool === 'hammer') {
      // Immediate hydraulic smash!
      asmrAudio.playGiantBurst();
      spawnParticles(x, y, 24, 'slime_drop', undefined, 2.0);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = n.x - x;
        const dy = n.y - y;
        const dist = Math.max(12, Math.hypot(dx, dy));
        if (dist < 150) {
          // If frozen, shatter springs!
          if (n.frostLevel > 0.5) {
            springsRef.current = springsRef.current.filter(
              (s) => s.a !== i && s.b !== i
            );
            spawnParticles(n.x, n.y, 4, 'ice_shard');
            asmrAudio.playIceShatter();
          }
          // Flatten horizontally & slam down
          n.vx += (dx / dist) * 22;
          n.vy += 18;
        }
      }
      lastNoticeRef.current = 'Búa thủy lực đập dẹp khối slime văng tung tóe!';
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const ptr = pointerRef.current;
    ptr.prevX = ptr.x;
    ptr.prevY = ptr.y;
    ptr.vx = x - ptr.x;
    ptr.vy = y - ptr.y;
    ptr.x = x;
    ptr.y = y;

    if (ptr.isDown && activeToolRef.current === 'knife') {
      ptr.slicePath.push({ x, y, time: performance.now() });
      performKnifeSlice(ptr.prevX, ptr.prevY, x, y);
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    const ptr = pointerRef.current;
    if (ptr.isDown && activeToolRef.current === 'hand' && ptr.grabbedNodes.length > 0) {
      // Impart final throw velocity when user flings the slime toward a corner/wall!
      const throwSpeed = Math.hypot(ptr.vx, ptr.vy);
      if (throwSpeed > 8) {
        for (const g of ptr.grabbedNodes) {
          const n = nodesRef.current[g.idx];
          if (n) {
            n.vx = ptr.vx * 1.45;
            n.vy = ptr.vy * 1.45;
          }
        }
        lastNoticeRef.current = 'Đã vung tay ném mạnh khối slime bay vào tường phòng!';
      }
    }
    ptr.isDown = false;
    ptr.grabbedNodes = [];
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="w-full h-full block touch-none cursor-crosshair select-none"
    />
  );
};
