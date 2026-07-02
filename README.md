# SaasVidit

SaasVidit is an open-source video editor for creating polished product showcase videos inside an iPhone mockup. It is designed for mobile apps, websites, onboarding demos, "how to use this app" videos, launch clips, and short product walkthroughs made from screenshots, scene titles, and descriptions.

Upload screenshots, write the message for each scene, add your branding, preview the full timeline, and export the final result as an MP4 video directly from the browser.

You can use SaasVidit directly at [saasvidit.netlify.app](https://saasvidit.netlify.app).

## Features

- **iPhone mockup showcase**: Present app or website screenshots inside a cinematic 3D phone mockup.
- **Scene-based editor**: Create multiple scenes, edit titles and descriptions, set scene durations, and reorder the storyboard.
- **Cinematic swap animation**: Enable a phone-flip transition that swaps the phone position between scenes for a more dynamic video.
- **Branding controls**: Upload a logo or watermark, position it on the canvas, and adjust size and opacity.
- **Custom typography**: Choose fonts, weights, and colors for each scene title and description.
- **Touch highlights**: Add tap/cursor hotspots to screenshots to explain user actions.
- **Timeline preview**: Play, pause, scrub, reset, and fullscreen-preview the video before exporting.
- **Project save and import**: Save your work as a ZIP project file and import it later to continue editing.
- **MP4 export**: Render the timeline to a high-quality H.264 MP4 using browser-based FFmpeg.

## Use Cases

- App onboarding and feature tutorials
- Website or SaaS product walkthroughs
- App Store, Play Store, and social media preview videos
- Customer support explainers
- Founder-led product demos
- Internal product release clips

## Tech Stack

- React
- TypeScript
- Vite
- Three.js / React Three Fiber
- FFmpeg WASM
- JSZip
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## How It Works

1. Add one or more scenes.
2. Upload a screenshot for each scene.
3. Write a title and description.
4. Adjust scene duration, text styling, and optional touch highlights.
5. Add your logo or watermark in the branding panel.
6. Enable cinematic swap if you want dynamic phone-flip transitions.
7. Reorder scenes in the storyboard until the story feels right.
8. Save the project as a ZIP if you want to continue later.
9. Export the final video as an MP4.

## Project Files

Saved projects are exported as `.zip` files containing the project data. You can import the ZIP back into SaasVidit to restore scenes, screenshots, text, branding, durations, and animation settings.

## Video Export

SaasVidit renders each frame from the browser preview and compiles the final video with FFmpeg WASM. The exported file is downloaded as an `.mp4` video.

Because rendering happens in the browser, export speed depends on your device, browser, scene count, image size, and video duration.

## Contributing

Contributions are welcome. You can help by fixing bugs, improving the editor experience, adding export options, polishing animations, improving accessibility, or expanding documentation.

Before opening a pull request:

```bash
npm run lint
npm run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
