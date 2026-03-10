#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Defaults
TARGET="standalone"
SKIP_BUILD=false
IMAGE="baker-street-tasks:latest"

usage() {
  cat <<EOF
Usage: $(basename "$0") [standalone|extension] [OPTIONS]

Deploy Baker Street Tasks to a local k3s cluster.

Targets:
  standalone   (default) Full app in 'baker-street' namespace
  extension    Baker Street platform extension in 'bakerst' namespace

Options:
  --skip-build   Skip Docker image build
  --image TAG    Override image tag (default: baker-street-tasks:latest)
  -h, --help     Show this help

Examples:
  $(basename "$0")                      # Build + deploy standalone
  $(basename "$0") extension            # Build + deploy as extension
  $(basename "$0") --skip-build         # Deploy standalone, skip build
  $(basename "$0") extension --image baker-street-tasks:v2
EOF
  exit 0
}

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    standalone|extension)
      TARGET="$1"; shift ;;
    --skip-build)
      SKIP_BUILD=true; shift ;;
    --image)
      IMAGE="${2:?--image requires a value}"; shift 2 ;;
    -h|--help)
      usage ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Run '$(basename "$0") --help' for usage." >&2
      exit 1 ;;
  esac
done

# --- Config per target ---
if [[ "$TARGET" == "standalone" ]]; then
  NAMESPACE="baker-street"
  DEPLOYMENT="baker-street"
  MANIFESTS=(
    k8s/namespace.yaml
    k8s/pvc.yaml
    k8s/configmap.yaml
    k8s/secret.yaml
    k8s/deployment.yaml
    k8s/service.yaml
  )
else
  NAMESPACE="bakerst"
  DEPLOYMENT="ext-baker-street-tasks"
  MANIFESTS=(
    k8s/extension.yaml
  )
fi

echo "==> Target:    $TARGET"
echo "==> Namespace: $NAMESPACE"
echo "==> Image:     $IMAGE"
echo ""

# --- Build ---
if [[ "$SKIP_BUILD" == false ]]; then
  echo "==> Building Docker image: $IMAGE"
  docker build -f apps/web/Dockerfile -t "$IMAGE" .
  echo ""
else
  echo "==> Skipping build (--skip-build)"
  echo ""
fi

# --- Apply manifests ---
echo "==> Applying manifests for '$TARGET':"
for manifest in "${MANIFESTS[@]}"; do
  echo "    $manifest"
done
echo ""

kubectl apply -f <(cat "${MANIFESTS[@]}")

# --- Wait for rollout ---
echo ""
echo "==> Waiting for deployment/$DEPLOYMENT rollout in namespace $NAMESPACE..."
kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=120s

# --- Status ---
echo ""
echo "==> Deployment status:"
kubectl -n "$NAMESPACE" get pods -l app=baker-street-tasks

echo ""
if [[ "$TARGET" == "standalone" ]]; then
  echo "Access via port-forward:"
  echo "  kubectl -n $NAMESPACE port-forward svc/baker-street 3000:3000 3100:3100"
  echo ""
  echo "Then open http://localhost:3000"
else
  echo "Extension registered in namespace '$NAMESPACE'."
  echo "The Brain will auto-discover task management tools via NATS."
fi
