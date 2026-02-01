#!/bin/bash
# AstroGroot Fly.io Deployment Script
# Usage: ./scripts/deploy-fly.sh [chromadb|crawler|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo_error "Fly CLI not found. Install it from https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo_warn "Not logged in to Fly.io. Running 'fly auth login'..."
    fly auth login
fi

deploy_chromadb() {
    echo_info "Deploying ChromaDB..."

    # Check if app exists
    if ! fly apps list | grep -q "astrogroot-chromadb"; then
        echo_info "Creating ChromaDB app..."
        fly launch --config fly.chromadb.toml --no-deploy --copy-config --yes

        echo_info "Creating persistent volume..."
        fly volumes create chromadb_data --size 10 --config fly.chromadb.toml --yes || true
    fi

    # Check if secret is set
    if ! fly secrets list --config fly.chromadb.toml | grep -q "CHROMA_SERVER_AUTH_CREDENTIALS"; then
        echo_warn "CHROMA_SERVER_AUTH_CREDENTIALS not set."
        echo "Enter a secure token for ChromaDB authentication:"
        read -s CHROMA_TOKEN
        fly secrets set CHROMA_SERVER_AUTH_CREDENTIALS="$CHROMA_TOKEN" --config fly.chromadb.toml
    fi

    fly deploy --config fly.chromadb.toml

    echo_info "ChromaDB deployed! URL: https://astrogroot-chromadb.fly.dev"
}

deploy_crawler() {
    echo_info "Deploying Crawler..."

    # Check if app exists
    if ! fly apps list | grep -q "astrogroot-crawler"; then
        echo_info "Creating Crawler app..."
        fly launch --config fly.toml --no-deploy --copy-config --yes
    fi

    # Check required secrets
    REQUIRED_SECRETS=("TURSO_DATABASE_URL" "TURSO_AUTH_TOKEN" "ANTHROPIC_API_KEY" "CHROMA_HOST" "CHROMA_AUTH_TOKEN")
    MISSING_SECRETS=()

    EXISTING_SECRETS=$(fly secrets list --config fly.toml 2>/dev/null || echo "")

    for secret in "${REQUIRED_SECRETS[@]}"; do
        if ! echo "$EXISTING_SECRETS" | grep -q "$secret"; then
            MISSING_SECRETS+=("$secret")
        fi
    done

    if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
        echo_warn "Missing secrets: ${MISSING_SECRETS[*]}"
        echo ""
        echo "Please set them manually:"
        echo "  fly secrets set \\"
        for secret in "${MISSING_SECRETS[@]}"; do
            echo "    $secret=your-value \\"
        done
        echo "    --config fly.toml"
        echo ""
        echo "Then run this script again."
        exit 1
    fi

    fly deploy --config fly.toml

    echo_info "Crawler deployed! View logs: fly logs --config fly.toml"
}

show_status() {
    echo ""
    echo "=== Fly.io Deployment Status ==="
    echo ""

    if fly apps list | grep -q "astrogroot-chromadb"; then
        echo_info "ChromaDB: https://astrogroot-chromadb.fly.dev"
        fly status --config fly.chromadb.toml 2>/dev/null | head -10 || true
    else
        echo_warn "ChromaDB: Not deployed"
    fi

    echo ""

    if fly apps list | grep -q "astrogroot-crawler"; then
        echo_info "Crawler:"
        fly status --config fly.toml 2>/dev/null | head -10 || true
    else
        echo_warn "Crawler: Not deployed"
    fi
}

case "${1:-all}" in
    chromadb)
        deploy_chromadb
        ;;
    crawler)
        deploy_crawler
        ;;
    all)
        deploy_chromadb
        echo ""
        deploy_crawler
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 [chromadb|crawler|all|status]"
        echo ""
        echo "Commands:"
        echo "  chromadb  - Deploy ChromaDB only"
        echo "  crawler   - Deploy Crawler only"
        echo "  all       - Deploy both (default)"
        echo "  status    - Show deployment status"
        exit 1
        ;;
esac

echo ""
echo_info "Deployment complete!"
show_status
