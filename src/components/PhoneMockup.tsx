import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

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
}

const PhoneMockup: React.FC<PhoneMockupProps> = ({
  scenes,
  frame,
  sceneTimings,
  currentPhoneX,
  phoneRotationY,
  enableSpecialAnimation,
  interpolate
}) => {
  return (
    <div
      className="absolute top-1/2 left-1/2 z-10 phone-wrapper"
      style={{
        perspective: '1200px',
        transform: `translate(calc(-50% + ${currentPhoneX}vw), -50%)`
      }}
    >
      {/* Floating & 360 Spin Wrapper */}
      <div className="animate-float" style={{ transformStyle: 'preserve-3d' }}>
        <div style={{ transform: `rotateY(${phoneRotationY}deg)`, transformStyle: 'preserve-3d' }}>
          {/* Dynamic 3D Shadow */}
          <div className="phone-shadow"></div>

          {/* True 3D Extruded Phone Asset */}
          <div className="w-[270px] h-[550px] phone-mockup-3d relative flex flex-col" style={{ transformStyle: 'preserve-3d' }}>

            {/* Middle Edge Layers for 3D Extrusion (Thickness) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`slice-${i}`}
                className="absolute inset-0 bg-[#1a1a1a] rounded-[45px] border border-[#333333]/30 pointer-events-none"
                style={{ transform: `translateZ(${12 - (i * 2)}px)` }}
              />
            ))}

            {/* Hardware Buttons attached to center plane */}
            <div className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(0px)' }}>
              <div className="absolute -left-1.5 top-24 w-1.5 h-8 bg-[#2a2a2a] rounded-l-md border-y border-l border-[#111111] shadow-inner"></div>
              <div className="absolute -left-1.5 top-36 w-1.5 h-12 bg-[#2a2a2a] rounded-l-md border-y border-l border-[#111111] shadow-inner"></div>
              <div className="absolute -left-1.5 top-52 w-1.5 h-12 bg-[#2a2a2a] rounded-l-md border-y border-l border-[#111111] shadow-inner"></div>
              <div className="absolute -right-1.5 top-40 w-1.5 h-16 bg-[#2a2a2a] rounded-r-md border-y border-r border-[#111111] shadow-inner"></div>
            </div>

            {/* Back Face (Camera & Logo) */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#222222] to-[#0a0a0a] rounded-[45px] border-[3px] border-[#1a1a1a] shadow-2xl"
              style={{ transform: `translateZ(-14px) rotateY(180deg)`, transformStyle: 'preserve-3d' }}
            >
              {/* Apple Logo SVG */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#555555] opacity-60">
                <svg viewBox="0 0 512 512" fill="currentColor" className="w-14 h-14">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.3 48.6-.8 90.5-84.4 103-118.4-45.2-18.2-62.7-59.5-62.1-92.2zM266.4 88.8c31.1-39.8 46.2-70.8 44.4-106-25.9 2.1-59 17.6-80 39.5-22.3 23.3-39.7 54.4-36.6 88.6 28.6 2.4 57.5-11.8 72.2-22.1z" />
                </svg>
              </div>

              {/* iPhone Pro Camera Bump - 3D Stacked Base */}
              <div className="absolute top-4 left-4 w-[135px] h-[140px]" style={{ transformStyle: 'preserve-3d' }}>
                {/* Extruded base layers */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`bump-layer-${i}`}
                    className={`absolute inset-0 bg-[#151515] rounded-[36px] border border-white/5 ${i === 0 ? 'shadow-[4px_4px_12px_rgba(0,0,0,0.5)]' : ''}`}
                    style={{ transform: `translateZ(${i * 1}px)` }}
                  />
                ))}

                {/* Main Bump Surface */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-[#2a2a2a] to-[#111111] rounded-[36px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] border border-[#333333]/40"
                  style={{ transform: 'translateZ(6px)', transformStyle: 'preserve-3d' }}
                >
                  {/* Top Left Lens */}
                  <div className="absolute top-2.5 left-2.5 w-[52px] h-[52px]" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`lens-1-layer-${i}`}
                        className="absolute inset-0 rounded-full bg-[#111] border border-[#222]"
                        style={{ transform: `translateZ(${i * 1}px)` }}
                      />
                    ))}
                    <div
                      className="absolute inset-0 rounded-full bg-black border-[3.5px] border-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center"
                      style={{ transform: 'translateZ(4px)', transformStyle: 'preserve-3d' }}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#111] relative flex items-center justify-center overflow-hidden" style={{ transform: 'translateZ(1px)' }}>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/5 to-transparent opacity-30"></div>
                        <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-gray-800 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-slate-900 shadow-[0_0_8px_rgba(30,41,59,0.8)]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Left Lens */}
                  <div className="absolute bottom-2.5 left-2.5 w-[52px] h-[52px]" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`lens-2-layer-${i}`}
                        className="absolute inset-0 rounded-full bg-[#111] border border-[#222]"
                        style={{ transform: `translateZ(${i * 1}px)` }}
                      />
                    ))}
                    <div
                      className="absolute inset-0 rounded-full bg-black border-[3.5px] border-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center"
                      style={{ transform: 'translateZ(4px)', transformStyle: 'preserve-3d' }}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#111] relative flex items-center justify-center overflow-hidden" style={{ transform: 'translateZ(1px)' }}>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/5 to-transparent opacity-30"></div>
                        <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-gray-800 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-slate-900 shadow-[0_0_8px_rgba(30,41,59,0.8)]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Right Lens */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-6 w-[52px] h-[52px]" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`lens-3-layer-${i}`}
                        className="absolute inset-0 rounded-full bg-[#111] border border-[#222]"
                        style={{ transform: `translateZ(${i * 1}px)` }}
                      />
                    ))}
                    <div
                      className="absolute inset-0 rounded-full bg-black border-[3.5px] border-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center"
                      style={{ transform: 'translateZ(4px)', transformStyle: 'preserve-3d' }}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#111] relative flex items-center justify-center overflow-hidden" style={{ transform: 'translateZ(1px)' }}>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/5 to-transparent opacity-30"></div>
                        <div className="w-4 h-4 rounded-full bg-[#0a0a0a] border border-gray-800 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-slate-900 shadow-[0_0_8px_rgba(30,41,59,0.8)]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flash */}
                  <div className="absolute top-3 right-8 w-6 h-6" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={`flash-layer-${i}`}
                        className="absolute inset-0 rounded-full bg-[#1a1a1a] border border-white/5"
                        style={{ transform: `translateZ(${i * 1}px)` }}
                      />
                    ))}
                    <div
                      className="absolute inset-0 rounded-full bg-[#fff5eb] border border-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.4),_inset_0_0_6px_rgba(255,255,255,0.8)] flex items-center justify-center"
                      style={{ transform: 'translateZ(3px)' }}
                    >
                      <div className="w-3 h-3 rounded-full bg-yellow-200 opacity-90 blur-[1px]"></div>
                    </div>
                  </div>

                  {/* LiDAR / Sensor */}
                  <div className="absolute bottom-3 right-8 w-6 h-6" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={`lidar-layer-${i}`}
                        className="absolute inset-0 rounded-full bg-[#0a0a0a] border border-white/5"
                        style={{ transform: `translateZ(${i * 1}px)` }}
                      />
                    ))}
                    <div
                      className="absolute inset-0 rounded-full bg-[#111] border border-[#333] shadow-[inset_0_0_4px_#000] flex items-center justify-center"
                      style={{ transform: 'translateZ(2px)' }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                    </div>
                  </div>

                  {/* Mic hole */}
                  <div
                    className="absolute bottom-9 translate-y-1/2 right-5 w-2 h-2 rounded-full bg-[#111] shadow-[inset_0_0_2px_#000]"
                    style={{ transform: 'translateZ(1px)' }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Front Face (Screen UI) */}
            <div
              className="absolute inset-0 bg-black rounded-[45px] p-[6px] flex flex-col overflow-hidden"
              style={{ transform: `translateZ(14px)`, backfaceVisibility: 'hidden' }}
            >
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-50 flex items-center justify-end px-3 border border-slate-800/80 shadow-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-900/60 shadow-[0_0_6px_rgba(16,185,129,0.4)]"></div>
              </div>

              {/* Screen Glare */}
              <div className="absolute inset-0 screen-glare pointer-events-none z-40 mix-blend-screen"></div>

              {/* Dynamic Screens with Border */}
              <div className="absolute inset-[4px] bg-slate-950 z-10 rounded-[41px] overflow-hidden border border-slate-800/50 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                {scenes.map((scene, idx) => {
                  const timing = sceneTimings[idx] || { S: 0, E: 120 };
                  const { S, E } = timing;
                  const switchOffset = enableSpecialAnimation ? 15 : 0;
                  const isVisible = frame >= (idx === 0 ? 0 : S + switchOffset) && 
                                    frame < (idx === scenes.length - 1 ? 999999 : E + switchOffset);

                  return (
                    <div
                      key={`img-${scene.id}`}
                      className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
                      style={{ opacity: isVisible ? 1 : 0 }}
                    >
                      {scene.image ? (
                        <img src={scene.image} alt={scene.title} className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                          <ImageIcon size={48} className="mb-4 opacity-50" />
                          <p className="text-[10px] font-medium">Empty Screen</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Touch Animation Overlay */}
                <div className="absolute inset-0 z-50 pointer-events-none">
                  {scenes.map((scene, idx) => {
                    const timing = sceneTimings[idx] || { S: 0, E: 120 };
                    const { S, E } = timing;
                    const touchStart = E - Math.min(30, (E - S) / 2);
                    const touchEnd = E;
                    const touchOpacity = interpolate(frame, [touchStart, touchStart + 5, touchEnd - 5, touchEnd], [0, 0.8, 0.8, 0]);
                    const touchScale = interpolate(frame, [touchStart, touchStart + 10, touchStart + 15], [1.5, 0.8, 0.8]);
                    const rippleScale = interpolate(frame, [touchStart + 10, touchStart + 25], [0.8, 2.5]);
                    const rippleOpacity = interpolate(frame, [touchStart + 10, touchStart + 25], [0.6, 0]);

                    if (!scene.showTouch || frame < touchStart || frame > touchEnd) return null;

                    return (
                      <div
                        key={`touch-${scene.id}`}
                        className="absolute pointer-events-none"
                        style={{ left: `${scene.touchX}%`, top: `${scene.touchY}%` }}
                      >
                        <div className="absolute w-12 h-12 bg-white/40 backdrop-blur-sm rounded-full border-2 border-white shadow-lg" style={{ transform: `translate(-50%, -50%) scale(${touchScale})`, opacity: touchOpacity }} />
                        <div className="absolute w-12 h-12 bg-white rounded-full" style={{ transform: `translate(-50%, -50%) scale(${rippleScale})`, opacity: rippleOpacity }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMockup;
