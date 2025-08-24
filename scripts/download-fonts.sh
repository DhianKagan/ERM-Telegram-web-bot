#!/usr/bin/env bash
# Назначение: загрузка локальных шрифтов для веб-клиента.
# Модули: bash, curl.
set -euo pipefail

DIR="$(dirname "$0")/../apps/web/public/fonts"
mkdir -p "$DIR"

curl -L -o "$DIR/inter-400.ttf" https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf
curl -L -o "$DIR/inter-700.ttf" https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
curl -L -o "$DIR/poppins-400.ttf" https://fonts.gstatic.com/s/poppins/v23/pxiEyp8kv8JHgFVrFJA.ttf
curl -L -o "$DIR/poppins-700.ttf" https://fonts.gstatic.com/s/poppins/v23/pxiByp8kv8JHgFVrLCz7V1s.ttf
curl -L -o "$DIR/roboto-400.ttf" https://fonts.gstatic.com/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf
curl -L -o "$DIR/roboto-700.ttf" https://fonts.gstatic.com/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf
