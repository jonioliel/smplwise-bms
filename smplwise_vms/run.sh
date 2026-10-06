#!/usr/bin/with-contenv bashio
# SMPLWISE VMS add-on entrypoint. Options are read by the backend from /data/options.json; only the
# log level is exported here. No secrets are printed.
set -e

export SW_LOG_LEVEL="$(bashio::config 'log_level' 'info')"
# CR-029: the option frigate_enabled makes the Frigate recorder type selectable (read once at start-up by services/recorders/registry.py).
if bashio::config.true 'frigate_enabled'; then
  export SW_FRIGATE=1
else
  export SW_FRIGATE=0
fi
bashio::log.info "SmplWise Arx backend starting on port 8099 (Ingress only, no host port)"

if ! bashio::config.has_value 'bootstrap_admin_username'; then
  bashio::log.warning "bootstrap_admin_username is empty: nobody will be the VMS system administrator until it is set"
fi

cd /app
exec python3 -m smplwise
