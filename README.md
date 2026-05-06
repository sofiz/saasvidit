# Programmatic Video Studio

A browser-based video editor for creating animated product showcase videos with a 3D phone mockup. Upload app screenshots, add titles, and export a ready-to-use project — all without leaving the browser.

## Features

- **Multi-scene editor** — add, remove, and reorder scenes, each with its own title, subtitle, screenshot, and duration
- **3D phone mockup** — a fully 3D-extruded iPhone-style device rendered in CSS/Three.js, with animated floating and rotation
- **Special animation mode** — cinematic scene transitions where the phone swings side-to-side and text slides in from the opposite direction
- **Touch animation overlay** — place a tap indicator on any scene to highlight a specific point on the screenshot
- **Branding logo** — upload a logo, position it anywhere on the canvas, and control its size and opacity
- **Font & color controls** — choose font family (Roboto or Tajawal), weight, and color for title and subtitle text
- **Fullscreen preview** — one-click fullscreen playback mode
- **Auto-save** — project state is automatically persisted to `localStorage`
- **Export / Import** — save your project as a `.zip` file and reload it at any time

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| 3D / WebGL | Three.js, @react-three/fiber, @react-three/drei |
| Icons | lucide-react |
| Zip export | JSZip |

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

The output is written to `dist/`.

### Preview the production build

```bash
npm run preview
```

## Project Structure

```
src/
├── App.tsx              # Main editor — state, animation pipeline, UI
├── components/
│   └── PhoneMockup.tsx  # 3D CSS phone with screen and touch overlays
├── assets/              # Static assets
├── App.css              # Global animation styles
├── index.css            # Tailwind base styles
└── main.tsx             # React entry point
```

## Usage

1. **Add scenes** using the **+** button in the sidebar. Each scene represents one "slide" of the video.
2. **Upload a screenshot** for each scene. The image is displayed inside the phone screen.
3. **Edit the title and subtitle** text, choose a font, and pick colors.
4. **Set the duration** (in seconds) for how long each scene plays.
5. *(Optional)* Enable **Special Animation** for cinematic transitions between scenes.
6. *(Optional)* Upload a **brand logo** and drag it to your preferred position on the canvas.
7. *(Optional)* Add a **touch animation** to highlight an interaction point on a scene's screenshot.
8. Click **Fullscreen Preview** to watch the full animation.
9. Use **Export** to save the project as a `.zip`, and **Import** to restore it later.

## Linting

```bash
npm run lint
```
