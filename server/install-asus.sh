#!/usr/bin/env bash
set -euo pipefail
if [[ "$EUID" != 0 ]]; then echo 'Installation à lancer avec sudo.' >&2; exit 1; fi
stage=$(cd -- "$(dirname -- "$0")" && pwd)
runtime=${1:?Dossier du runtime Node requis}
bundle=${2:?Import privé requis}
activation=${3:?Fichier privé de résultat requis}
if [[ ! -x "$runtime/bin/node" || ! -f "$bundle" ]]; then echo 'Runtime ou import absent.' >&2; exit 1; fi
if [[ -e /etc/systemd/system/papaye-api.service || -e /var/lib/papaye-api/catalogue.sqlite || -e /etc/papaye-api/config.json ]]; then echo 'Installation existante détectée : arrêt sans remplacement.' >&2; exit 1; fi
id papaye-api >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /var/lib/papaye-api --shell /usr/sbin/nologin papaye-api
install -d -o root -g root -m 755 /opt/papaye-api /opt/papaye-api/app
cp -a "$runtime" /opt/papaye-api/node
chown -R root:root /opt/papaye-api/node
chmod -R a+rX /opt/papaye-api/node
for file in http.mjs database.mjs portal.mjs password.mjs admin.mjs backup.mjs schema.sql export-worksheet.mjs export-worksheet.py; do install -o root -g root -m 644 "$stage/$file" "/opt/papaye-api/app/$file"; done
install -d -o papaye-api -g papaye-api -m 700 /var/lib/papaye-api /var/lib/papaye-api/backups
install -d -o root -g papaye-api -m 750 /etc/papaye-api
umask 077
/opt/papaye-api/node/bin/node /opt/papaye-api/app/admin.mjs initialize /etc/papaye-api/config.json /var/lib/papaye-api/catalogue.sqlite "$bundle" > "$activation"
chown "${SUDO_USER:-root}" "$activation"
chmod 600 "$activation"
chown papaye-api:papaye-api /var/lib/papaye-api/catalogue.sqlite*
chown root:papaye-api /etc/papaye-api/config.json
chmod 640 /etc/papaye-api/config.json
install -o root -g root -m 644 "$stage/papaye-api.service" /etc/systemd/system/papaye-api.service
systemctl daemon-reload
systemctl enable --now papaye-api.service
for attempt in 1 2 3 4 5; do if curl --fail --silent http://127.0.0.1:5293/health >/dev/null; then break; fi; sleep 1; done
curl --fail --silent http://127.0.0.1:5293/health
echo
echo 'API installée sur loopback ; exposition HTTPS effectuée séparément après vérification.'
