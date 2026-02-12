# k0 Features

## Cluster Management

### Multi-Context Support
- Switch between multiple Kubernetes contexts from the top bar
- Each context maintains its own client connection
- Default context/namespace can be configured in settings

### Namespace Navigation
- Collapsible namespace list in the sidebar
- Quick namespace switching
- Namespace filtering for all resource views

## Resource Browsing

### Workloads
- **Pods**: Table/card view with status, restarts, IP, node, age. Flat view toggle to skip grouping.
- **Deployments**: Ready/up-to-date/available counts. Scale, edit resources, restart actions.
- **StatefulSets**: Replica status and age.
- **DaemonSets**: Desired/current/ready counts.
- **ReplicaSets**: Replica status display.
- **ReplicationControllers**: Legacy controller listing.
- **Jobs**: Completions and duration tracking.
- **CronJobs**: Schedule, last run, active counts.

### Networking
- **Services**: Type, cluster IP, ports, age.
- **Ingresses**: Hosts, paths, backends. Detail view with full rule breakdown.
- **Gateways** (Gateway API): Gateway class, listeners, addresses. Detail view with attached routes.
- **Network Overview**: Interactive graph showing the full request path: Ingress/Gateway -> Service -> Deployment. Endpoint counts per service, toggleable path visibility per entry point.

### Configuration
- **ConfigMaps**: Key listing with data preview.
- **Secrets**: Key listing with on-demand value reveal (base64 decoded). Full secret data export.

### Custom Resources (CRDs)
- Automatic discovery of all installed CRDs
- Grouped by API group in the sidebar
- Generic table view for any CRD instance
- Detail view with spec/status/metadata breakdown
- Supports both namespaced and cluster-scoped CRDs

## Resource Detail Views

### Pod Detail
- Container list with image, status, restart count
- Environment variables display
- Volume mounts
- Pod conditions and events
- Owner references (links to parent workloads)
- Image history tracking per container

### Ingress Detail
- TLS configuration
- Rule breakdown: host, path, backend service/port
- Default backend display

### Gateway Detail
- Gateway class and addresses
- Listener configuration (protocol, port, TLS)
- Attached HTTPRoutes and GRPCRoutes with full rule details

### Generic Resource Detail
- Works for any Kubernetes resource type
- Labels, annotations, finalizers
- Spec and status as formatted JSON
- Events list
- Owner references

## Resource Actions

### Deployment Management
- **Scale**: Adjust replica count with +/- controls
- **Restart**: Rolling restart via annotation patch
- **Edit Resources**: Per-container CPU/memory requests and limits

### Pod Actions
- **Delete Pod**: Direct pod deletion
- **Shell Access**: Interactive terminal into any container
- **View Logs**: Real-time log streaming

### YAML Editing
- View raw YAML for any resource
- Edit and apply changes with CodeMirror editor
- Syntax highlighting and validation
- Direct patch support via JSON merge patch

## Visualization

### Network Overview Graph
- Interactive React Flow graph
- Entry points (Ingress/Gateway) at the top
- Services in the middle with endpoint counts
- Deployments nested inside service cards
- Edge labels showing ports and route names
- Toggle visibility per entry point to filter paths
- Hosts display on Ingress/Gateway nodes
- Gateway API HTTPRoute resolution

### Dependency Overview Graph
- Hierarchical view of workload ownership
- Deployment -> ReplicaSet -> Pod chains
- StatefulSet, DaemonSet, Job, CronJob hierarchies
- Color-coded by resource type
- Collapsible child lists
- Pod status indicators
- Click-to-navigate to any resource

## Terminal & Logs

### Log Streaming
- Real-time log tailing via Kubernetes watch API
- Container selector for multi-container pods
- Search within logs
- Follow mode (auto-scroll to latest)
- Pause/resume streaming
- Clear log buffer
- Supports pods, deployments, statefulsets, daemonsets, and jobs

### Shell Sessions
- Full PTY-based terminal (xterm.js)
- Interactive shell into pod containers
- Configurable shell path (default: /bin/sh)
- Configurable font size and font family
- Automatic terminal resize
- Multiple simultaneous sessions
- Quick terminal creation from panel bar

## Port Forwarding

- Start port forwards to pods or services
- Custom local port selection (or auto-assign)
- Active port forward list with status
- One-click copy of local URL to clipboard
- Open in browser button
- Stop individual port forwards

## Settings & Configuration

### Application Settings
- **Default Context**: Auto-connect on startup
- **Default Namespace**: Auto-select namespace on startup
- **Terminal Font Size**: Customize terminal text size
- **Terminal Font Family**: Custom font selection
- **Terminal Shell Path**: Configure shell binary (/bin/sh, /bin/bash, /bin/zsh)
- **Default Expanded Categories**: Configure which sidebar sections start expanded

### Persistent Storage
- Settings stored in local SQLite database
- Survives app restarts
- Per-key configuration API

## UI Features

### Layout
- Collapsible sidebar with categorized resource navigation
- Resizable bottom panel for logs and terminals
- Table and card view modes for resource lists
- Infinite scroll for large resource lists

### View Modes
- **Table View**: Dense, spreadsheet-like layout
- **Card View**: Visual cards with key metrics

### Search & Filter
- In-log search with highlighting
- Resource tables with sortable columns

### Dark Theme
- Full dark mode interface
- Consistent color scheme across all components
- Graph visualizations optimized for dark backgrounds
