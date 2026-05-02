import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Upload, Plus, Trash2, Maximize, Minimize, MousePointerClick, X, Clock, LayoutGrid, Crosshair, Sparkles, Download } from 'lucide-react';
import JSZip from 'jszip';
import PhoneMockup from './components/PhoneMockup';

interface Scene {
  id: string;
  title: string;
  titleFont: string;
  titleWeight: string;
  titleColor: string;
  sub: string;
  subFont: string;
  subWeight: string;
  subColor: string;
  image: string | null;
  showTouch: boolean;
  touchX: number;
  touchY: number;
  duration: number;
}

// --- ANIMATION UTILITIES ---
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const linear = (t: number) => t;

const interpolate = (frame: number, input: number[], output: number[], easing: (t: number) => number = linear) => {
  if (!input || input.length === 0) return output[0] || 0;
  if (frame <= input[0]) return output[0];
  if (frame >= input[input.length - 1]) return output[output.length - 1];

  for (let i = 1; i < input.length; i++) {
    if (frame <= input[i]) {
      const progress = (frame - input[i - 1]) / (input[i] - input[i - 1]);
      const easedProgress = easing(progress);
      return output[i - 1] + easedProgress * (output[i] - output[i - 1]);
    }
  }
  return output[output.length - 1];
};

export default function ProgrammaticVideoGuide() {
  const FPS = 30;

  // --- STORAGE UTILITIES ---
  const STORAGE_KEY = 'programmatic_video_studio_save';

  const getSavedData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load saved data", e);
      return null;
    }
  };

  const savedData = getSavedData();

  // Project Level Settings
  const [logo, setLogo] = useState<string | null>(savedData?.logo || null);
  const [logoX, setLogoX] = useState<number>(savedData?.logoX ?? 10);
  const [logoY, setLogoY] = useState<number>(savedData?.logoY ?? 10);
  const [logoSize, setLogoSize] = useState<number>(savedData?.logoSize ?? 120);
  const [logoOpacity, setLogoOpacity] = useState<number>(savedData?.logoOpacity ?? 100);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [enableSpecialAnimation, setEnableSpecialAnimation] = useState(savedData?.enableSpecialAnimation ?? false);

  // Dynamic state for scenes
  const [scenes, setScenes] = useState<Scene[]>(savedData?.scenes || [
    {
      id: crypto.randomUUID(),
      title: "Welcome to SofizPay",
      titleFont: "Roboto",
      titleWeight: "extrabold",
      titleColor: "#ffffff",
      sub: "The premier digital wallet & payment gateway.",
      subFont: "Roboto",
      subWeight: "normal",
      subColor: "#bfdbfe",
      image: null,
      showTouch: false,
      touchX: 50,
      touchY: 50,
      duration: 4
    },
    {
      id: crypto.randomUUID(),
      title: "Seamless Checkout",
      titleFont: "Roboto",
      titleWeight: "extrabold",
      titleColor: "#ffffff",
      sub: "Upload a screenshot of your checkout flow.",
      subFont: "Roboto",
      subWeight: "normal",
      subColor: "#bfdbfe",
      image: null,
      showTouch: false,
      touchX: 50,
      touchY: 50,
      duration: 4
    }
  ]);

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const dataToSave = {
        logo,
        logoX,
        logoY,
        logoSize,
        logoOpacity,
        enableSpecialAnimation,
        scenes
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.error("Auto-save failed: localStorage quota exceeded. Try using smaller images.");
        } else {
          console.error("Auto-save failed", e);
        }
      }
    }, 1000); // Debounce save by 1s

    return () => clearTimeout(timer);
  }, [logo, logoX, logoY, logoSize, logoOpacity, enableSpecialAnimation, scenes]);

  // Calculate dynamic frame timings based on individual scene durations
  const sceneTimings = scenes.map((scene, index, arr) => {
    const previousFrames = arr.slice(0, index).reduce((acc, curr) => acc + (curr.duration * FPS), 0);
    const durationFrames = scene.duration * FPS;
    return { S: previousFrames, E: previousFrames + durationFrames };
  });

  const TOTAL_FRAMES = sceneTimings.length > 0 ? sceneTimings[sceneTimings.length - 1].E : 1;

  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchModalSceneIdx, setTouchModalSceneIdx] = useState<number | null>(null);
  
  // --- SCALING LOGIC ---
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const logoPickerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [logoPickerScale, setLogoPickerScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const { width } = previewContainerRef.current.getBoundingClientRect();
        setPreviewScale(width / 1920);
      }
      if (logoPickerRef.current) {
        const { width } = logoPickerRef.current.getBoundingClientRect();
        setLogoPickerScale(width / 1920);
      }
    };
    
    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    if (previewContainerRef.current) resizeObserver.observe(previewContainerRef.current);
    if (logoPickerRef.current) resizeObserver.observe(logoPickerRef.current);
    
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      resizeObserver.disconnect();
    };
  }, [isFullscreen, showLogoPicker]);

  // Playback Loop
  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && frame < TOTAL_FRAMES) {
      interval = window.setInterval(() => {
        setFrame((f) => {
          if (f >= TOTAL_FRAMES) {
            setIsPlaying(false);
            return TOTAL_FRAMES;
          }
          return f + 1;
        });
      }, 1000 / FPS);
    }
    return () => window.clearInterval(interval);
  }, [isPlaying, frame, TOTAL_FRAMES]);

  useEffect(() => {
    if (frame > TOTAL_FRAMES) setFrame(TOTAL_FRAMES);
  }, [TOTAL_FRAMES, frame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // --- SPECIAL ANIMATION MATH PIPELINE ---
  const swapInputs = [0];
  const swapPhoneX = [25];
  const swapTextX = [-25];
  const swapPhoneRotY = [-25]; // Start with the first scene's tilt

  for (let i = 0; i < scenes.length; i++) {
    const timing = sceneTimings[i] || { S: 0, E: 120 };
    const { S, E } = timing;

    const isEven = i % 2 === 0;
    const targetPhoneX = isEven ? 480 : -480; // Symmetric move 480px right or left (based on 1920px width)
    const targetTextX = isEven ? -480 : 480;   // Symmetric move 480px left or right

    // Each scene swap adds a spin, but lands on a specific side-tilt
    // Even (Right): -25deg (looking left/center), Odd (Left): +25deg (looking right/center)
    const targetRotY = (i * 360) + (isEven ? -25 : 25);

    if (i > 0) {
      const transEnd = Math.min(S + 30, E);

      swapInputs.push(transEnd);
      swapPhoneX.push(targetPhoneX);
      swapTextX.push(targetTextX);
      swapPhoneRotY.push(targetRotY);
    } else {
      // First scene initialization
      swapPhoneRotY[0] = targetRotY;
    }

    swapInputs.push(E);
    swapPhoneX.push(targetPhoneX);
    swapTextX.push(targetTextX);
    swapPhoneRotY.push(targetRotY);
  }

  const currentPhoneX = enableSpecialAnimation ? interpolate(frame, swapInputs, swapPhoneX, easeInOutCubic) : 480;
  const currentTextX = enableSpecialAnimation ? interpolate(frame, swapInputs, swapTextX, easeInOutCubic) : -480;
  const phoneRotationY = enableSpecialAnimation ? interpolate(frame, swapInputs, swapPhoneRotY, easeInOutCubic) : -25;

  // Active scene determination for passing to 3D Canvas
  let activeSceneIndex = sceneTimings.findIndex((timing) => timing && frame >= timing.S && frame < timing.E);
  if (activeSceneIndex === -1) activeSceneIndex = scenes.length - 1; // Default to last if exactly at end

  // --- HANDLERS ---
  const handleAddScene = () => {
    setScenes([...scenes, {
      id: crypto.randomUUID(),
      title: "New Scene",
      titleFont: "Roboto",
      titleWeight: "extrabold",
      titleColor: "#ffffff",
      sub: "Add a description here.",
      subFont: "Roboto",
      subWeight: "normal",
      subColor: "#bfdbfe",
      image: null,
      showTouch: false,
      touchX: 50,
      touchY: 50,
      duration: 4
    }]);
  };

  const handleDeleteScene = (idToRemove: string) => {
    if (scenes.length <= 1) return;
    setScenes(scenes.filter(s => s.id !== idToRemove));
  };

  const handleUpdateScene = (index: number, field: keyof Scene, value: any) => {
    const newScenes = [...scenes];
    (newScenes[index] as any)[field] = value;
    setScenes(newScenes);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdateScene(index, 'image', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLogoX(x);
    setLogoY(y);
    setShowLogoPicker(false);
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touchModalSceneIdx === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    handleUpdateScene(touchModalSceneIdx, 'touchX', x);
    handleUpdateScene(touchModalSceneIdx, 'touchY', y);
    handleUpdateScene(touchModalSceneIdx, 'showTouch', true);
    setTouchModalSceneIdx(null);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      setFrame(0);
      setIsPlaying(true);
    } else {
      setIsFullscreen(false);
    }
  };

  // --- EXPORT / IMPORT LOGIC ---
  const handleExport = async () => {
    try {
      const zip = new JSZip();
      const projectData = {
        logo,
        logoX,
        logoY,
        logoSize,
        logoOpacity,
        enableSpecialAnimation,
        scenes,
        version: "1.0"
      };

      zip.file("project.json", JSON.stringify(projectData, null, 2));
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export project.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const projectJsonFile = zip.file("project.json");
      
      if (!projectJsonFile) {
        throw new Error("Invalid project file: project.json missing.");
      }

      const content = await projectJsonFile.async("string");
      const data = JSON.parse(content);

      // Basic validation
      if (!data.scenes) throw new Error("Invalid project data.");

      // Update state
      setLogo(data.logo);
      setLogoX(data.logoX ?? 10);
      setLogoY(data.logoY ?? 10);
      setLogoSize(data.logoSize ?? 120);
      setLogoOpacity(data.logoOpacity ?? 100);
      setEnableSpecialAnimation(data.enableSpecialAnimation ?? false);
      setScenes(data.scenes);
      setFrame(0);
      
      alert("Project imported successfully!");
    } catch (err) {
      console.error("Import failed", err);
      alert("Failed to import project. Make sure it's a valid project ZIP.");
    } finally {
      e.target.value = ""; // Reset input
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6 flex flex-col items-center justify-center relative">

      {/* Header */}
      <div className="w-full max-w-7xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Zap className="text-blue-500" /> Programmatic Video Studio
          </h1>
          <p className="text-slate-400 mt-2">
            Upload screenshots, logos, and adjust timings.
          </p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/50 shrink-0"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Preview'}
        </button>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: THE VIDEO PREVIEW ENGINE */}
        <div className="col-span-2 flex flex-col gap-4">

          <div className={isFullscreen ? "fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center" : ""}>

            {isFullscreen && (
              <div className="absolute top-6 right-6 z-[110] pointer-events-none">
              </div>
            )}

            <div
              ref={previewContainerRef}
              onClick={() => isFullscreen && setIsPlaying(!isPlaying)}
              className={`relative bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 overflow-hidden shadow-2xl transition-all duration-300 ${isFullscreen
                ? 'w-full h-full max-h-screen max-w-[177.78vh] aspect-video cursor-pointer'
                : 'w-full aspect-video rounded-2xl border border-slate-800'
                }`}
            >
              {/* Scaling Wrapper: Everything inside here is relative to 1920x1080 */}
              <div 
                className="absolute top-1/2 left-1/2 w-[1920px] h-[1080px] origin-center pointer-events-none"
                style={{ 
                  transform: `translate(-50%, -50%) scale(${previewScale})`,
                  pointerEvents: isFullscreen ? 'auto' : 'none'
                }}
              >
                {/* BRANDING LOGO */}
                {logo && (
                  <img
                    src={logo}
                    alt="Brand Logo"
                    className="absolute z-50 pointer-events-none object-contain"
                    style={{
                      left: `${logoX}%`,
                      top: `${logoY}%`,
                      width: `${logoSize}px`,
                      opacity: logoOpacity / 100,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}

                {/* Cinematic Text Overlay Container */}
                <div
                  className="absolute left-1/2 top-1/2 w-[800px] pointer-events-none z-20"
                  style={{ transform: `translate(calc(-50% + ${currentTextX}px), -50%)` }}
                >
                  {scenes.map((scene, idx) => {
                    const timing = sceneTimings[idx] || { S: 0, E: 120 };
                    const { S, E } = timing;
                    const transLen = Math.min(15, (E - S) / 4);
                    const opacity = interpolate(frame, [S, S + transLen, E - transLen, E], [0, 1, 1, 0]);
                    const yOffset = interpolate(frame, [S, S + transLen, E - transLen, E], [40, 0, 0, -40]);

                    return (
                      <div
                        key={`text-${scene.id}`}
                        className="absolute left-0 w-full pr-4"
                        style={{ opacity, transform: `translateY(${yOffset}px)` }}
                      >
                        <h2
                          className="mb-6 leading-tight tracking-tight drop-shadow-lg text-7xl"
                          style={{
                            fontFamily: scene.titleFont === 'Tajawal' ? '"Tajawal", sans-serif' : '"Roboto", sans-serif',
                            fontWeight: scene.titleWeight === 'bold' ? 700 : scene.titleWeight === 'extrabold' ? 800 : 400,
                            color: scene.titleColor || '#ffffff'
                          }}
                        >
                          {scene.title}
                        </h2>
                        <p
                          className="leading-relaxed max-w-2xl drop-shadow-md line-clamp-3 text-3xl"
                          style={{
                            fontFamily: scene.subFont === 'Tajawal' ? '"Tajawal", sans-serif' : '"Roboto", sans-serif',
                            fontWeight: scene.subWeight === 'bold' ? 700 : scene.subWeight === 'extrabold' ? 800 : 400,
                            color: scene.subColor || '#bfdbfe'
                          }}
                        >
                          {scene.sub}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <PhoneMockup
                  scenes={scenes}
                  frame={frame}
                  sceneTimings={sceneTimings}
                  currentPhoneX={currentPhoneX}
                  phoneRotationY={phoneRotationY}
                  enableSpecialAnimation={enableSpecialAnimation}
                  interpolate={interpolate}
                />
              </div>
            </div>

            {/* Timeline Controls */}
            <div className={`flex items-center gap-4 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-2xl transition-all duration-300 ${isFullscreen ? 'w-full max-w-4xl mt-8 mb-4' : 'w-full'}`}>
              <button
                onClick={() => {
                  if (frame >= TOTAL_FRAMES) setFrame(0);
                  setIsPlaying(!isPlaying);
                }}
                className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                onClick={() => { setFrame(0); setIsPlaying(true); }}
                className="p-3 bg-slate-800 rounded-xl text-white hover:bg-slate-700 transition-colors border border-slate-700"
              >
                <RotateCcw size={20} />
              </button>

              <input
                type="range"
                min="0"
                max={TOTAL_FRAMES}
                value={frame}
                onChange={(e) => { setFrame(Number(e.target.value)); setIsPlaying(false); }}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />

              <div className="flex flex-col items-end min-w-[80px]">
                <span className="text-slate-300 font-mono font-medium">
                  {(frame / FPS).toFixed(1)}s / {(TOTAL_FRAMES / FPS).toFixed(1)}s
                </span>
              </div>

              {isFullscreen && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/50 text-slate-300 rounded-xl font-medium transition-all border border-slate-700 group"
                  >
                    <Minimize size={18} className="group-hover:scale-110 transition-transform" />
                    <span>Exit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: SETTINGS & EDITOR */}
        <div className="h-full max-h-[calc(100vh-12rem)] flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-950 px-4 py-4 border-b border-slate-800 shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100 flex items-center gap-2">
                <LayoutGrid size={18} className="text-blue-500" /> Project Settings
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExport}
                  title="Export Project (.zip)"
                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                >
                  <Download size={16} />
                </button>
                <label 
                  title="Import Project (.zip)"
                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all cursor-pointer"
                >
                  <Upload size={16} />
                  <input type="file" accept=".zip" className="hidden" onChange={handleImport} />
                </label>
                <div className="w-px h-4 bg-slate-800 mx-1"></div>
                <button 
                  onClick={() => {
                    if (confirm("Reset project? All progress will be lost.")) {
                      localStorage.removeItem(STORAGE_KEY);
                      window.location.reload();
                    }
                  }}
                  className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase tracking-wider font-bold"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Special Animation Toggle */}
            <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <div>
                  <label className="text-xs font-semibold text-slate-200 block">Cinematic Scene Swap</label>
                  <p className="text-[10px] text-slate-500">Phone & Text swap sides with a cinematic side-tilt spin.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={enableSpecialAnimation} onChange={(e) => setEnableSpecialAnimation(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Global Logo Control */}
            <div className="flex items-start gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <div className="shrink-0">
                {!logo ? (
                  <>
                    <input type="file" accept="image/*" id="upload-logo" className="hidden" onChange={handleLogoUpload} />
                    <label htmlFor="upload-logo" className="flex flex-col items-center justify-center w-16 h-[88px] rounded-lg border border-dashed border-slate-600 cursor-pointer hover:bg-slate-800 hover:border-slate-400 transition-colors text-slate-400 group">
                      <Upload size={16} className="mb-1 group-hover:text-blue-400" />
                      <span className="text-[9px] font-medium text-center">Logo</span>
                    </label>
                  </>
                ) : (
                  <div className="relative w-16 h-[88px] rounded-lg border border-slate-600 bg-black/20 overflow-hidden flex items-center justify-center group">
                    <img src={logo} className="w-12 h-12 object-contain" alt="logo thumb" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setLogo(null)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 w-12">Size</span>
                  <input type="range" min="30" max="400" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{logoSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 w-12">Opacity</span>
                  <input type="range" min="10" max="100" value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{logoOpacity}%</span>
                </div>
                <button onClick={() => setShowLogoPicker(true)} disabled={!logo} className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium rounded-md text-slate-300 flex items-center justify-center gap-2 transition-colors">
                  <Crosshair size={12} /> Set Position on Screen
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900">
            {scenes.map((scene, index) => (
              <div key={scene.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group transition-all focus-within:border-blue-500/50">

                {/* Scene Header */}
                <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Scene {index + 1}
                  </span>
                  {scenes.length > 1 && (
                    <button onClick={() => handleDeleteScene(scene.id)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                  )}
                </div>

                {/* Inputs */}
                <div className="space-y-4">

                  {/* Title Control */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Headline</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={scene.titleFont}
                          onChange={(e) => handleUpdateScene(index, 'titleFont', e.target.value)}
                          className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="Roboto">Roboto</option>
                          <option value="Tajawal">Tajawal</option>
                        </select>
                        <select
                          value={scene.titleWeight}
                          onChange={(e) => handleUpdateScene(index, 'titleWeight', e.target.value)}
                          className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                        </select>
                        <input
                          type="color"
                          value={scene.titleColor}
                          onChange={(e) => handleUpdateScene(index, 'titleColor', e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={scene.title}
                      onChange={(e) => handleUpdateScene(index, 'title', e.target.value)}
                      placeholder="Headline Title"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Subtitle Control */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subtitle</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={scene.subFont}
                          onChange={(e) => handleUpdateScene(index, 'subFont', e.target.value)}
                          className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="Roboto">Roboto</option>
                          <option value="Tajawal">Tajawal</option>
                        </select>
                        <select
                          value={scene.subWeight}
                          onChange={(e) => handleUpdateScene(index, 'subWeight', e.target.value)}
                          className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                        </select>
                        <input
                          type="color"
                          value={scene.subColor}
                          onChange={(e) => handleUpdateScene(index, 'subColor', e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                        />
                      </div>
                    </div>
                    <textarea
                      value={scene.sub}
                      onChange={(e) => handleUpdateScene(index, 'sub', e.target.value)}
                      placeholder="Subtitle / Description"
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Duration Control */}
                  <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 mt-2">
                    <Clock size={14} className="text-slate-500 shrink-0 ml-1" />
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="range"
                        min="2" max="10" step="0.5"
                        value={scene.duration}
                        onChange={(e) => handleUpdateScene(index, 'duration', parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <span className="text-xs font-mono text-blue-400 font-semibold w-8 text-right">
                        {scene.duration}s
                      </span>
                    </div>
                  </div>

                  {/* Image & Touch Picker */}
                  <div className="flex gap-4 items-start pt-2 border-t border-slate-800">
                    <div className="shrink-0">
                      {!scene.image ? (
                        <>
                          <input type="file" accept="image/*" id={`upload-${scene.id}`} className="hidden" onChange={(e) => handleImageUpload(index, e)} />
                          <label htmlFor={`upload-${scene.id}`} className="flex flex-col items-center justify-center w-24 h-[110px] rounded-lg border border-dashed border-slate-700 bg-slate-900 cursor-pointer hover:bg-slate-800 hover:border-slate-500 transition-colors text-slate-400 group">
                            <Upload size={20} className="mb-2 group-hover:text-blue-400" />
                            <span className="text-[10px] font-medium text-center px-2">Upload<br />Screen</span>
                          </label>
                        </>
                      ) : (
                        <div className="relative w-24 h-[110px] rounded-lg border border-slate-700 overflow-hidden cursor-pointer group shadow-inner" onClick={() => setTouchModalSceneIdx(index)}>
                          <img src={scene.image} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                          {scene.showTouch && (
                            <div className="absolute w-4 h-4 bg-blue-500/80 rounded-full border border-white shadow-sm pointer-events-none" style={{ left: `${scene.touchX}%`, top: `${scene.touchY}%`, transform: 'translate(-50%, -50%)' }} />
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 backdrop-blur-sm py-1.5 px-1 text-center border-t border-slate-800 group-hover:bg-blue-600 transition-colors">
                            <span className="text-[10px] font-semibold text-slate-100 flex items-center justify-center gap-1">
                              <MousePointerClick size={12} /> Set Touch
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                            Touch Transition
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={scene.showTouch} onChange={(e) => handleUpdateScene(index, 'showTouch', e.target.checked)} className="sr-only peer" disabled={!scene.image} />
                            <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500 peer-disabled:opacity-50"></div>
                          </label>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-relaxed">
                          {!scene.image ? "Upload a screen to enable touch." : "Click the thumbnail to place target."}
                        </p>

                        {scene.image && (
                          <button onClick={() => { handleUpdateScene(index, 'image', null); handleUpdateScene(index, 'showTouch', false); }} className="mt-2 text-[10px] text-red-400 hover:text-red-300 font-medium">Remove Image</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button onClick={handleAddScene} className="w-full py-3 rounded-xl border border-slate-700 border-dashed text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 font-medium">
              <Plus size={18} /> Add New Scene
            </button>
            <div className="h-4"></div> {/* Bottom padding */}
          </div>
        </div>

      </div>

      {/* --- TOUCH SELECTOR MODAL --- */}
      {touchModalSceneIdx !== null && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg flex flex-col items-center relative shadow-2xl">
            <button onClick={() => setTouchModalSceneIdx(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"><X size={20} /></button>
            <div className="flex flex-col items-center mb-6 mt-2 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3"><MousePointerClick className="text-blue-400" size={24} /></div>
              <h3 className="text-xl font-bold text-white mb-1">Set Target Position</h3>
              <p className="text-sm text-slate-400">Click anywhere on the screen below.</p>
            </div>
            <div className="relative w-[258px] h-[538px] bg-black rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl shrink-0 group p-1">
              <div className="w-full h-full bg-slate-950 rounded-[22px] overflow-hidden border border-slate-800/50 relative cursor-crosshair" onClick={handleModalClick}>
                <img src={scenes[touchModalSceneIdx].image || undefined} className="w-full h-full object-contain pointer-events-none group-hover:opacity-90 transition-opacity" alt="Target" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-black/60 px-4 py-2 rounded-full text-white text-sm font-medium backdrop-blur-sm">Click to confirm</div>
                </div>
                {scenes[touchModalSceneIdx].showTouch && (
                  <div className="absolute w-8 h-8 bg-blue-500/80 rounded-full border-2 border-white shadow-lg pointer-events-none animate-pulse" style={{ left: `${scenes[touchModalSceneIdx].touchX}%`, top: `${scenes[touchModalSceneIdx].touchY}%`, transform: 'translate(-50%, -50%)' }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- LOGO PICKER MODAL --- */}
      {showLogoPicker && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-4xl flex flex-col items-center relative shadow-2xl">
            <button onClick={() => setShowLogoPicker(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"><X size={20} /></button>
            <div className="flex flex-col items-center mb-6 mt-2 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3"><Crosshair className="text-blue-400" size={24} /></div>
              <h3 className="text-xl font-bold text-white mb-1">Set Logo Position</h3>
              <p className="text-sm text-slate-400">Click anywhere on the preview below to place your watermark/logo.</p>
            </div>

            <div 
              ref={logoPickerRef}
              className="relative w-full aspect-video bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-2xl overflow-hidden cursor-crosshair border-4 border-slate-800 shadow-2xl" 
              onClick={handleLogoModalClick}
            >
              <div 
                className="absolute top-1/2 left-1/2 w-[1920px] h-[1080px] origin-center pointer-events-none"
                style={{ transform: `translate(-50%, -50%) scale(${logoPickerScale})` }}
              >
                {/* Fake UI for reference context */}
                <div 
                  className="absolute top-1/2 left-1/2 w-[800px] pointer-events-none"
                  style={{ transform: 'translate(calc(-50% - 480px), -50%)' }}
                >
                  <h2 className="text-7xl font-extrabold text-white mb-6 opacity-20">Title Reference</h2>
                  <p className="text-3xl text-blue-200 opacity-20">Subtitle reference text area.</p>
                </div>
                <div 
                  className="absolute top-1/2 left-1/2 w-[270px] h-[550px] bg-slate-800/40 rounded-[45px] border-4 border-slate-700/50 pointer-events-none"
                  style={{ transform: 'translate(calc(-50% + 480px), -50%) scale(1.25)' }}
                ></div>

                {/* The Logo preview inside modal */}
                {logo && (
                  <img
                    src={logo}
                    className="absolute z-50 pointer-events-none transition-all duration-75 object-contain drop-shadow-lg"
                    style={{
                      left: `${logoX}%`,
                      top: `${logoY}%`,
                      width: `${logoSize}px`,
                      opacity: logoOpacity / 100,
                      transform: 'translate(-50%, -50%)'
                    }}
                    alt="Target Logo"
                  />
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-black/60 px-8 py-4 rounded-full text-white text-2xl font-medium backdrop-blur-sm">Click to place logo</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;800&family=Tajawal:wght@400;700;800&display=swap');

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }

        .phone-wrapper { --phone-scale: 1.25; }

      `}} />
    </div>
  );
}