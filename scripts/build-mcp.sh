#!/bin/bash
#
# Builds the embedded AI Code Agent MCP server.
#
# Usage:
#   ./build-mcp.sh           # Development build
#   ./build-mcp.sh --prod    # Production build (minified)
#   ./build-mcp.sh --clean   # Clean and rebuild
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$PLUGIN_ROOT/lib/mcp/ai-code-agent"

# Parse arguments
PRODUCTION=false
CLEAN=false
SKIP_INSTALL=false

for arg in "$@"; do
    case $arg in
        --prod|--production)
            PRODUCTION=true
            ;;
        --clean)
            CLEAN=true
            ;;
        --skip-install)
            SKIP_INSTALL=true
            ;;
    esac
done

# Check Node.js version
check_node_version() {
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Please install Node.js 20+"
        exit 1
    fi

    NODE_VERSION=$(node --version | tr -d 'v')
    MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

    if [ "$MAJOR" -lt 20 ]; then
        error "Node.js 20+ required. Found: $NODE_VERSION"
        exit 1
    fi

    info "Node.js version: $NODE_VERSION"
}

# Main build
build_mcp() {
    info "Building AI Code Agent MCP Server..."
    info "MCP Directory: $MCP_DIR"

    if [ ! -d "$MCP_DIR" ]; then
        error "MCP directory not found: $MCP_DIR"
        exit 1
    fi

    check_node_version

    cd "$MCP_DIR"

    # Clean if requested
    if [ "$CLEAN" = true ]; then
        info "Cleaning..."
        rm -rf dist node_modules
    fi

    # Install dependencies
    if [ "$SKIP_INSTALL" = false ]; then
        info "Installing dependencies..."
        npm ci
    fi

    # Build
    if [ "$PRODUCTION" = true ]; then
        info "Building in production mode..."
        npm run build:prod
    else
        info "Building in development mode..."
        npm run build
    fi

    # Verify output
    if [ -f "dist/index.js" ]; then
        SIZE=$(du -h dist/index.js | cut -f1)
        success "Build successful! Output: dist/index.js ($SIZE)"
    else
        error "Build output not found: dist/index.js"
        exit 1
    fi
}

# Run build
build_mcp
