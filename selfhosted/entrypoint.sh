#!/bin/sh
set -e

# Determine site address:
#   DOMAIN unset or empty → :80 (plain HTTP)
#   DOMAIN set → auto HTTPS via Let's Encrypt
if [ -z "${DOMAIN:-}" ]; then
    SITE_ADDR=":80"
else
    SITE_ADDR="$DOMAIN"
fi

# Build Caddyfile
cat > /etc/caddy/Caddyfile <<CADDYEOF
{
    admin off
CADDYEOF

if [ -n "${EMAIL:-}" ]; then
    echo "    email $EMAIL" >> /etc/caddy/Caddyfile
fi

cat >> /etc/caddy/Caddyfile <<CADDYEOF
}

$SITE_ADDR {
    handle /api/* {
        reverse_proxy localhost:4000
    }

    handle /ws {
        reverse_proxy localhost:4000
    }

    handle {
        root * /www
        file_server
        try_files {path} /index.html
    }
}
CADDYEOF

# Start Caddy in background
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &

# Start FleetOSS server (foreground)
exec node /app/dist/index.js
