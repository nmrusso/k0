# k0 - Kubernetes IDE (Lens Clone)

## Context
App de escritorio tipo Lens para gestionar clusters Kubernetes.
Stack: **Tauri 2.x** (Rust backend) + **React + TypeScript** + **ShadCN/UI** + **TailwindCSS**.

La comunicacion con K8s se hace desde Rust usando `kube-rs` (no Node.js sidecar).

## Arquitectura

```
Frontend (React + ShadCN)  <--invoke()-->  Rust Backend (kube-rs)  <-->  K8s API
     |                                          |
  Zustand store                          AppState (clients map)
  (context, namespace,                   HashMap<context, Client>
   active resource)
```

**Flujo de datos:** El usuario selecciona cluster -> Rust crea Client -> usuario selecciona namespace -> frontend invoca comando Rust (ej: `get_pods`) -> Rust llama K8s API -> retorna DTOs planos (PodInfo, DeploymentInfo...) -> React renderiza tabla.

## Estructura del proyecto

```
k0/
├── package.json, vite.config.ts, tailwind.config.ts, components.json
├── index.html
├── src/                          # Frontend React
│   ├── main.tsx, App.tsx, globals.css
│   ├── components/
│   │   ├── ui/                   # ShadCN (table, select, badge, skeleton, scroll-area)
│   │   ├── layout/               # Sidebar, TopBar, MainLayout
│   │   └── resources/            # ResourceTable, PodTable, DeploymentTable, etc.
│   ├── hooks/                    # useContexts, useNamespaces, useResources
│   ├── stores/clusterStore.ts    # Zustand
│   ├── lib/tauri-commands.ts     # Typed invoke() wrappers
│   └── types/k8s.ts              # TypeScript interfaces
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs                # Builder + command registration
│       ├── state.rs              # AppState
│       ├── kube/
│       │   ├── config.rs         # list_contexts, build_client
│       │   └── resources.rs      # DTOs + generic list function
│       └── commands/
│           ├── contexts.rs       # get_contexts, set_active_context
│           ├── namespaces.rs     # get_namespaces
│           └── resources.rs      # get_pods, get_deployments, etc.
└── public/
```

## Plan de implementacion

### Fase 1: Setup del proyecto
1. Instalar Rust toolchain (`rustup`)
2. Instalar dependencias de sistema para Tauri (webkit2gtk, etc.)
3. Scaffoldear proyecto Tauri con template react-ts en `k0/`
4. Configurar TailwindCSS v4
5. Inicializar ShadCN/UI (dark theme)
6. Agregar componentes ShadCN: table, select, badge, skeleton, scroll-area, separator
7. Instalar zustand
8. Verificar que `pnpm tauri dev` arranca

### Fase 2: Rust Backend
9. Agregar dependencias a Cargo.toml (kube, k8s-openapi, tokio, serde, etc.)
10. Crear `state.rs` - AppState con clients map y active context/namespace
11. Crear `kube/config.rs` - leer kubeconfig, listar contextos, crear clients
12. Crear `kube/resources.rs` - DTOs (PodInfo, DeploymentInfo, etc.) + funcion generica de listado
13. Crear `commands/contexts.rs` - get_contexts, set_active_context
14. Crear `commands/namespaces.rs` - get_namespaces
15. Crear `commands/resources.rs` - get_pods, get_deployments, get_daemonsets, get_statefulsets, get_replicasets, get_replication_controllers, get_jobs, get_cronjobs
16. Registrar todos los commands en lib.rs

### Fase 3: Frontend UI
17. Crear store Zustand (clusterStore.ts) - active context/namespace/resource
18. Crear types/k8s.ts - interfaces TypeScript para DTOs
19. Crear lib/tauri-commands.ts - wrappers tipados sobre invoke()
20. Crear hooks: useContexts, useNamespaces, useResources (generico)
21. Crear MainLayout - sidebar + topbar + content area
22. Crear TopBar - cluster selector + namespace filter
23. Crear Sidebar - navegacion de recursos (Pods, Deployments, etc.)
24. Crear ResourceTable + tablas especificas (PodTable, DeploymentTable, etc.)
25. Aplicar dark theme forzado + estilos tipo Lens
26. Wiring final: conectar todo

### Verificacion
- `pnpm tauri dev` levanta la app
- Se muestran los clusters de ~/.kube/config en el selector
- Al seleccionar un cluster, se cargan los namespaces
- Al seleccionar namespace + recurso, la tabla muestra datos reales
- La UI tiene dark theme y layout tipo Lens (sidebar + tabla)

## Status

| Fase | Estado |
|------|--------|
| Fase 1: Setup | Completado |
| Fase 2: Rust Backend | Completado (codigo escrito, requiere system deps para compilar) |
| Fase 3: Frontend UI | Completado (TypeScript y Vite build OK) |

## Notas

### Dependencias de sistema requeridas para compilar Tauri (Linux)
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libglib2.0-dev build-essential \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev \
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

Una vez instaladas, ejecutar `make dev` para compilar y levantar la app.
