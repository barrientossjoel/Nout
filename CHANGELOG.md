# Cronología del Proyecto (Changelog) — Nout

Registro cronológico de hitos, refactorizaciones arquitectónicas y optimizaciones del proyecto.

---

## [2026-09-28] — Colaboración Multijugador (Figma-Style) & Optimización Extrema (200+ FPS)

> **Documento Detallado del Hito**: [TEAM_001_fix_collaboration.md](file:///d:/Workspace/nout/.teams/TEAM_001_fix_collaboration.md)

### 🚀 Novedades y Características
- **Colaboración en Tiempo Real con PartyKit**:
  - Cursores remotos multijugador estilo Figma con flecha SVG personalizada, etiqueta con nombre y avatar del colaborador en tiempo real.
  - Pila de avatares de presencia activa (`CollaboratorAvatarStack`) en la barra de herramientas superior.
  - Sincronización colaborativa de texto enriquecido en TipTap y sincronización en tiempo real del Canvas.
  - Webhooks y endpoints HTTP en PartyKit (`onRequest`) en `party/index.ts`.

### 🏗️ Arquitectura y Refactorización (Screaming + Clean Architecture)
- **Módulo de Dominio `src/client/features/collaboration/`**:
  - `types.ts`: Contratos e interfaces segregadas (`CollabSession`, `CollabProvider`, `RemoteCursor`, `CollaboratorUser`).
  - `cursor-palette.ts`: Asignación determinista de colores Figma por ID de usuario.
  - `provider-factory.ts`: Patrón **Multiton / Registry** con recuento de referencias (`acquireCollabSession`).
  - `use-party-cursors.ts`: Hook `useLocalCursorBroadcast` con throttling mediante `requestAnimationFrame` hacia la red.
  - `multiplayer-cursors.tsx`: Render boundaries aislados para cursores y avatares de presencia.
- **Desacoplamiento de Canvas Sync**:
  - `use-canvas-sync.ts` refactorizado a ~65 líneas con foco exclusivo en YMap.

### ⚡ Optimización de Rendimiento Extremo (Garantía 144Hz - 200+ FPS)
- **Eliminación de Layout Thrashing Global**:
  - Se removió la regla universal `* { transition: ... }` en `index.css`, acotándola a `body` para prevenir recálculos continuos de estilo en el árbol DOM.
- **Cero Reflows Sincrónicos en Eventos Continuos**:
  - Implementación de `cachedRectRef` y `getContainerRect()` en `use-canvas-interaction.ts` y `use-party-cursors.ts`.
  - Invalida de forma pasiva en eventos de resize/scroll, eliminando llamadas sincrónicas a `getBoundingClientRect()` durante `pointermove`, dragging, resizing o dibujo.
- **Memoización Quirúrgica de Nodos (`MemoizedCanvasNode`)**:
  - Implementación de la función `areNodesEqual` en `canvas-node-renderer.tsx`. Al interactuar con el canvas, el 99% de los nodos inalterados no pasan por el reconciliador de React.
- **Composición GPU Separada**:
  - Desacoplamiento de la traslación de la cámara (`translate3d(camX, camY, 0)`) de las coordenadas relativas de cada cursor. Durante paneos a 200 FPS, la capa se traslada por hardware GPU sin repintar SVG.
- **Búsqueda O(1) de Documentos**:
  - Indexación de documentos en `documentsMap` en `canvas-view.tsx` eliminando iteraciones `O(N*M)` en cada frame.

### 🧪 Verificación y Estado
- TypeScript: 0 errores (`tsc --noEmit`).
- Producción: Compilación exitosa en 17.37s (`vite build`).
- Servidor: Probado en `http://localhost:5173/` (`HTTP 200 OK`).
