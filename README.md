# 🎬 SaasVidit — Browser Video Editor

[![React](https://img.shields.io/badge/React-18.x-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg?logo=vite)](https://vitejs.dev/)
[![FFmpeg WebAssembly](https://img.shields.io/badge/WebAssembly-FFmpeg.wasm-orange.svg?logo=webassembly)](https://ffmpeg.org/)
[![License-MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A high-performance, client-side **browser video editor** and programmatic video creation studio built using React, TypeScript, and WebAssembly (WASM). 

This tool serves as an all-in-one browser-based suite that allows developers, designers, and content creators to turn HTML, CSS, 3D device mockups, and dynamic typography layers into professional-grade H.264 MP4 videos. By leveraging **FFmpeg WebAssembly** and high-fidelity DOM rasterization, the entire editing, previewing, and rendering process happens **100% locally in the browser**—ensuring absolute privacy, zero server costs, and instant offline compilation.

---

## 🌟 Why Choose a Browser-Based Video Editor?

Traditional cloud-based video generation platforms rely on expensive, resource-heavy backend rendering farms (using headless Chrome, Puppeteer, or server-side FFmpeg). 

Our **in-browser video rendering** engine changes the game:
*   🔒 **100% Private & Secure:** Your screenshots, mockups, logo, and video assets never leave your local machine. No servers, no APIs, and no database exposure.
*   💰 **Zero Hosting Overhead:** Eliminates backend compute bills. The client’s device does all the heavy lifting using WebAssembly threads.
*   ⚡ **Instant Visual Feedback:** Modify font weights, animation timing, scene sequences, and brand colors with real-time responsive previews.

---

## 🚀 Key Features

### 📱 High-Fidelity 3D Device Mockup Previews
*   Fully responsive, interactive 3D phone mockup container.
*   Supports uploading custom screenshots or app interfaces directly to mockup screens.
*   Smooth interactive touch indicators (cursor clicks) that can be mapped to any coordinate on the screen.

### 🎞️ Segmented Multi-Scene Timeline Editor
*   An intuitive, interactive, and beautifully styled video timeline track.
*   Dynamic drag-and-drop or button-based scene reordering.
*   Customizable scene durations with real-time audio-scrubber style feedback.
*   Instant play/pause, restart, and frame-by-frame seeking controls.

### ⚡ Programmatic Animation & Transitions
*   Stunning, fluid cinematic camera moves (leveraging mathematically precise Cubic Bezier easing).
*   Automatic transitions where the mockup rotates and slides dynamically across the canvas between scenes (e.g., alternating layout sides).
*   Synchronized text overlay animations that fade and slide gracefully in harmony with the scene timeline.

### 🎨 Fully Customizable Studio Branding
*   **Typography:** Support for modern fonts (Roboto, Tajawal, etc.) with customizable weights, colors, and line spacing.
*   **Branding Overlay:** Global brand logo watermarking with interactive drag-positioning, custom sizing, and opacity range controls.
*   **Color Themes:** Vibrant gradient backdrops with customizable scene-specific backgrounds.

### 💾 Project Portability & Local Persistence
*   **Auto-Save:** Built-in `localStorage` synchronization auto-saves your progress as you design.
*   **JSON Zip Exports:** Download standard ZIP files containing your full project configuration, configurations, and state.
*   **Import Engine:** Upload previous project ZIPs to restore the workspace instantly.

---

## 🛠️ The Technology Stack

*   **Frontend Framework:** [React 18](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) for highly typed, reliable state management.
*   **Build Utility:** [Vite](https://vitejs.dev/) for ultra-fast Hot Module Replacement (HMR) and optimized compilation.
*   **Styling System:** Modular, highly refined CSS with modern variables, dynamic HSL colors, responsive layouts, glassmorphic UI cards, and sleek dark mode aesthetics.
*   **Video Compilation:** [@ffmpeg/ffmpeg (FFmpeg.wasm)](https://github.com/ffmpegwasm/ffmpeg.wasm) to compile raw frames into a containerized MP4 using standard H.264 encoding.
*   **DOM Rasterization:** [modern-screenshot](https://github.com/qq1010903229/modern-screenshot) to capture raw DOM nodes into high-resolution, uncompressed PNG arrays.
*   **Icons:** [Lucide React](https://lucide.dev/) for crisp, scalable layout indicators.
*   **Zip Bundler:** [JSZip](https://stuk.github.io/jszip/) for project compression, storage, and importing.

---

## 🧬 How the Browser Video Renderer Works (Under the Hood)

This application uses a deterministic **DOM-to-video compilation pipeline**:


1.  **WebAssembly Initialization:** The editor loads the `~30MB` WebAssembly-compiled version of FFmpeg via an unpkg CDN, establishing a virtual sandboxed filesystem directly inside a web worker.
2.  **Deterministic Frame Capturing:** The exporter stops live playback, loops over the timeline from frame `0` to the last frame, and uses `modern-screenshot` to freeze the DOM container at a forced 1920x1080 resolution.
3.  **WASM Storage:** Every captured frame is stored inside the FFmpeg WASM sandboxed filesystem as sequential PNG files (`frame_0.png`, `frame_1.png`, etc.).
4.  **H.264 MP4 Compilation:** When all frames are successfully snapshot, the FFmpeg WASM CLI execution is triggered:
    ```bash
    ffmpeg -r 30 -i frame_%d.png -c:v libx264 -pix_fmt yuv420p -y output.mp4
    ```
5.  **Local Download:** The compiled MP4 is read from the WASM virtual filesystem, converted into an in-memory `Blob`, and downloaded instantly by the browser. The temporary filesystem files are deleted to prevent memory leaks in the browser tab.

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed.

### ⚙️ Installation & Local Development
1.  Clone the repository to your local computer:
    ```bash
    git clone https://github.com/sofiz/saasvidit.git
    cd saasvidit
    ```
2.  Install the required dependencies:
    ```bash
    npm install
    ```
3.  Run the local development server:
    ```bash
    npm run dev
    ```
4.  Open your browser and navigate to `http://localhost:5173`.

### 📦 Building for Production
To build a highly optimized production bundle of the browser-based video editor:
```bash
npm run build
```
This outputs a static web app directory (`dist/`) that can be hosted instantly on free serverless platforms like Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

> [!IMPORTANT]
> Because WebAssembly relies on shared memory buffers for multithreading, your production web server **must** headers set to enable Cross-Origin Isolation:
> *   `Cross-Origin-Opener-Policy: same-origin`
> *   `Cross-Origin-Embedder-Policy: require-corp`


## ⚡ Performance Optimization Tips

Working with client-side video processing requires careful resource management:
*   **Asset Sizes:** Use highly compressed PNG or WebP images in your scene screenshot slots to keep `localStorage` lightweight and prevent browser memory exceptions.
*   **Resolution Targets:** High-definition video export defaults to full `1920x1080`. For quicker test compiles, you can decrease the export sizing in `src/utils/videoExporter.ts`.
*   **Garbage Collection:** The pipeline calls `cleanupFSDirectory` automatically on complete/cancel commands, releasing precious WASM stack allocations back to your system.

---

## 📄 License
This project is open-source software licensed under the [MIT License](LICENSE).
