#!/bin/bash

set -e

# Generate turnserver.conf from template
EXTERNAL_IP_LINE=""
if [ -n "$EXTERNAL_IP" ]; then
  EXTERNAL_IP_LINE="external-ip=$EXTERNAL_IP"
fi

# Replace template variables
sed -e "s|{{EXTERNAL_IP}}|$EXTERNAL_IP_LINE|g" \
    /etc/turnserver.conf.template > /etc/turnserver.conf

echo "TURN server configuration:"
echo "----------------------------"
cat /etc/turnserver.conf | grep -v "secret\|password" | head -20
echo "----------------------------"

# Start TURN server
exec "$@"

