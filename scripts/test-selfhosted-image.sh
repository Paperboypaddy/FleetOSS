#!/bin/sh
# Smoke test the selfhosted Docker image
set -e

IMAGE="${1:-fleetoss-selfhosted:test}"
CONTAINER="fleetoss-smoke-$(date +%s)"

echo "=== Building $IMAGE ==="
docker build -t "$IMAGE" -f Dockerfile.selfhosted .

echo "=== Starting container ==="
docker run -d --name "$CONTAINER" \
  -p 4080:80 \
  -e DOMAIN= \
  -e EMAIL= \
  "$IMAGE"

sleep 3

echo "=== Testing frontend ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4080/)
if [ "$HTTP_CODE" = "200" ]; then
  echo "  Frontend: OK (HTTP $HTTP_CODE)"
else
  echo "  Frontend: FAIL (HTTP $HTTP_CODE)"
  docker logs "$CONTAINER"
  docker rm -f "$CONTAINER"
  exit 1
fi

echo "=== Testing API health ==="
HEALTH=$(curl -s http://localhost:4080/api/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "  API health: OK"
else
  echo "  API health: FAIL ($HEALTH)"
  docker logs "$CONTAINER"
  docker rm -f "$CONTAINER"
  exit 1
fi

echo "=== Cleaning up ==="
docker rm -f "$CONTAINER"
echo "=== All smoke tests passed! ==="
