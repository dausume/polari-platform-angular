#!/bin/sh
# PRF Frontend Entrypoint Script
# Starts Angular dev server with optional HTTPS support

set -e

# Configuration
HTTP_PORT=4200
HTTPS_PORT=2087
SSL_CERT_PATH="/app/certs/prf-proxy.crt"
SSL_KEY_PATH="/app/certs/prf-proxy.key"

echo "======================================================================"
echo "PRF FRONTEND SERVER STARTING"
echo "======================================================================"

# Check for SSL certificates
check_ssl_certs() {
    if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
        # Check if files are readable
        if [ -r "$SSL_CERT_PATH" ] && [ -r "$SSL_KEY_PATH" ]; then
            return 0
        else
            echo "[HTTPS] WARNING: SSL certificates exist but are not readable"
            return 1
        fi
    else
        return 1
    fi
}

# Display startup info
echo ""
echo "======================================================================"
echo "SERVER READY"
echo "======================================================================"

echo ""
echo "[HTTP]  Server running on port $HTTP_PORT"
echo "        URL: http://localhost:$HTTP_PORT/"

if check_ssl_certs; then
    echo ""
    echo "[HTTPS] Server running on port $HTTPS_PORT (Cloudflare-compatible)"
    echo "        URL: https://localhost:$HTTPS_PORT/"
    SSL_AVAILABLE=true
else
    echo ""
    echo "[HTTPS] WARNING: HTTPS server NOT started"
    echo "        Reason: SSL certificates not found at $SSL_CERT_PATH"
    echo "        To enable HTTPS, run: ./generate-prf-certs.sh dev"
    SSL_AVAILABLE=false
fi

echo ""
echo "======================================================================"
echo ""

# Start ONE dev server. Each `ng serve` is a full Angular compiler (~3 GB RSS);
# running HTTP and HTTPS side by side doubled the container's footprint and
# pushed the host into systemd-oomd territory (VS Code kills, 2026-08-25/26).
# HTTPS wins when certs exist; set FRONTEND_DUAL_SERVE=true to also run HTTP.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

if [ "$SSL_AVAILABLE" = true ]; then
    if [ "${FRONTEND_DUAL_SERVE:-false}" = "true" ]; then
        echo "[HTTP]  FRONTEND_DUAL_SERVE=true: starting background HTTP server on port $HTTP_PORT..."
        ng serve --host 0.0.0.0 --port $HTTP_PORT --disable-host-check &
        echo "[HTTP]  Background server started (PID: $!)"
    else
        echo "[HTTP]  Not started (single-server mode; set FRONTEND_DUAL_SERVE=true to enable)"
    fi
    echo "[HTTPS] Starting HTTPS server on port $HTTPS_PORT..."
    exec ng serve --host 0.0.0.0 --port $HTTPS_PORT --ssl --ssl-cert "$SSL_CERT_PATH" --ssl-key "$SSL_KEY_PATH" --disable-host-check
fi

# No certs: HTTP only
echo "[HTTP]  Starting HTTP server on port $HTTP_PORT..."
exec ng serve --host 0.0.0.0 --port $HTTP_PORT --disable-host-check
