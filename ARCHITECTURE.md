# "Graphic-Tools" Web App Architecture

This document describes in detail the architecture, technologies, and structure of the **Graphic-Tools** web app (created by Fler Design Studio).

## 1. Tech Stack

The application is built with a modern but lightweight approach, without the use of complex frameworks like React or Vue, preferring Vanilla JS and native web standards.

*   **Vite**: Used as a bundler and local development server. Vite offers lightning-fast startup and instant Hot Module Replacement (HMR). It compiles native ES modules and handles assets (CSS, images, etc.) efficiently for production.
*   **Vanilla JavaScript (ES Modules)**: The logic of the application and the individual tools is written in pure JavaScript, leveraging ECMAScript modules for encapsulation and code organization.
*   **CSS (Vanilla)**: Styling is managed through a global CSS file (`src/styles/global.css`), which includes CSS variables for theming, flexible layouts (Flexbox/Grid), and styles for the "glass" style user interface (Glassmorphism/Floating Panels).
*   **Motion**: Used for smooth transition animations between one tool and another (e.g., fade-in, fade-out of panels). It is the lightweight Vanilla JS version of the famous Framer Motion library.
*   **HTML5 Canvas & SVG**: The visual core of the tools uses the `<canvas>` element for high-performance rendering of generative graphics (such as Chladni figures or waveforms), with support also for vector export in SVG.

## 2. Layout Structure (UI)

The user interface is defined in `index.html` and follows a "layers" pattern:

1.  **Canvas Container (`#tool-main-container`)**: A fullscreen container (bottom layer) where the various tools inject and render their graphical elements (e.g., the canvas).
2.  **Floating UI Layer (`.floating-ui-layer`)**: An overlay top layer that contains the floating panels of the interface. These panels include:
    *   **Branding & Info**: Top left (logo, suite title).
    *   **Settings Panel (`#tool-sidebar-container`)**: The left sidebar where each tool dynamically injects its own controls (sliders, buttons, inputs).
    *   **Navigation Bar (`#app-navigation`)**: Top center. Contains buttons to switch from one tool to another (dynamically generated).
    *   **Export Controls**: Bottom right, buttons to export work to PNG or SVG.
    *   **Fullscreen Toggle**: Top right.

## 3. "Tool" Architecture (Modular Components)

The heart of the architecture is its registration and loading system for **Tools** (graphic instruments). The app is designed to be easily expandable.

### The Central Registry (`src/app.js`)
`app.js` acts as an orchestrator. Its main responsibilities are:
*   **Tool Registry**: Imports the various tools (Chladni, Hydrogen, Oscilloscope) and maps them into an object (the registry).
*   **Lifecycle Management**: Handles loading the requested tool via the `loadTool()` function.
    *   Calls the `destroy()` method of the current tool to clean up events and DOM.
    *   Animates the exit of old panels and the entry of new ones using `motion`.
    *   Calls the `init(sidebarContainer, mainContainer)` method of the new tool to generate its interface and graphical canvas.
*   **Global Management**: Manages cross-cutting features like Fullscreen mode and routing export events (PNG/SVG) to the specific methods of the active tool (`_visualizer.exportToPNG`, `_visualizer.exportToSVG`).

### The Structure of a Tool (`src/tools/<tool-name>/`)
Each tool resides in its own independent folder and must expose a standard interface that the orchestrator (`app.js`) can call. Generally, a tool exports:
*   `id`: Unique identifier of the tool.
*   `label`: The readable name shown in the navigation bar.
*   `icon`: The icon of the tool (e.g., a Material Design symbol).
*   `init(sidebarContainer, mainContainer)`: The method called when the tool is selected. Here the tool injects its HTML into the sidebar for controls and into the main container for the graphical canvas. It also sets up event listeners.
*   `destroy()`: The method called when the user changes tools. It is used to stop animations (e.g., `requestAnimationFrame`), remove listeners, and clean up the DOM.

*(Current examples of implemented tools: `chladni`, `hydrogen`, `oscilloscope`)*

## 4. Execution Flow (Runtime)

1.  **Startup**: Vite serves the application and loads `index.html`.
2.  **Initialization**: `src/app.js` is executed. It builds the navigation bar by iterating over the `tools` object.
3.  **Initial Load**: `loadTool(chladniTool.id)` is called to load the default tool.
4.  **Interaction**: The user changes settings in the sidebar; the internal logic of the tool reacts and updates the canvas in real-time.
5.  **Tool Switch**: The user clicks a button in the navigation. The application executes the teardown (`destroy()`) of the current tool, resets the DOM via fading animations, and executes the setup (`init()`) of the newly chosen tool.
6.  **Export**: Clicking Export, the global event detects the active tool and invokes its specific export methods, delegating to the tool the serialization of its own graphics.

## 5. File System Overview

```text
Graphic-Tools/
├── package.json           # Dependencies (vite, motion) and scripts (dev, build)
├── index.html             # Shell layout and inclusion of main scripts
├── src/
│   ├── app.js             # Orchestrator, routing, and global logic of the app
│   ├── Assets/            # Images, logos, and static resources
│   ├── styles/
│   │   └── global.css     # Global styles, layered layout, theming (glass)
│   └── tools/             # Modules for individual instruments
│       ├── chladni/       # Logic and UI for Chladni figure generation
│       ├── hydrogen/      # Logic and UI for Hydrogen atomic orbital
│       └── oscilloscope/  # Logic and UI for the oscilloscope
```
