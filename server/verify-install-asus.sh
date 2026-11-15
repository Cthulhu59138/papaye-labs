#!/usr/bin/env bash
set -euo pipefail
[[ "$EUID" == 0 ]] || exit 1
# Runtime files are public executable code, never private data/configuration.
chmod -R a+rX /opt/papaye-api/node
systemctl restart papaye-api.service
for attempt in 1 2 3 4 5; do if curl --fail --silent http://127.0.0.1:5293/health >/dev/null; then break; fi; sleep 1; done
curl --fail --silent http://127.0.0.1:5293/health
[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:5293/api/projects)" == 401 ]]
[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:5293/api/public/projects)" == 404 ]]
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/lib/papaye-api/backups/initial-$stamp.sqlite"
restored="/var/lib/papaye-api/backups/restored-$stamp.sqlite"
runuser -u papaye-api -- /opt/papaye-api/node/bin/node /opt/papaye-api/app/backup.mjs backup /var/lib/papaye-api/catalogue.sqlite "$backup"
runuser -u papaye-api -- /opt/papaye-api/node/bin/node /opt/papaye-api/app/backup.mjs restore "$backup" "$restored"
runuser -u papaye-api -- /opt/papaye-api/node/bin/node /opt/papaye-api/app/backup.mjs verify "$restored"
systemctl restart papaye-api.service
sleep 1
curl --fail --silent http://127.0.0.1:5293/health
echo
# Only this explicit additional HTTPS listener is modified. Port 443 stays private.
tailscale funnel --bg --https=8443 http://127.0.0.1:5293
tailscale serve status --json
