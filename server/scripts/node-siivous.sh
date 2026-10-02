#!/bin/bash
# =============================================================================
#  node-siivous.sh — sammuttaa jumiin jääneet Node-kopiot webhotellissa
# =============================================================================
#
# Webhotellin Passenger käynnistää sovelluksesta uuden kopion
# uudelleenkäynnistyksessä ja ruuhkassa, mutta vanha kopio ei aina sammu.
# Jokainen kopio vie noin 7 paikkaa tilin prosessikiintiöstä (raja 100) ja
# 60–110 Mt muistia (raja 512 Mt). Webbikettu ei siivoa niitä itse.
#
# Sääntö: jos samasta sovelluskansiosta on käynnissä useampi kopio, uusin
# jätetään aina rauhaan. Muista sammutetaan ne, jotka ovat olleet käynnissä
# yli MAX_AGE sekuntia. Ruuhkan vuoksi juuri käynnistetyt kopiot saavat siis
# jäädä, mutta päiviksi unohtuneet poistuvat.
#
# Käyttö (cPanel → Cron Jobs, 15 minuutin välein):
#   */15 * * * * /bin/bash $HOME/bin/node-siivous.sh
#
# Käsin, näkee mitä tehtäisiin sammuttamatta mitään:
#   DRY_RUN=1 bash ~/bin/node-siivous.sh
# =============================================================================

MAX_AGE=${MAX_AGE:-3600}
DRY_RUN=${DRY_RUN:-0}
LOG="$HOME/logs/node-siivous.log"
mkdir -p "$(dirname "$LOG")"

log() {
    echo "$(date '+%F %T') $*" >> "$LOG"
    [ "$DRY_RUN" = "1" ] && echo "$*"
}

pids=$(pgrep -u "$(id -u)" node)
[ -z "$pids" ] && exit 0

declare -A newest_pid newest_age

# 1. Uusin kopio jokaisesta sovelluskansiosta.
for p in $pids; do
    cwd=$(readlink "/proc/$p/cwd" 2>/dev/null) || continue
    age=$(ps -o etimes= -p "$p" 2>/dev/null | tr -d ' ')
    [ -z "$age" ] && continue
    if [ -z "${newest_age[$cwd]}" ] || [ "$age" -lt "${newest_age[$cwd]}" ]; then
        newest_age[$cwd]=$age
        newest_pid[$cwd]=$p
    fi
done

# 2. Muut kopiot pois, jos ne ovat olleet käynnissä liian kauan.
for p in $pids; do
    cwd=$(readlink "/proc/$p/cwd" 2>/dev/null) || continue
    [ "$p" = "${newest_pid[$cwd]}" ] && continue

    age=$(ps -o etimes= -p "$p" 2>/dev/null | tr -d ' ')
    [ -z "$age" ] && continue
    [ "$age" -le "$MAX_AGE" ] && continue

    if [ "$DRY_RUN" = "1" ]; then
        log "sammutettaisiin $p ($cwd, käynnissä ${age} s, uusin kopio ${newest_pid[$cwd]})"
        continue
    fi

    # Ensin pyyntö (SIGTERM), sitten pakko jos prosessi ei totellut.
    kill "$p" 2>/dev/null
    sleep 5
    if kill -0 "$p" 2>/dev/null; then
        kill -9 "$p" 2>/dev/null
        log "pakotettu $p ($cwd, käynnissä ${age} s)"
    else
        log "sammutettu $p ($cwd, käynnissä ${age} s)"
    fi
done

# Loki ei saa kasvaa rajatta: säilytetään viimeiset 500 riviä.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
