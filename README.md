# SaasVidit

SaasVidit is an open-source motion studio that turns app screenshots into polished product showcase videos. A real 3D iPhone moves with every tap, the camera pushes in on what matters, the copy animates and moves out of the way, and the result is exported as an MP4 straight from your browser.

Use it for launch videos, App Store and Play Store previews, onboarding walkthroughs, feature announcements, and social clips.

You can use SaasVidit directly at [saasvidit.netlify.app](https://saasvidit.netlify.app).

## Features

- **Camera that follows the action**: add taps, long-presses or scroll gestures to any screenshot. The device glides and zooms so the touched spot is framed, leans toward it, and shows a touch ripple. The headline drifts aside and dims, and an optional callout label points at the spot.
- **Click to place interactions**: click the phone in the live preview (Motion tab) or the screen editor to add a tap at the playhead. Drag markers on the screen or along the timeline to adjust them.
- **Scrolling screens**: drop a tall, full-page screenshot and a scroll gesture scrolls through it with inertia.
- **Scene transitions**: Glide, Flip (a 360° spin that swaps the screen while the back faces the camera), Push (in-app navigation), Dive (zoom through the screen) and Drop.
- **Camera moves**: Float, Orbit, Tilt, Dolly or Static idle motion per scene, blended smoothly across cuts.
- **Kinetic typography**: Rise, Blur, Pop, Typewriter and Slide animations, an eyebrow label, and `*highlighted*` words with an animated marker and gradient. Text auto-fits its box; Arabic and Hebrew copy is laid out right-to-left.
- **Intro and outro**: title card with your logo, and a call-to-action outro with an animated button.
- **Themes and backgrounds**: eight presets plus animated aurora, mesh, spotlight, retro grid, gradient and studio backdrops, with particles, film grain, vignette and device glow.
- **Every format**: 16:9, 9:16, 1:1 and 4:5. Layouts adapt automatically (phone left, right or hero).
- **Sound design**: synthesized tap clicks, whooshes and chimes timed to the animation, plus an optional music track with automatic fades.
- **Fast, high-quality export**: hardware H.264 encoding via WebCodecs at 720p up to 4K and 30 or 60 fps, with optional cinematic motion blur and an AAC soundtrack. Browsers without WebCodecs fall back to FFmpeg WebAssembly.
- **Editor comforts**: timeline with draggable scene durations and gesture markers, undo/redo, autosave to IndexedDB, `.zip` project files, a built-in demo project, and keyboard shortcuts.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| ← / → | Step one frame (hold Shift for one second) |
| Home / End | Jump to start / end |
| ⌘Z / ⌘⇧Z | Undo / redo |
| Delete | Remove the selected interaction |

## Tech stack

- React 19 and TypeScript
- Vite and Tailwind CSS
- Three.js for the device (GLB model with Draco compression)
- Canvas 2D for compositing, backgrounds and typography
- WebCodecs and `mp4-muxer` for export, FFmpeg WASM as a fallback
- Web Audio for sound design
- JSZip for project files

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. A demo project ("Pulse") loads on first run; use **Project → New blank** to start from scratch.

```bash
npm run build     # production build
npm run preview   # serve the production build
```

## How it works

Everything in the video is a pure function of time, so the preview, scrubbing and export always show the same frame.

1. `src/engine/plan.ts` turns the project into a plan: segments (intro, scenes, outro), transitions, and animation tracks for the device pose. Tracks are driven by damped springs whose step responses are superimposed, so overlapping moves blend physically but any instant can still be evaluated directly.
2. `src/engine/compositor.ts` renders a frame: background → device glow → copy → the 3D phone (rendered by `device.ts`, its screen painted by `screen.ts`) → callouts → logo and progress → grain.
3. `src/engine/exporter.ts` renders every frame (optionally averaging sub-frames for motion blur), encodes it with WebCodecs and muxes video and audio into an MP4.

```
src/
  engine/   rendering, animation planning, audio and export (framework-free)
  editor/   React UI: preview, timeline, scene rail, inspector, export dialog
  App.tsx   editor shell, selection and shortcuts
```

## Project files

**Project → Save .zip** downloads a project file with your screenshots, copy, styling and audio. Projects saved by the previous version of SaasVidit can still be opened and are converted automatically.

## Contributing

Contributions are welcome — new transitions, device models, backgrounds, text animations or export options are all great places to start.

Before opening a pull request:

```bash
npm run lint
npm run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
