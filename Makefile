SHELL := /bin/bash
export PATH := $(HOME)/.cargo/bin:$(PATH)

.PHONY: dev build install-deps install-rust clean check frontend-check help

# Default target
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────────────────────────────

install-rust: ## Install Rust toolchain via rustup
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
	@echo "Run: source ~/.cargo/env"

install-deps: ## Install system dependencies for Tauri (Linux, requires sudo)
	sudo apt-get update && sudo apt-get install -y \
		libwebkit2gtk-4.1-dev \
		libglib2.0-dev \
		build-essential \
		libssl-dev \
		libayatana-appindicator3-dev \
		librsvg2-dev \
		libgtk-3-dev \
		libsoup-3.0-dev \
		libjavascriptcoregtk-4.1-dev \
		libxdo-dev

install: ## Install all npm dependencies
	pnpm install

setup: install-rust install-deps install ## Full setup: Rust + system deps + npm deps

# ── Development ────────────────────────────────────────────────────────────────

dev: ## Run in development mode (hot reload)
	pnpm tauri dev

frontend-dev: ## Run only frontend in dev mode (no Tauri)
	pnpm dev

# ── Build ──────────────────────────────────────────────────────────────────────

build: ## Build production binary
	pnpm tauri build

frontend-build: ## Build only frontend
	pnpm build

# ── Checks ─────────────────────────────────────────────────────────────────────

check: ## Run TypeScript and Rust checks
	pnpm exec tsc --noEmit
	cd src-tauri && cargo check

frontend-check: ## Run TypeScript check only
	pnpm exec tsc --noEmit

rust-check: ## Run Rust check only
	cd src-tauri && cargo check

# ── Clean ──────────────────────────────────────────────────────────────────────

clean: ## Clean all build artifacts
	rm -rf dist node_modules src-tauri/target

clean-rust: ## Clean only Rust build artifacts
	cd src-tauri && cargo clean
