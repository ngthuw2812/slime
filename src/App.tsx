import React, { useState, useCallback } from 'react';
import {
  Hand,
  Scissors,
  Flame,
  Snowflake,
  Zap,
  Wind,
  Hammer,
  Orbit,
  Volume2,
  VolumeX,
  RotateCcw,
  CornerUpRight,
  Sparkles,
  Sliders,
  Layers,
  Combine,
  Eraser,
} from 'lucide-react';
import {
  ToolId,
  ToppingType,
  RoomThemeId,
  SlimeMaterialPreset,
  PhysicsSettings,
  SimulationTelemetry,
  SLIME_PRESETS,
} from './types/slime';
import { SlimeRoomCanvas } from './components/SlimeRoomCanvas';
import { asmrAudio } from './audio/asmrAudio';

interface ToolOption {
  id: ToolId;
  label: string;
  shortHint: string;
  icon: React.FC<{ className?: string }>;
}

const TOOLS: ToolOption[] = [
  {
    id: 'hand',
    label: 'Tay Nhào & Ném',
    shortHint: 'Nắm kéo giãn, nhào nặn hoặc vung chuột ném mạnh vào góc phòng',
    icon: Hand,
  },
  {
    id: 'knife',
    label: 'Dao Sắc Cắt Đôi',
    shortHint: 'Giữ và quẹt lưỡi dao xuyên qua slime để cắt tách thành nhiều mảnh',
    icon: Scissors,
  },
  {
    id: 'lighter',
    label: 'Bật Lửa Đốt Cháy',
    shortHint: 'Đốt nóng làm slime sôi sùng sục, bốc khói và cháy xém đen bề mặt',
    icon: Flame,
  },
  {
    id: 'freeze',
    label: 'Xịt Nitơ Đóng Băng',
    shortHint: 'Đóng băng -196°C làm slime hóa tinh thể băng cứng, đập là vỡ',
    icon: Snowflake,
  },
  {
    id: 'shock',
    label: 'Súng Điện Cao Áp',
    shortHint: 'Phóng hồ quang điện Tesla làm khối slime co giật và phát quang',
    icon: Zap,
  },
  {
    id: 'pump',
    label: 'Bơm Phồng Nổ Tung',
    shortHint: 'Bơm khí vào slime cho đến khi căng phồng cực đại và nổ văng khắp phòng',
    icon: Wind,
  },
  {
    id: 'hammer',
    label: 'Búa Đập Thủy Lực',
    shortHint: 'Đập dẹp bánh kếp hoặc đập vỡ tan tành khối slime đang đóng băng',
    icon: Hammer,
  },
  {
    id: 'vortex',
    label: 'Xoáy Hút Hợp Nhất',
    shortHint: 'Tạo lốc xoáy cuốn các mảnh slime rời nhau bay lên và tự hàn gắn lại',
    icon: Orbit,
  },
];

const TOPPINGS: { id: ToppingType; label: string; desc: string; count: number }[] = [
  { id: 'floam', label: 'Hạt Xốp Floam', desc: 'Hạt xốp pastel giòn vui mắt', count: 14 },
  { id: 'glitter', label: 'Kim Tuyến Sao', desc: 'Hạt lấp lánh phản chiếu ánh sáng', count: 16 },
  { id: 'eyes', label: 'Mắt Quái Vật', desc: 'Đôi mắt liếc nhìn theo con trỏ chuột', count: 2 },
  { id: 'boba', label: 'Trân Châu Đen', desc: 'Hạt trân châu dẻo dai bên trong thạch', count: 10 },
  { id: 'gold', label: 'Vàng Lá 24K', desc: 'Vảy vàng kim loại sang trọng', count: 12 },
];

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('hand');
  const [selectedPreset, setSelectedPreset] = useState<SlimeMaterialPreset>(SLIME_PRESETS[0]);
  const [roomTheme, setRoomTheme] = useState<RoomThemeId>('studio');
  const [activeRightTab, setActiveRightTab] = useState<'materials' | 'physics' | 'Archive'>('materials');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [physics, setPhysics] = useState<PhysicsSettings>({
    viscosity: SLIME_PRESETS[0].defaultViscosity,
    elasticity: SLIME_PRESETS[0].defaultElasticity,
    wallAdhesion: SLIME_PRESETS[0].defaultAdhesion,
    gravity: 1.0,
    surfaceTension: 0.65,
  });

  // Action triggers for Canvas
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [mergeTrigger, setMergeTrigger] = useState<number>(0);
  const [throwCornerTrigger, setThrowCornerTrigger] = useState<number>(0);
  const [cleanRoomTrigger, setCleanRoomTrigger] = useState<number>(0);
  const [pendingTopping, setPendingTopping] = useState<{
    type: ToppingType;
    count: number;
    seq: number;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<SimulationTelemetry>({
    blobCount: 1,
    avgTemperature: 24,
    burnPercentage: 0,
    frostPercentage: 0,
    activeStains: 0,
    stateLabel: 'Đàn hồi tự nhiên',
    lastActionNotice: 'Nắm kéo khối chất nhầy, dùng dao cắt đôi hoặc bật lửa đốt cháy',
  });

  const handleTelemetryUpdate = useCallback((next: SimulationTelemetry) => {
    setTelemetry(next);
  }, []);

  const handleSelectPreset = (preset: SlimeMaterialPreset) => {
    setSelectedPreset(preset);
    setPhysics((prev) => ({
      ...prev,
      viscosity: preset.defaultViscosity,
      elasticity: preset.defaultElasticity,
      wallAdhesion: preset.defaultAdhesion,
    }));
    asmrAudio.playSquish(0.75);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    asmrAudio.enabled = next;
    if (next) {
      asmrAudio.playBubblePop(1.1);
    }
  };

  const handleDropTopping = (type: ToppingType, count: number) => {
    setPendingTopping({ type, count, seq: Date.now() });
  };

  const currentToolObj = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Single Row, 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-[#0B0F17]/95 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#stage"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          ViskoLab
        </a>

        {/* Zone 2: 4 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#stage"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Phòng Thí Nghiệm
          </a>
          <a
            href="#tools-dock"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Bộ Công Cụ Tương Tác
          </a>
          <a
            href="#control-deck"
            onClick={() => setActiveRightTab('materials')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Chất Liệu & Topping
          </a>
          <a
            href="#control-deck"
            onClick={() => setActiveRightTab('physics')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Thông Số Vật Lý
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setResetTrigger((v) => v + 1)}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Khôi Phục Khối Slime
          </button>
        </div>
      </header>

      {/* Main Two-Zone Interactive Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / MAIN ZONE: 3D-Perspective Room & Soft-Body Slime Stage (8 cols) */}
        <section id="stage" className="lg:col-span-8 flex flex-col gap-4">
          {/* Unobtrusive Stage Header & Quick Room Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] border border-slate-800/90 rounded-xl px-4 py-3">
            {/* Unboxed Metadata with typographic separators (Zero-Pill Discipline) */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
              <span className="font-semibold text-sky-400">{telemetry.stateLabel}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Số khối: {telemetry.blobCount}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Nhiệt độ: {telemetry.avgTemperature}°C</span>
              {telemetry.burnPercentage > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-amber-400">Độ cháy xém: {telemetry.burnPercentage}%</span>
                </>
              )}
              {telemetry.frostPercentage > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-cyan-300">Đóng băng: {telemetry.frostPercentage}%</span>
                </>
              )}
            </div>

            {/* Quick Physical Room Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setThrowCornerTrigger((v) => v + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Phóng mạnh khối slime bay vào góc tường trong phòng"
              >
                <CornerUpRight className="w-3.5 h-3.5 text-sky-400" />
                <span>Ném Vào Góc Phòng</span>
              </button>

              <button
                onClick={() => setMergeTrigger((v) => v + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Hợp nhất các mảnh slime đã bị cắt rời thành một khối"
              >
                <Combine className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gộp Khối Đã Cắt</span>
              </button>

              <button
                onClick={() => setCleanRoomTrigger((v) => v + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Lau sạch vết slime bám trên góc tường và xóa vết cháy đen"
              >
                <Eraser className="w-3.5 h-3.5 text-amber-400" />
                <span>Làm Sạch Tường</span>
              </button>

              <button
                onClick={handleToggleSound}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  soundEnabled
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>{soundEnabled ? 'ASMR: Bật' : 'ASMR: Tắt'}</span>
              </button>
            </div>
          </div>

          {/* Interactive 3D Room Canvas Container */}
          <div className="relative w-full h-[500px] sm:h-[560px] bg-[#090D16] border border-slate-800/90 rounded-2xl overflow-hidden">
            <SlimeRoomCanvas
              activeTool={activeTool}
              preset={selectedPreset}
              physics={physics}
              roomTheme={roomTheme}
              resetTrigger={resetTrigger}
              mergeTrigger={mergeTrigger}
              throwCornerTrigger={throwCornerTrigger}
              cleanRoomTrigger={cleanRoomTrigger}
              pendingTopping={pendingTopping}
              onTelemetryUpdate={handleTelemetryUpdate}
            />

            {/* Quiet Top-Left Live Guidance Overlay */}
            <div className="pointer-events-none absolute top-3.5 left-4 right-4 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-300/90 bg-slate-950/75 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800/80">
                <strong className="text-white font-semibold">{currentToolObj.label}:</strong>{' '}
                {currentToolObj.shortHint}
              </p>

              {/* Lighting Environment Segmented Control (pointer-events-auto) */}
              <div className="pointer-events-auto hidden sm:flex items-center gap-1 p-1 bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 rounded-lg">
                {(
                  [
                    { id: 'studio', label: 'Phòng Sáng' },
                    { id: 'sunset', label: 'Hoàng Hôn' },
                    { id: 'uv_dark', label: 'Đèn Tím UV' },
                  ] as { id: RoomThemeId; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setRoomTheme(t.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      roomTheme === t.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiet Bottom Action Feedback Bar */}
            <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-400">
              <span className="bg-slate-950/75 px-3 py-1 rounded-md border border-slate-800/60">
                {telemetry.lastActionNotice}
              </span>
              <span className="hidden sm:inline bg-slate-950/75 px-2.5 py-1 rounded-md border border-slate-800/60 font-mono tabular-nums">
                Chất liệu: {selectedPreset.name}
              </span>
            </div>
          </div>

          {/* 8 Interactive Tools Dock */}
          <div
            id="tools-dock"
            className="bg-[#111827] border border-slate-800/90 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-semibold text-slate-300">
                Bộ Dụng Cụ Tương Tác Trực Tiếp (Chọn dụng cụ rồi thao tác lên khối Slime)
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Hỗ trợ kéo chuột & cảm ứng đa điểm
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id);
                      asmrAudio.playBubblePop(1.0);
                    }}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 border border-slate-800/80'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-slate-950' : 'text-sky-400'
                      }`}
                    />
                    <span className="text-xs whitespace-nowrap shrink-0 truncate">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT ZONE: Control, Material & Rheology Deck (4 cols) */}
        <aside
          id="control-deck"
          className="lg:col-span-4 bg-[#111827] border border-slate-800/90 rounded-2xl p-5 flex flex-col gap-5"
        >
          {/* Segmented Control Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setActiveRightTab('materials')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRightTab === 'materials'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Chất Liệu</span>
            </button>
            <button
              onClick={() => setActiveRightTab('physics')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRightTab === 'physics'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Vật Lý</span>
            </button>
            <button
              onClick={() => setActiveRightTab('Archive')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRightTab === 'Archive'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Thí Nghiệm</span>
            </button>
          </div>

          {/* TAB 1: SLIME MATERIALS & MIX-IN TOPPINGS */}
          {activeRightTab === 'materials' && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">
                  01. Chọn Công Thức Chất Nhầy
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Mỗi công thức có độ bóng phản quang, độ nhớt và độ bám dính góc tường riêng biệt.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {SLIME_PRESETS.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-800/95 border-sky-400/70'
                            : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg shrink-0 border border-white/20 shadow-inner"
                            style={{
                              background: `radial-gradient(circle at 30% 30%, rgb(${preset.highlightColor.join(
                                ','
                              )}), rgb(${preset.baseColor.join(',')}), rgb(${preset.deepColor.join(
                                ','
                              )}))`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {preset.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {preset.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400 shrink-0">
                          {isSelected ? 'Đang dùng' : 'Chọn'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <h2 className="text-sm font-semibold text-white mb-1">
                  02. Rắc Thêm Topping Vào Slime
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Topping nằm lơ lửng bên trong khối thạch và sẽ tự tách theo từng phần khi bạn dùng dao cắt đôi.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {TOPPINGS.map((top) => (
                    <button
                      key={top.id}
                      onClick={() => handleDropTopping(top.id, top.count)}
                      className="flex flex-col items-start p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-sky-300 whitespace-nowrap">
                        + {top.label}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {top.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REAL-TIME RHEOLOGY & PHYSICS SLIDERS */}
          {activeRightTab === 'physics' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">
                  Thông Số Lưu Biến & Vật Lý Mềm
                </h2>
                <p className="text-xs text-slate-400">
                  Điều chỉnh trực tiếp cấu trúc liên kết lò xo chất lỏng và lực bám tường.
                </p>
              </div>

              {/* Viscosity Slider */}
              <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="slider-viscosity" className="font-medium text-slate-200">
                    Độ Nhớt Đặc (Viscosity)
                  </label>
                  <span className="font-mono tabular-nums text-sky-400">
                    {Math.round(physics.viscosity * 100)}%
                  </span>
                </div>
                <input
                  id="slider-viscosity"
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.02}
                  value={physics.viscosity}
                  onChange={(e) =>
                    setPhysics((p) => ({ ...p, viscosity: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Lỏng như nước</span>
                  <span>Đặc quánh như mạch nha</span>
                </div>
              </div>

              {/* Elasticity Slider */}
              <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="slider-elasticity" className="font-medium text-slate-200">
                    Độ Đàn Hồi Nảy (Elasticity)
                  </label>
                  <span className="font-mono tabular-nums text-sky-400">
                    {Math.round(physics.elasticity * 100)}%
                  </span>
                </div>
                <input
                  id="slider-elasticity"
                  type="range"
                  min={0.15}
                  max={1.0}
                  step={0.02}
                  value={physics.elasticity}
                  onChange={(e) =>
                    setPhysics((p) => ({ ...p, elasticity: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Mềm nhão bột nặn</span>
                  <span>Nảy tưng tưng như thạch</span>
                </div>
              </div>

              {/* Wall Adhesion Slider */}
              <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="slider-adhesion" className="font-medium text-slate-200">
                    Độ Bám Dính Góc Tường (Adhesion)
                  </label>
                  <span className="font-mono tabular-nums text-sky-400">
                    {Math.round(physics.wallAdhesion * 100)}%
                  </span>
                </div>
                <input
                  id="slider-adhesion"
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.02}
                  value={physics.wallAdhesion}
                  onChange={(e) =>
                    setPhysics((p) => ({ ...p, wallAdhesion: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Nảy bật khỏi tường</span>
                  <span>Dính chặt & chảy xệ từ góc tường</span>
                </div>
              </div>

              {/* Gravity Slider & Presets */}
              <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="slider-gravity" className="font-medium text-slate-200">
                    Trọng Lực Phòng (Gravity)
                  </label>
                  <span className="font-mono tabular-nums text-sky-400">
                    {physics.gravity.toFixed(2)} G
                  </span>
                </div>
                <input
                  id="slider-gravity"
                  type="range"
                  min={-0.3}
                  max={1.5}
                  step={0.05}
                  value={physics.gravity}
                  onChange={(e) =>
                    setPhysics((p) => ({ ...p, gravity: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  <button
                    onClick={() => setPhysics((p) => ({ ...p, gravity: 0 }))}
                    className="py-1.5 px-2 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    Không Trọng Lực
                  </button>
                  <button
                    onClick={() => setPhysics((p) => ({ ...p, gravity: 1.0 }))}
                    className="py-1.5 px-2 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    Trái Đất (1G)
                  </button>
                  <button
                    onClick={() => setPhysics((p) => ({ ...p, gravity: -0.25 }))}
                    className="py-1.5 px-2 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    Bay Lên Trần
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CURATED INTERACTIVE EXPERIMENTS & GUIDE */}
          {activeRightTab === 'Archive' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">
                  Kịch Bản Thư Giãn & Giải Tỏa Căng Thẳng
                </h2>
                <p className="text-xs text-slate-400">
                  Kích hoạt nhanh các tương tác vật lý thú vị nhất trong phòng thí nghiệm.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setActiveTool('knife');
                    asmrAudio.playKnifeSlice();
                  }}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-sky-400 mb-0.5">
                    01. Thử Thách Dao Sắc Cắt Đôi Khối Thạch
                  </div>
                  <p className="text-xs text-slate-300">
                    Chuyển sang Dao Sắc — Kéo một đường dứt khoát từ trên xuống qua giữa khối slime để tách đôi thành 2 khối độc lập.
                  </p>
                </button>

                <button
                  onClick={() => {
                    setActiveTool('lighter');
                    asmrAudio.playBurnSizzle(0.9);
                  }}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-amber-400 mb-0.5">
                    02. Bật Lửa Zippo Đốt Sôi & Cháy Xém
                  </div>
                  <p className="text-xs text-slate-300">
                    Chuyển sang Bật Lửa — Giữ ngọn lửa dưới đáy khối slime để nghe tiếng xèo xèo ASMR, bong bóng sôi và lớp vỏ chuyển màu đen cháy xém.
                  </p>
                </button>

                <button
                  onClick={() => {
                    setPhysics((p) => ({ ...p, wallAdhesion: 0.92 }));
                    setThrowCornerTrigger((v) => v + 1);
                  }}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-emerald-400 mb-0.5">
                    03. Ném Dính Chặt Vào Góc Phòng & Chảy Xệ
                  </div>
                  <p className="text-xs text-slate-300">
                    Tăng độ dính tường lên 92% và ném mạnh slime vào góc tường. Quan sát khối chất nhầy bẹp vào góc và từ từ chảy nhỏ giọt xuống sàn.
                  </p>
                </button>

                <button
                  onClick={() => {
                    setActiveTool('freeze');
                    asmrAudio.playFreezeSpray();
                  }}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-cyan-300 mb-0.5">
                    04. Đóng Băng Nitơ Lỏng Rồi Đập Vỡ Vụn
                  </div>
                  <p className="text-xs text-slate-300">
                    Dùng bình xịt Nitơ đóng băng trắng xóa khối slime, sau đó chọn Búa Đập Thủy Lực giáng xuống để làm vỡ vụn thành từng mảnh băng!
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Reset & Clean Footer inside Control Deck */}
          <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setResetTrigger((v) => v + 1);
                setCleanRoomTrigger((v) => v + 1);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tạo Lại Khối Slime Nguyên Bản</span>
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
