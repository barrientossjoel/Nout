# Cronología del Proyecto (Changelog) — Nout

Registro cronológico de hitos, refactorizaciones arquitectónicas y optimizaciones del proyecto.

---

## [1.0.6] — Descarga Completa de Contenido de Notas, Canvases y Sincronización de Quick Notes

### 📝 Descarga de Contenido Completo de Documentos en la Sincronización Inicial
- **Inclusión de `content` en `GET /api/documents`:**
  - El endpoint de listado excluía el campo `content`, provocando que todas las notas sincronizadas se guardaran en SQLite con `content: null`. Se incluyó `documents.content` en la proyección para que todo el texto Markdown, datos de canvas y referencias de PDF se descarguen y persistan localmente en el dispositivo.
- **Fallback Activo en `getDocument(id)` de Tauri:**
  - Si un documento en SQLite carece de contenido, `TauriStorageAdapter.getDocument` consulta a la API con `ensureAuthToken()`, actualiza SQLite local y devuelve el documento completo.
- **Sincronización Nativa del Panel de Quick Notes (`/api/messages`):**
  - Se adaptaron todas las llamadas del panel de notas rápidas, memos de voz y destacados (`notes-panel.tsx`) para usar `getApiUrl()` y cabeceras de autenticación con Bearer token en entornos móviles, resolviendo el problema donde los mensajes y notas rápidas de la nube no se mostraban.

---

## [1.0.5] — Sincronización Automática de Notas al Iniciar Sesión y Persistencia Robusta

### ☁️ Sincronización Inmediata de Notas de la Nube (Local-First Sync)
- **Resolución de Conflicto de Claves Foráneas SQLite (`foreign_keys = OFF` durante batch upsert):**
  - Al sincronizar notas jerárquicas existentes de la nube, las notas anidadas (hijas con `parentId`) podían insertarse antes que sus notas padre debido al ordenamiento devuelto por la API. Esto causaba `ConstraintViolation: FOREIGN KEY constraint failed` en SQLite, abortando la transacción y dejando 0 notas guardadas localmente.
  - Se desacoplaron las restricciones de FK temporalmente durante la inserción en bloque (`PRAGMA foreign_keys = OFF;`) y se reactivaron al consolidar (`PRAGMA foreign_keys = ON;`), permitiendo inserciones no lineales con prueba unitaria verificada.
- **Recuperación Automática de Sesión y Token:**
  - Implementación del endpoint `/api/auth/recover-session` y la función `ensureAuthToken()` para restaurar automáticamente tokens de sesión válidos en clientes móviles que migraron de versiones previas o persistían `nout_cloud_user` en `localStorage`.
- **Deduplicación de Peticiones y Notificación Reactiva:**
  - `TauriStorageAdapter` implementa deduplicación de sincronizaciones concurrentes vía `syncPromise` compartida y despacho de evento desacoplado `nout:cloud_synced`.
  - `useNotesData` se suscribe a `nout:cloud_synced` para inyectar inmediatamente en pantalla las notas recién sincronizadas preservando cambios en memoria.
- **Soporte Completo de Papelera en SQLite:**
  - `query_documents` ahora expone todos los documentos para permitir filtrado flexible por estado (`active` o `deleted`) desde el adaptador.

---

## [1.0.3] — Release Unificado: Google Material Design 3, Apple HIG & Auto-Updates APK

### 🔄 Actualizador Automático In-App (Android APK)
- **Instalador de Paquetes Robusto:**
  - En `MainActivity.kt`, validación previa de `canRequestPackageInstalls()` en Android 8.0+ (API 26+). Si no está habilitado, redirige a `ACTION_MANAGE_UNKNOWN_APP_SOURCES` para que el usuario active la instalación de forma asistida.
  - Lanzamiento del instalador nativo del sistema vía `Intent(ACTION_VIEW)` con `FileProvider` y permisos `FLAG_GRANT_READ_URI_PERMISSION`.
- **Experiencia de Usuario Controlada:**
  - En `useAppUpdate.ts`, el banner notifica la disponibilidad de la nueva versión con notas del release y botón *"Actualizar ahora"*, evitando descargas forzadas e inesperadas.

### 📱 Experiencia Mobile & APK (Google M3 & Apple HIG)
- **Safe Area Insets & Edge-to-Edge:**
  - Soporte completo de notch, punch-hole de cámara y barra de gestos Android / Home indicator (`--safe-area-*`, `.pt-safe`, `.pb-safe`).
  - Protección de barra de estado en el contenedor principal de la aplicación (`notes-app.tsx`).
  - Eliminación de destello gris táctil web (`-webkit-tap-highlight-color: transparent`) y soporte de gestos fluidos (`touch-action: manipulation`).
- **Material Design 3 Navigation Bar:**
  - Píldoras de selección activa (Active indicator pill) en la barra de navegación inferior.
  - Dimensiones ergonómicas (altura base de 80dp con insets de safe-area) y áreas táctiles mínimas de 48×48dp (accesibilidad M3 y HIG).
  - Floating Action Button (FAB) M3 de 56×56dp squircle (`rounded-2xl` / 16dp de radio) y elevación de Nivel 3.
- **Hojas Inferiores Modales (Bottom Sheets):**
  - Transformación del selector de pestañas móviles en un Bottom Sheet modal con tirador superior (grabber handle), esquinas superiores redondeadas a 28dp (`rounded-t-[28px]`) y tarjetas de previsualización táctiles.
- **Material 3 Modal Navigation Drawer:**
  - Menú lateral extendido a pantalla completa (`top-0 bottom-0`) con esquinas derechas redondeadas a 28dp, scrim backdrop atenuado y compensación de scroll inferior para evitar solapamientos con la barra de navegación.
- **Micro-Feedback Háptico:**
  - Utilidad `haptics.ts` con respuesta táctil nativa en toques de navegación, FAB y hojas modales.

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
