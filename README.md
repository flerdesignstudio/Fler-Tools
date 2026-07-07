# Graphic-Tools

<p align="center">
  <img src="src/Assets/Fler_Logo.svg" alt="Fler Logo" width="64" height="64"><br>
  <em>An open source graphic toolkit, make the best of it.</em>
</p>

## What the project does

**Graphic-Tools** is a web-based suite of generative and visual tools designed for artists, designers, and developers. Built by Fler Design Studio, it provides interactive, high-performance web interfaces to explore mathematical and physical phenomena graphically.

Current tools include:
- **Chladni Plate Simulator**: Visualize Chladni resonance patterns.
- **Hydrogen Orbitals**: Explore atomic orbital shapes.
- **Oscilloscope**: Visualize waveforms and frequencies.

Features:
- Real-time parameter tweaking.
- Export capabilities (PNG & SVG) for use in your design workflows.
- Smooth, hardware-accelerated animations using Canvas and modern web APIs.

## Why the project is useful

Generative design often requires complex setups or expensive software. Graphic-Tools provides an accessible, browser-based alternative that is entirely open source. It serves as both a practical toolkit for creating unique visual assets and an educational resource for understanding the underlying math and physics of the visualizations. The vanilla JS, modular architecture also makes it exceptionally easy for developers to add their own custom tools.

## How to get started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/flerdesignstudio/Graphic-Tools.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Graphic-Tools
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to the local server URL provided in the terminal (usually `http://localhost:5173`).

### Building for Production
To create an optimized, production-ready build:
```bash
npm run build
```

## Where to get help

If you encounter any issues, have questions, or want to suggest new features:
- Open an issue on our [GitHub Issues](https://github.com/flerdesignstudio/Graphic-Tools/issues) page.
- For a deep dive into the technical structure of the app, refer to the [ARCHITECTURE.md](./ARCHITECTURE.md) file included in the repository.

## Who maintains and contributes

Graphic-Tools is actively maintained by **Fler Design Studio**.

Contributions are highly encouraged! If you'd like to add a new tool, fix a bug, or improve documentation:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-new-tool`).
3. Commit your changes (`git commit -m 'Add amazing new tool'`).
4. Push to the branch (`git push origin feature/amazing-new-tool`).
5. Open a Pull Request.

## License

This project is licensed under the [MIT License](./LICENSE).
