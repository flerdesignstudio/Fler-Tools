# Architettura della Web App "Graphic-Tools"

Questo documento descrive in dettaglio l'architettura, le tecnologie e la struttura della web app **Graphic-Tools** (creata da Fler Design Studio).

## 1. Stack Tecnologico

L'applicazione è costruita con un approccio moderno ma leggero, senza l'uso di framework complessi come React o Vue, preferendo Vanilla JS e standard web nativi.

*   **Vite**: Utilizzato come bundler e server di sviluppo locale. Vite offre un avvio rapidissimo e un Hot Module Replacement (HMR) istantaneo. Compila i moduli ES nativi e gestisce gli asset (CSS, immagini, ecc.) in modo efficiente per la produzione.
*   **Vanilla JavaScript (ES Modules)**: La logica dell'applicazione e dei singoli tool è scritta in JavaScript puro, sfruttando i moduli ECMAScript per l'incapsulamento e l'organizzazione del codice.
*   **CSS (Vanilla)**: Lo styling è gestito tramite un file CSS globale (`src/styles/global.css`), che include variabili CSS per il theming, layout flessibili (Flexbox/Grid) e stili per l'interfaccia utente in stile "vetro" (Glassmorphism/Floating Panels).
*   **Motion**: Utilizzata per le animazioni fluide di transizione tra un tool e l'altro (es. fade-in, fade-out dei pannelli). È la versione leggera in Vanilla JS della famosa libreria Framer Motion.
*   **HTML5 Canvas & SVG**: Il core visivo dei tool utilizza l'elemento `<canvas>` per il rendering ad alte prestazioni di grafiche generative (come le figure di Chladni o le forme d'onda), con supporto anche per l'esportazione vettoriale in SVG.

## 2. Struttura del Layout (UI)

L'interfaccia utente è definita in `index.html` e segue un pattern a "livelli" (layers):

1.  **Canvas Container (`#tool-main-container`)**: Un contenitore a tutto schermo (livello inferiore) in cui i vari tool iniettano e renderizzano i propri elementi grafici (es. il canvas).
2.  **Floating UI Layer (`.floating-ui-layer`)**: Un livello superiore in sovraimpressione che contiene i pannelli fluttuanti dell'interfaccia. Questi pannelli includono:
    *   **Branding & Info**: In alto a sinistra (logo, titolo della suite).
    *   **Settings Panel (`#tool-sidebar-container`)**: La sidebar a sinistra dove ogni tool inietta dinamicamente i propri controlli (slider, pulsanti, input).
    *   **Navigation Bar (`#app-navigation`)**: Al centro in alto. Contiene i pulsanti per passare da un tool all'altro (generati dinamicamente).
    *   **Export Controls**: In basso a destra, pulsanti per esportare il lavoro in PNG o SVG.
    *   **Fullscreen Toggle**: In alto a destra.

## 3. Architettura a "Tool" (Componenti Modulari)

Il cuore dell'architettura è il suo sistema di registrazione e caricamento dei **Tool** (strumenti grafici). L'app è progettata per essere facilmente espandibile.

### Il Registry Centrale (`src/app.js`)
`app.js` funge da orchestratore. Le sue responsabilità principali sono:
*   **Tool Registry**: Importa i vari tool (Chladni, Hydrogen, Oscilloscope) e li mappa in un oggetto (il registry).
*   **Lifecycle Management**: Gestisce il caricamento del tool richiesto tramite la funzione `loadTool()`.
    *   Chiama il metodo `destroy()` del tool corrente per ripulire eventi e DOM.
    *   Anima l'uscita dei pannelli vecchi e l'entrata di quelli nuovi usando `motion`.
    *   Chiama il metodo `init(sidebarContainer, mainContainer)` del nuovo tool affinché generi la sua interfaccia e il suo canvas.
*   **Gestione Globale**: Gestisce funzionalità trasversali come la modalità Fullscreen e il routing degli eventi di esportazione (PNG/SVG) verso i metodi specifici del tool attivo (`_visualizer.exportToPNG`, `_visualizer.exportToSVG`).

### La struttura di un Tool (`src/tools/<nome-tool>/`)
Ogni tool risiede in una propria cartella indipendente e deve esporre un'interfaccia standard che l'orchestratore (`app.js`) può chiamare. Generalmente un tool esporta:
*   `id`: Identificativo univoco del tool.
*   `label`: Il nome leggibile mostrato nella barra di navigazione.
*   `icon`: L'icona del tool (es. un simbolo Material Design).
*   `init(sidebarContainer, mainContainer)`: Il metodo chiamato quando il tool viene selezionato. Qui il tool inietta il suo HTML nella sidebar per i controlli e nel main container per il canvas grafico. Imposta inoltre i listener per gli eventi.
*   `destroy()`: Il metodo chiamato quando l'utente cambia tool. Serve a fermare le animazioni (es. `requestAnimationFrame`), rimuovere i listener e pulire il DOM.

*(Esempi attuali di tool implementati: `chladni`, `hydrogen`, `oscilloscope`)*

## 4. Flusso di Esecuzione (Runtime)

1.  **Avvio**: Vite serve l'applicazione e carica `index.html`.
2.  **Inizializzazione**: Viene eseguito `src/app.js`. Costruisce la barra di navigazione ciclando l'oggetto `tools`.
3.  **Caricamento Iniziale**: Viene chiamato `loadTool(chladniTool.id)` per caricare il tool di default.
4.  **Interazione**: L'utente cambia le impostazioni nella sidebar; la logica interna del tool reagisce e aggiorna il canvas in tempo reale.
5.  **Cambio Tool**: L'utente clicca un pulsante nella navigazione. L'applicazione esegue il teardown (`destroy()`) del tool attuale, resetta il DOM tramite animazioni di fading, ed esegue il setup (`init()`) del nuovo tool scelto.
6.  **Esportazione**: Cliccando su Export, l'evento globale rileva il tool attivo e ne invoca i metodi di esportazione specifici, delegando al tool la serializzazione della propria grafica.

## 5. Riepilogo File System

```text
Graphic-Tools/
├── package.json           # Dipendenze (vite, motion) e script (dev, build)
├── index.html             # Layout shell e inclusione script principali
├── src/
│   ├── app.js             # Orchestratore, routing e logica globale dell'app
│   ├── Assets/            # Immagini, loghi e risorse statiche
│   ├── styles/
│   │   └── global.css     # Stili globali, layout a livelli, theming (vetro)
│   └── tools/             # Moduli dei singoli strumenti
│       ├── chladni/       # Logica e UI per la generazione di figure di Chladni
│       ├── hydrogen/      # Logica e UI per orbitale atomico Hydrogen
│       └── oscilloscope/  # Logica e UI per l'oscilloscopio
```
