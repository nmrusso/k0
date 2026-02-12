# k0 - Kubernetes IDE

A desktop application for managing Kubernetes clusters with a modern, intuitive interface. Built with Tauri (Rust backend) and React (TypeScript frontend).

## Overview

k0 provides a visual IDE experience for Kubernetes cluster management. It connects to your existing kubeconfig and lets you browse, inspect, edit, and manage resources across contexts and namespaces — all from a single desktop app.

## Installation

### Download binaries

Download the latest release from the [Releases](../../releases) page:

| Platform | File | Notes |
|----------|------|-------|
| Linux (Debian/Ubuntu) | `k0_<version>_amd64.deb` | Recommended for Debian-based distros |
| Linux (other) | `k0_<version>_amd64.AppImage` | Works on any distro |
| macOS (Apple Silicon) | `k0_<version>_aarch64.dmg` | M1/M2/M3/M4 |
| macOS (Intel) | `k0_<version>_x64.dmg` | |
| Windows | `k0_<version>_x64-setup.exe` | NSIS installer |
| Windows | `k0_<version>_x64_en-US.msi` | MSI installer |

#### Linux

```bash
# Debian/Ubuntu
sudo dpkg -i k0_*_amd64.deb

# AppImage (any distro)
chmod +x k0_*.AppImage
./k0_*.AppImage
```

#### macOS

Open the `.dmg` and drag k0 to Applications. On first launch, right-click and select "Open" to bypass Gatekeeper.

#### Windows

Run the `.exe` installer or the `.msi` package. WebView2 is required (pre-installed on Windows 10/11).

### Prerequisites

- `kubectl` installed and available in PATH
- A valid `~/.kube/config` with at least one cluster configured
- `helm` CLI installed and in PATH (for Helm release management)
- `helm-diff` plugin (for revision diffs): `helm plugin install https://github.com/databus23/helm-diff`

### Configuration

k0 stores its configuration in a SQLite database at the platform-specific data directory:

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/k0/config.db` |
| macOS | `~/Library/Application Support/k0/config.db` |
| Windows | `%APPDATA%/k0/config.db` |

The database is created automatically on first launch. Uninstalling k0 does not remove this file — delete it manually if you want a clean slate.

## Development (build from source)

### Requirements

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9

#### Linux system dependencies

```bash
# Debian/Ubuntu
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel patchelf openssl-devel

# Arch
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg patchelf openssl
```

#### macOS

```bash
xcode-select --install
```

#### Windows

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)

### Run from source

```bash
# Clone the repository
git clone https://github.com/Murzbul/k0.git
cd k0

# Install frontend dependencies
pnpm install

# Run in development mode (hot-reload)
pnpm tauri dev
```

### Build locally

```bash
pnpm tauri build
```

Output bundles are placed in `src-tauri/target/release/bundle/`.

### Tests

```bash
# Frontend tests
pnpm test:run

# Frontend type check
npx tsc --noEmit

# Backend check
cd src-tauri && cargo check
```

## Technologies

### Frontend

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| Zustand | State management |
| Vite 7 | Build tooling |
| @xyflow/react | Graph visualizations |
| @xterm/xterm | Terminal emulator |
| CodeMirror 6 | YAML editor |
| Radix UI | Accessible UI primitives |
| Lucide React | Icons |
| Vitest | Testing |

### Backend

| Technology | Purpose |
|---|---|
| Rust | Systems language |
| Tauri 2 | Desktop framework (IPC bridge) |
| kube-rs | Kubernetes API client |
| k8s-openapi | Kubernetes type definitions |
| tokio | Async runtime |
| portable-pty | PTY for shell sessions |
| rusqlite | Local config storage |
| serde / serde_json / serde_yaml | Serialization |

## Architecture

### Backend (Rust — `src-tauri/src/`)

The backend follows a **layered architecture** with clear separation of concerns:

```
src-tauri/src/
├── lib.rs                          # App entry point, command registration
├── domain/
│   ├── entities/                   # Data models (Pod, Deployment, Service, etc.)
│   └── errors.rs                   # Domain error types
├── application/
│   ├── handlers/                   # Business logic orchestration
│   │   ├── cluster_handler.rs      # Context & namespace management
│   │   ├── resource_handler.rs     # Resource listing, graphs
│   │   ├── pod_handler.rs          # Pod details, image history
│   │   ├── gateway_handler.rs      # Gateway API resources
│   │   ├── crd_handler.rs          # Custom Resource Definitions
│   │   └── editing_handler.rs      # YAML editing, patching
│   └── services/
│       ├── config_db.rs            # SQLite configuration store
│       └── formatting.rs           # Age formatting utilities
├── infrastructure/
│   ├── kubernetes/                 # K8s API repositories
│   │   ├── client_manager.rs       # Multi-context client management
│   │   ├── pod_repository.rs       # Pod CRUD operations
│   │   ├── workload_repository.rs  # Deployments, StatefulSets, Jobs, etc.
│   │   ├── networking_repository.rs# Services, Ingresses
│   │   ├── config_repository.rs    # ConfigMaps, Secrets
│   │   ├── gateway_repository.rs   # Gateway API resources
│   │   ├── editing_repository.rs   # YAML get/update/patch
│   │   └── helpers.rs              # Shared K8s utilities
│   ├── streams/
│   │   ├── log_streamer.rs         # Real-time pod log streaming
│   │   └── shell_streamer.rs       # PTY-based shell sessions
│   └── watchers/
│       └── pod_watcher.rs          # Kubernetes watch API integration
└── interfaces/
    ├── state.rs                    # Application state (Tauri managed)
    └── tauri_commands/             # Tauri IPC command definitions
        ├── cluster_commands.rs
        ├── resource_commands.rs
        ├── detail_commands.rs
        ├── watch_commands.rs
        ├── editing_commands.rs
        ├── panel_commands.rs
        ├── crd_commands.rs
        ├── portforward_commands.rs
        └── config_commands.rs
```

**Layer responsibilities:**

- **Domain**: Pure data structures and error types. No external dependencies.
- **Application**: Business logic. Handlers orchestrate infrastructure calls.
- **Infrastructure**: External integrations — Kubernetes API, PTY, SQLite, event streams.
- **Interfaces**: Tauri command layer — bridges frontend IPC calls to application handlers.

### Frontend (TypeScript — `src/`)

```
src/
├── App.tsx                         # Root component, default context loading
├── stores/
│   ├── clusterStore.ts             # Active context, namespace, resource selection
│   └── panelStore.ts               # Bottom panel tabs (logs, shells)
├── hooks/
│   ├── useResources.ts             # Generic resource fetching hook
│   ├── useContexts.ts              # Context listing
│   ├── useNamespaces.ts            # Namespace listing
│   ├── useLogStream.ts             # Log streaming via Tauri events
│   ├── useShellStream.ts           # Shell I/O via Tauri events
│   └── useInfiniteScroll.ts        # Virtual scrolling for large lists
├── components/
│   ├── layout/                     # App shell (TopBar, Sidebar, MainLayout)
│   ├── resources/                  # Resource tables, detail views, graphs
│   ├── panel/                      # Bottom panel (logs, terminal)
│   ├── portforward/                # Port forward dialog
│   ├── settings/                   # Settings dialog
│   └── ui/                         # Shared UI primitives
├── lib/
│   ├── tauri-commands.ts           # Typed Tauri invoke wrappers
│   ├── resource-coords.ts          # Resource type → API coordinates mapping
│   └── utils.ts                    # General utilities
└── types/
    └── k8s.ts                      # Kubernetes resource type definitions
```

## License

MIT
