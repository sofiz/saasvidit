import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Upload, Plus, Trash2, Maximize, Minimize, MousePointerClick, X, Clock, LayoutGrid, Crosshair, Sparkles, Download, Film, Loader2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import JSZip from 'jszip';
import PhoneMockup from './components/PhoneMockup';
import { getFFmpeg, captureDOMFrame, compileVideo, cleanupFSDirectory } from './utils/videoExporter';


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

  // Inspector and Storyboard states
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'scene' | 'branding' | 'project'>('scene');

  // Drag & drop scene reordering states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const reorderedScenes = [...scenes];
    const [draggedScene] = reorderedScenes.splice(draggedIndex, 1);
    reorderedScenes.splice(index, 0, draggedScene);
    setScenes(reorderedScenes);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setSelectedSceneIndex(index); // Seek properties to the dropped scene
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    const newScenes = [...scenes];
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;
    setScenes(newScenes);
    setSelectedSceneIndex(targetIndex); // Follow the scene to its new index
    setFrame(0);
  };

  // Video Exporter State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  // Exporter Refs
  const videoSceneRef = useRef<HTMLDivElement>(null);
  const exportPhaseRef = useRef<'idle' | 'loading_ffmpeg' | 'capturing' | 'compiling'>('idle');
  const cancelExportRef = useRef(false);

  // --- SCALING LOGIC ---
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const logoPickerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [logoPickerScale, setLogoPickerScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (isFullscreen) {
        if (previewWrapperRef.current) {
          const { width: wrapperWidth, height: wrapperHeight } = previewWrapperRef.current.getBoundingClientRect();
          let targetWidth = wrapperWidth;
          let targetHeight = wrapperWidth * (9 / 16);

          if (targetHeight > wrapperHeight) {
            targetHeight = wrapperHeight;
            targetWidth = wrapperHeight * (16 / 9);
          }

          setPreviewSize({ width: targetWidth, height: targetHeight });
          setPreviewScale(targetWidth / 1920);
        }
      } else {
        if (previewContainerRef.current) {
          const { width } = previewContainerRef.current.getBoundingClientRect();
          setPreviewScale(width / 1920);
        }
      }

      if (logoPickerRef.current) {
        const { width } = logoPickerRef.current.getBoundingClientRect();
        setLogoPickerScale(width / 1920);
      }
    };

    updateScale();
    const resizeObserver = new ResizeObserver(updateScale);
    if (previewWrapperRef.current) resizeObserver.observe(previewWrapperRef.current);
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

  // --- DETERMINISTIC VIDEO EXPORTER ENGINE ---
  const handleStartExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportStatus('Initializing WebAssembly core...');
    setExportProgress(0);
    setExportError(null);
    cancelExportRef.current = false;
    setIsPlaying(false);

    try {
      exportPhaseRef.current = 'loading_ffmpeg';
      // Prefetch and initialize FFmpeg so that the virtual filesystem is ready
      const ffmpeg = await getFFmpeg((msg) => {
        if (msg.includes('frame=')) {
          setExportStatus(`Compiling Video: ${msg}`);
        }
      });

      // Clean up any stale files from a previous run to avoid leaks
      await cleanupFSDirectory(ffmpeg, TOTAL_FRAMES);

      exportPhaseRef.current = 'capturing';

      const element = videoSceneRef.current;
      if (!element) {
        throw new Error('Cinematic preview scene container not found in DOM.');
      }

      // 1. Programmatically capture frame by frame
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (cancelExportRef.current) {
          throw new Error('Export cancelled by user.');
        }

        setExportStatus(`Rendering frame ${i + 1} of ${TOTAL_FRAMES}...`);

        // Update the timeline state
        setFrame(i);

        // Wait 2 animation frames for React to render and browser to paint
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });

        if (cancelExportRef.current) {
          throw new Error('Export cancelled by user.');
        }

        // Capture DOM snapshot
        const frameData = await captureDOMFrame(element, 1920, 1080);

        if (cancelExportRef.current) {
          throw new Error('Export cancelled by user.');
        }

        // Write frame directly to FFmpeg FS
        await ffmpeg.writeFile(`frame_${i}.png`, frameData);

        // Update progress (capturing is 85% of total progress, compilation is remaining 15%)
        const progressPercent = Math.round((i / TOTAL_FRAMES) * 85);
        setExportProgress(progressPercent);
      }

      // 2. All frames captured! Begin compiling H.264 video
      exportPhaseRef.current = 'compiling';
      setExportProgress(85);
      setExportStatus('Stitching frames together into high-quality H.264 MP4 container...');

      const videoUrl = await compileVideo(ffmpeg, FPS, (msg) => {
        setExportStatus(msg);
      });

      if (cancelExportRef.current) {
        throw new Error('Export cancelled by user.');
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `SofizStudio_Video_${new Date().toISOString().split('T')[0]}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportProgress(100);
      setExportStatus('Video export completed! Check your downloads.');

      // Delete temporary frame files in FFmpeg FS to release WASM heap memory
      await cleanupFSDirectory(ffmpeg, TOTAL_FRAMES);

      setTimeout(() => {
        setIsExporting(false);
        exportPhaseRef.current = 'idle';
      }, 2000);

    } catch (err) {
      console.error('Video Exporter Error:', err);
      setExportError((err as Error).message);

      // Quiet clean up
      try {
        const ffmpeg = await getFFmpeg();
        await cleanupFSDirectory(ffmpeg, TOTAL_FRAMES);
      } catch { }

      exportPhaseRef.current = 'idle';
      setIsExporting(false);
    }
  };

  const handleCancelExport = async () => {
    cancelExportRef.current = true;
    setExportStatus('Cancelling and cleaning up memory...');
    try {
      const ffmpeg = await getFFmpeg();
      await cleanupFSDirectory(ffmpeg, TOTAL_FRAMES);
    } catch { }
    setIsExporting(false);
    exportPhaseRef.current = 'idle';
  };


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

  // Automatically sync selected index with active scene index during playback
  useEffect(() => {
    if (isPlaying) {
      setSelectedSceneIndex(activeSceneIndex);
    }
  }, [activeSceneIndex, isPlaying]);

  // --- HANDLERS ---
  const handleAddScene = () => {
    const newId = crypto.randomUUID();
    const newScenes = [...scenes, {
      id: newId,
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
    }];
    setScenes(newScenes);
    // Automatically select the newly created scene
    setSelectedSceneIndex(newScenes.length - 1);
  };

  const handleDeleteScene = (idToRemove: string) => {
    if (scenes.length <= 1) return;
    const targetIdx = scenes.findIndex(s => s.id === idToRemove);
    setScenes(scenes.filter(s => s.id !== idToRemove));

    // Safety index adjusting
    if (selectedSceneIndex >= scenes.length - 1) {
      setSelectedSceneIndex(Math.max(0, scenes.length - 2));
    } else if (selectedSceneIndex > targetIdx) {
      setSelectedSceneIndex(selectedSceneIndex - 1);
    }
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
    <div className="min-h-screen bg-slate-950 text-white font-sans p-6 flex flex-col items-center justify-start relative">

      {/* Header Panel */}
      {/* <div className="w-full max-w-7xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0 bg-slate-900/20 p-6 rounded-2xl border border-slate-800/40 backdrop-blur-md">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 flex items-center gap-3 tracking-tight">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 shadow-md">
              <Zap size={20} className="fill-current" />
            </span> 
            Programmatic Video Studio
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
            A high-fidelity programmatic workspace for screen walkthroughs and branding.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isFullscreen ? (
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-sm transition-all border border-slate-700 shadow-md"
            >
              <Minimize size={16} />
              <span>Exit Fullscreen</span>
            </button>
          ) : (
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/30 w-full md:w-auto"
            >
              <Maximize size={16} />
              <span>Fullscreen Preview</span>
            </button>
          )}
        </div>
      </div> */}

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* LEFT COLUMN: PLAYER & SEGMENT TIMELINE & STORYBOARD */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">

          <div className={isFullscreen ? "fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300" : "flex flex-col gap-4"}>

            {/* Wrapper to constrain and center preview element in fullscreen */}
            <div
              ref={previewWrapperRef}
              className={isFullscreen ? "flex-1 w-full flex items-center justify-center min-h-0 relative" : "w-full"}
            >
              {/* Aspect Video Preview Container */}
              <div
                ref={previewContainerRef}
                onClick={() => isFullscreen && setIsPlaying(!isPlaying)}
                className={`relative bg-gradient-to-br from-indigo-950/60 via-slate-900/60 to-blue-950/60 overflow-hidden shadow-2xl transition-all duration-300 border border-slate-800/80 backdrop-blur-md ${isFullscreen
                  ? 'cursor-pointer'
                  : 'w-full aspect-video rounded-2xl'
                  }`}
                style={isFullscreen ? {
                  width: `${previewSize.width}px`,
                  height: `${previewSize.height}px`,
                } : {}}
              >
                {/* Scaling Wrapper: 1920x1080 canvas */}
                <div
                  ref={videoSceneRef}
                  className="absolute top-1/2 left-1/2 w-[1920px] h-[1080px] origin-center pointer-events-none bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950"
                  style={{
                    transform: `translate(-50%, -50%) scale(${previewScale})`,
                    pointerEvents: isFullscreen ? 'auto' : 'none'
                  }}
                >
                  {/* BRANDING WATERMARK */}
                  {logo && (
                    <img
                      src={logo}
                      alt="Brand Logo"
                      className="absolute z-50 pointer-events-none object-contain drop-shadow-2xl"
                      style={{
                        left: `${logoX}%`,
                        top: `${logoY}%`,
                        width: `${logoSize}px`,
                        opacity: logoOpacity / 100,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                  )}

                  {/* Text Overlays */}
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
                          className="absolute left-0 w-full pr-4 text-left"
                          style={{ opacity, transform: `translateY(${yOffset}px)` }}
                        >
                          <h2
                            className="mb-6 leading-tight tracking-tight drop-shadow-2xl text-7xl"
                            style={{
                              fontFamily: scene.titleFont === 'Tajawal' ? '"Tajawal", sans-serif' : '"Roboto", sans-serif',
                              fontWeight: scene.titleWeight === 'bold' ? 700 : scene.titleWeight === 'extrabold' ? 800 : 400,
                              color: scene.titleColor || '#ffffff'
                            }}
                          >
                            {scene.title}
                          </h2>
                          <p
                            className="leading-relaxed max-w-2xl drop-shadow-xl line-clamp-3 text-3xl"
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
                    isExporting={isExporting}
                    FPS={FPS}
                  />
                </div>
              </div>
            </div>

            {/* Segmented Timeline & Controls */}
            <div className={`flex flex-col gap-3.5 bg-slate-900/90 border border-slate-800/80 shadow-2xl p-4 rounded-2xl backdrop-blur-md transition-all duration-300 ${isFullscreen ? 'w-full max-w-4xl mt-8' : 'w-full'}`}>

              {/* Scrubber track showing scene boundaries */}
              <div className="relative w-full h-7 flex items-center">
                {/* Horizontal segmented colored blocks background */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-slate-950 border border-slate-800/40 overflow-hidden flex pointer-events-none">
                  {scenes.map((scene, idx) => {
                    const timing = sceneTimings[idx];
                    if (!timing) return null;
                    const widthPct = (scene.duration / (TOTAL_FRAMES / FPS)) * 100;

                    const colors = [
                      'bg-blue-500/10',
                      'bg-indigo-500/10',
                      'bg-violet-500/10',
                      'bg-purple-500/10'
                    ];
                    const isActive = activeSceneIndex === idx;
                    const activeColorClass = isActive
                      ? 'bg-blue-500/30 border-y border-blue-500/30'
                      : colors[idx % colors.length];

                    return (
                      <div
                        key={`seg-${scene.id}`}
                        className={`h-full border-r border-slate-950 last:border-r-0 transition-colors ${activeColorClass}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    );
                  })}
                </div>

                {/* Range overlay slider scrubber */}
                <input
                  type="range"
                  min="0"
                  max={TOTAL_FRAMES}
                  value={frame}
                  onChange={(e) => { setFrame(Number(e.target.value)); setIsPlaying(false); }}
                  className="absolute inset-x-0 w-full h-8 opacity-90 appearance-none bg-transparent cursor-ew-resize z-20"
                  style={{ margin: 0, outline: 'none' }}
                />
              </div>

              {/* Lower Controls Console */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (frame >= TOTAL_FRAMES) setFrame(0);
                      setIsPlaying(!isPlaying);
                    }}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-md shadow-blue-900/30"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button
                    onClick={() => { setFrame(0); setIsPlaying(true); }}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
                    title="Rewind"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Time stamps */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
                  <span>Playhead:</span>
                  <span className="text-slate-300 font-bold">{(frame / FPS).toFixed(2)}s</span>
                  <span className="text-slate-600 font-normal">/</span>
                  <span>Duration:</span>
                  <span className="text-blue-400 font-bold">{(TOTAL_FRAMES / FPS).toFixed(2)}s</span>
                </div>

                {/* Screen size mode button */}
                <div>
                  {isFullscreen ? (
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-950/30 hover:text-red-400 hover:border-red-500/40 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                    >
                      <Minimize size={14} />
                      <span>Exit</span>
                    </button>
                  ) : (
                    <button
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                    >
                      <Maximize size={14} />
                      <span>Preview</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STORYBOARD CONTAINER */}
          {!isFullscreen && (
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Film className="text-blue-500" size={16} />
                  <span className="text-sm font-bold text-slate-200">Storyboard Sequence</span>
                  <span className="text-xs bg-slate-800/50 text-slate-400 px-2 py-0.5 rounded-full font-mono font-medium">{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Drag to reorder. Click to seek & edit.</p>
              </div>

              {/* Horizontal cards track */}
              <div className="flex items-center gap-3 overflow-x-auto py-2 px-1 custom-scrollbar min-h-[140px]">
                {scenes.map((scene, index) => {
                  const isSelected = selectedSceneIndex === index;
                  const isDragged = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <div
                      key={scene.id}
                      draggable
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) {
                          e.preventDefault();
                          return;
                        }
                        handleDragStart(index);
                      }}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => setDragOverIndex(null)}
                      onClick={() => {
                        setSelectedSceneIndex(index);
                        setFrame(sceneTimings[index].S);
                        setIsPlaying(false); // Pause so they can inspect
                      }}
                      className={`relative shrink-0 w-44 h-28 bg-slate-950 rounded-xl border-2 overflow-hidden cursor-pointer select-none transition-all flex flex-col group ${isSelected
                          ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg shadow-blue-500/10'
                          : 'border-slate-800/80 hover:border-slate-700'
                        } ${isDragged ? 'opacity-30 border-dashed border-slate-700' : ''
                        } ${isDragOver && draggedIndex !== index ? 'border-emerald-500 scale-[1.03] shadow-md shadow-emerald-500/20' : ''
                        }`}
                    >
                      {/* Card Header (Scene Index & Duration badge) */}
                      <div className="flex justify-between items-center p-2 bg-slate-900/60 backdrop-blur-md border-b border-slate-900/60 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <GripVertical size={10} className="text-slate-500 group-hover:text-slate-400 cursor-grab active:cursor-grabbing" />
                          <span className="text-[10px] font-bold text-slate-400 font-mono">SCENE {index + 1}</span>
                        </div>
                        <span className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-blue-400 font-bold font-mono">
                          {scene.duration}s
                        </span>
                      </div>

                      {/* Thumbnail/Placeholder screen */}
                      <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden relative">
                        {scene.image ? (
                          <img src={scene.image} className="w-full h-full object-contain pointer-events-none" alt="" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                            <Upload size={14} className="opacity-40" />
                            <span className="text-[8px] font-bold tracking-wider uppercase opacity-40">No Screen</span>
                          </div>
                        )}
                        {scene.showTouch && scene.image && (
                          <div className="absolute w-2 h-2 bg-blue-500 rounded-full border border-white shadow-sm" style={{ left: `${scene.touchX}%`, top: `${scene.touchY}%`, transform: 'translate(-50%, -50%)' }} />
                        )}
                      </div>

                      {/* Card Footer (Headline snippet) */}
                      <div className="p-2 bg-slate-950/80 shrink-0 border-t border-slate-900/60">
                        <p className="text-[10px] font-medium text-slate-300 truncate w-full">
                          {scene.title || 'Untitled'}
                        </p>
                      </div>

                      {/* Quick delete trash button on hover */}
                      {scenes.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid selecting scene
                            handleDeleteScene(scene.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-slate-950/90 border border-slate-800 hover:border-red-500 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Scene"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Scene card */}
                <button
                  onClick={handleAddScene}
                  className="shrink-0 w-36 h-28 border-2 border-dashed border-slate-800 hover:border-blue-500 hover:bg-blue-500/5 hover:text-blue-400 rounded-xl transition-all flex flex-col items-center justify-center gap-2 text-slate-500 cursor-pointer"
                >
                  <Plus size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Add Scene</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PROPERTY INSPECTOR */}
        <div className="col-span-1 flex flex-col bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[660px] self-start w-full">

          {/* Active Tabs Navigation */}
          <div className="flex bg-slate-950/60 border-b border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('scene')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'scene'
                  ? 'text-blue-400 border-blue-500 bg-slate-900/40'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/10'
                }`}
            >
              <Film size={14} />
              <span>Scene {selectedSceneIndex + 1}</span>
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'branding'
                  ? 'text-blue-400 border-blue-500 bg-slate-900/40'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/10'
                }`}
            >
              <Sparkles size={14} />
              <span>Branding</span>
            </button>
            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'project'
                  ? 'text-blue-400 border-blue-500 bg-slate-900/40'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/10'
                }`}
            >
              <LayoutGrid size={14} />
              <span>Workspace</span>
            </button>
          </div>

          {/* Inspector Panel Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-900/20 max-h-[calc(100vh-20rem)] min-h-[580px]">

            {/* TAB 1: SCENE EDIT PANEL */}
            {activeTab === 'scene' && (
              <div className="space-y-5 animate-in fade-in duration-150">

                {/* Selected scene heading metadata */}
                <div className="flex items-center justify-between bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Editing Content</span>
                    <h4 className="text-sm font-bold text-white">Scene {selectedSceneIndex + 1} of {scenes.length}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveScene(selectedSceneIndex, 'up')}
                      disabled={selectedSceneIndex === 0}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-slate-500 rounded-lg text-slate-400 transition-all"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveScene(selectedSceneIndex, 'down')}
                      disabled={selectedSceneIndex === scenes.length - 1}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-slate-500 rounded-lg text-slate-400 transition-all"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>

                {/* Headline Settings card */}
                <div className="space-y-2.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <div className="flex justify-between items-center px-0.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Headline Text</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={scenes[selectedSceneIndex].titleFont}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'titleFont', e.target.value)}
                        className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      >
                        <option value="Roboto">Roboto</option>
                        <option value="Tajawal">Tajawal</option>
                      </select>
                      <select
                        value={scenes[selectedSceneIndex].titleWeight}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'titleWeight', e.target.value)}
                        className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="extrabold">Extra Bold</option>
                      </select>
                      <input
                        type="color"
                        value={scenes[selectedSceneIndex].titleColor}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'titleColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={scenes[selectedSceneIndex].title}
                    onChange={(e) => handleUpdateScene(selectedSceneIndex, 'title', e.target.value)}
                    placeholder="Headline Title"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* Subtitle Settings card */}
                <div className="space-y-2.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <div className="flex justify-between items-center px-0.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtitle Text</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={scenes[selectedSceneIndex].subFont}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'subFont', e.target.value)}
                        className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      >
                        <option value="Roboto">Roboto</option>
                        <option value="Tajawal">Tajawal</option>
                      </select>
                      <select
                        value={scenes[selectedSceneIndex].subWeight}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'subWeight', e.target.value)}
                        className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="extrabold">Extra Bold</option>
                      </select>
                      <input
                        type="color"
                        value={scenes[selectedSceneIndex].subColor}
                        onChange={(e) => handleUpdateScene(selectedSceneIndex, 'subColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                      />
                    </div>
                  </div>
                  <textarea
                    value={scenes[selectedSceneIndex].sub}
                    onChange={(e) => handleUpdateScene(selectedSceneIndex, 'sub', e.target.value)}
                    placeholder="Subtitle / Description"
                    rows={3}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-medium"
                  />
                </div>

                {/* Duration control slider */}
                <div className="space-y-3.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <div className="flex justify-between items-center px-0.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scene Duration</label>
                    <span className="text-xs font-bold font-mono text-blue-400">{scenes[selectedSceneIndex].duration}s</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="text-slate-500" />
                    <input
                      type="range"
                      min="2" max="10" step="0.5"
                      value={scenes[selectedSceneIndex].duration}
                      onChange={(e) => handleUpdateScene(selectedSceneIndex, 'duration', parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>

                {/* Screen screenshot upload / Touch trigger hotspots */}
                <div className="space-y-3.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mockup Screenshot</label>

                  <div className="flex gap-4 items-stretch">
                    <div className="shrink-0">
                      {!scenes[selectedSceneIndex].image ? (
                        <>
                          <input type="file" accept="image/*" id={`upload-${scenes[selectedSceneIndex].id}`} className="hidden" onChange={(e) => handleImageUpload(selectedSceneIndex, e)} />
                          <label htmlFor={`upload-${scenes[selectedSceneIndex].id}`} className="flex flex-col items-center justify-center w-24 h-[112px] rounded-lg border border-dashed border-slate-800 bg-slate-950 cursor-pointer hover:bg-slate-900 hover:border-slate-600 transition-colors text-slate-400 group">
                            <Upload size={18} className="mb-1 text-slate-500 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                            <span className="text-[9px] font-bold text-center px-2">Upload File</span>
                          </label>
                        </>
                      ) : (
                        <div className="relative w-24 h-[112px] rounded-lg border border-slate-800 overflow-hidden cursor-pointer group shadow-lg" onClick={() => setTouchModalSceneIdx(selectedSceneIndex)}>
                          <img src={scenes[selectedSceneIndex].image || undefined} className="w-full h-full object-contain bg-slate-950" alt="" />
                          {scenes[selectedSceneIndex].showTouch && (
                            <div className="absolute w-3 h-3 bg-blue-500/80 rounded-full border border-white pointer-events-none animate-pulse" style={{ left: `${scenes[selectedSceneIndex].touchX}%`, top: `${scenes[selectedSceneIndex].touchY}%`, transform: 'translate(-50%, -50%)' }} />
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 backdrop-blur-xs py-1.5 text-center border-t border-slate-900/60 group-hover:bg-blue-600 transition-colors">
                            <span className="text-[8px] font-bold text-white flex items-center justify-center gap-1">
                              <MousePointerClick size={10} /> Set Touch
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Tap Animation</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={scenes[selectedSceneIndex].showTouch} onChange={(e) => handleUpdateScene(selectedSceneIndex, 'showTouch', e.target.checked)} className="sr-only peer" disabled={!scenes[selectedSceneIndex].image} />
                            <div className="w-8 h-4 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-800 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500 peer-disabled:opacity-50"></div>
                          </label>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-relaxed font-medium">
                          {scenes[selectedSceneIndex].image
                            ? "Click the screenshot thumbnail to place a cursor touch hotspot on screen."
                            : "Upload a mockup screenshot image to enable touch animations."
                          }
                        </p>
                      </div>
                      {scenes[selectedSceneIndex].image && (
                        <button
                          onClick={() => {
                            handleUpdateScene(selectedSceneIndex, 'image', null);
                            handleUpdateScene(selectedSceneIndex, 'showTouch', false);
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 hover:underline font-semibold text-left mt-2 self-start"
                        >
                          Remove Screen Image
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: BRANDING & WATERMARK PANEL */}
            {activeTab === 'branding' && (
              <div className="space-y-5 animate-in fade-in duration-150">

                {/* Branding settings card */}
                <div className="space-y-4 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project Watermark / Logo</label>

                  <div className="flex gap-4 items-start">
                    <div className="shrink-0">
                      {!logo ? (
                        <>
                          <input type="file" accept="image/*" id="upload-logo-branding" className="hidden" onChange={handleLogoUpload} />
                          <label htmlFor="upload-logo-branding" className="flex flex-col items-center justify-center w-20 h-20 rounded-lg border border-dashed border-slate-800 bg-slate-950 cursor-pointer hover:bg-slate-900 hover:border-slate-600 transition-colors text-slate-400 group">
                            <Upload size={18} className="mb-1 text-slate-500 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                            <span className="text-[9px] font-bold text-center px-1">Upload</span>
                          </label>
                        </>
                      ) : (
                        <div className="relative w-20 h-20 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center group shadow-md">
                          <img src={logo} className="w-14 h-14 object-contain" alt="" />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setLogo(null)} className="p-1.5 bg-red-950/80 border border-red-500/30 text-red-400 hover:text-red-300 rounded-md transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3.5 py-0.5">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                          <span>Logo Size</span>
                          <span className="font-mono text-blue-400 font-bold">{logoSize}px</span>
                        </div>
                        <input type="range" min="30" max="400" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                          <span>Opacity</span>
                          <span className="font-mono text-blue-400 font-bold">{logoOpacity}%</span>
                        </div>
                        <input type="range" min="10" max="100" value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      </div>
                    </div>
                  </div>

                  {logo && (
                    <button
                      onClick={() => setShowLogoPicker(true)}
                      className="w-full mt-2 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold rounded-lg text-slate-300 flex items-center justify-center gap-2 transition-all hover:border-slate-700"
                    >
                      <Crosshair size={14} className="text-blue-500" />
                      <span>Position Watermark on Screen</span>
                    </button>
                  )}
                </div>

                {/* Transitions Toggle panel */}
                <div className="space-y-3 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      <label className="text-xs font-bold text-slate-200">Cinematic Swap</label>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={enableSpecialAnimation} onChange={(e) => setEnableSpecialAnimation(e.target.checked)} className="sr-only peer" />
                      <div className="w-8 h-4 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-800 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    When active, the 3D phone mockup dynamically spins and swaps sides during scene transitions.
                  </p>
                </div>

              </div>
            )}

            {/* TAB 3: WORKSPACE & ACTIONS PANEL */}
            {activeTab === 'project' && (
              <div className="space-y-5 animate-in fade-in duration-150">

                {/* Exporter actions card */}
                <div className="space-y-3.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Film size={14} className="text-emerald-400 animate-pulse" />
                    <span>Render & Export</span>
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Compile all timeline scenes, watermark logo branding, text animations, and tap effects into a high-quality H.264 MP4 file.
                  </p>
                  <button
                    onClick={handleStartExport}
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-slate-850 disabled:to-slate-850 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-950/40 relative overflow-hidden group hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {isExporting ? (
                      <Loader2 className="animate-spin text-emerald-200" size={16} />
                    ) : (
                      <Film className="group-hover:scale-110 transition-transform text-emerald-200" size={16} />
                    )}
                    <span>Render Video (MP4)</span>
                  </button>
                </div>

                {/* Import / Export local project state backup utilities */}
                <div className="space-y-4 bg-slate-950/30 p-4 rounded-xl border border-slate-800/60">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid size={14} className="text-blue-400" />
                    <span>Project File Utilities</span>
                  </h5>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExport}
                      className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-xl transition-all text-slate-300 hover:text-white"
                      title="Save Project (.zip)"
                    >
                      <Download size={16} className="text-blue-400" />
                      <div className="text-center">
                        <span className="text-[10px] font-bold block">Save Project</span>
                        <span className="text-[8px] text-slate-500 block mt-0.5">Download .zip</span>
                      </div>
                    </button>

                    <label
                      className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-xl transition-all text-slate-300 hover:text-white cursor-pointer"
                      title="Load Project (.zip)"
                    >
                      <Upload size={16} className="text-emerald-400" />
                      <div className="text-center">
                        <span className="text-[10px] font-bold block">Load Project</span>
                        <span className="text-[8px] text-slate-500 block mt-0.5">Upload .zip</span>
                      </div>
                      <input type="file" accept=".zip" className="hidden" onChange={handleImport} />
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60">
                    <button
                      onClick={() => {
                        if (confirm("Reset current project? All settings, text edits, and uploaded assets will be permanently deleted.")) {
                          localStorage.removeItem(STORAGE_KEY);
                          window.location.reload();
                        }
                      }}
                      className="w-full py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all"
                    >
                      Reset Workspace
                    </button>
                  </div>
                </div>

              </div>
            )}

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

      {/* --- EXPORT PROGRESS MODAL --- */}
      {isExporting && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-lg flex flex-col items-center relative shadow-2xl space-y-6">

            {/* Visual Icon Header */}
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center relative">
              {exportPhaseRef.current === 'compiling' ? (
                <Loader2 className="text-blue-400 animate-spin" size={32} />
              ) : (
                <Film className="text-blue-400 animate-pulse" size={32} />
              )}
            </div>

            {/* Status Messages */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white">Generating Your Video</h3>
              <p className="text-sm text-slate-400 font-medium min-h-[40px] max-w-sm flex items-center justify-center">{exportStatus}</p>
            </div>

            {/* Progress Bar & Percent */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-xs font-bold font-mono text-slate-400 px-1">
                <span>PROGRESS</span>
                <span className="text-blue-400">{exportProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>

            {/* Error Message if any */}
            {exportError && (
              <div className="w-full bg-red-950/30 border border-red-500/30 rounded-xl p-4 text-xs text-red-400 leading-relaxed text-center">
                <strong className="block mb-1 font-bold">Error Rendering Video</strong>
                {exportError}
              </div>
            )}

            {/* Actions */}
            <div className="w-full pt-2">
              {exportError ? (
                <button
                  onClick={() => setIsExporting(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-slate-700"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={handleCancelExport}
                  className="w-full py-3 bg-red-900/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-xl font-medium transition-colors border border-red-500/20"
                >
                  Cancel Export
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              Decoupled frame capture is running. Please keep this tab active for optimal performance.
            </p>
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