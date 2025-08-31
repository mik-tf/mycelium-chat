#!/bin/bash
set -e

# Generate config if it doesn't exist
if [ ! -f /data/homeserver.yaml ]; then
    echo "Generating Synapse configuration..."
    python -m synapse.app.homeserver \
        --server-name=localhost \
        --config-path=/data/homeserver.yaml \
        --generate-config \
        --report-stats=no
    
    # Enable registration for development
    sed -i 's/#enable_registration: false/enable_registration: true/' /data/homeserver.yaml
    sed -i 's/enable_registration: false/enable_registration: true/' /data/homeserver.yaml
    sed -i 's/#enable_registration_without_verification: false/enable_registration_without_verification: true/' /data/homeserver.yaml
    sed -i 's/enable_registration_without_verification: false/enable_registration_without_verification: true/' /data/homeserver.yaml
    
    echo "Configuration generated successfully"
fi

# Start Synapse
echo "Starting Synapse homeserver..."
exec python -m synapse.app.homeserver --config-path=/data/homeserver.yaml
