#!/usr/bin/env bash
# Sobe um Postgres descartável para os testes de banco (*.dbtest.ts).
# Requer os binários do Postgres e execução como root (usa o usuário "postgres").
# Fora deste ambiente, aponte TEST_DATABASE_URL para um Postgres seu e pule este script.
set -euo pipefail
DIR=/var/tmp/concursos-pg
PORT=54329
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)

case "${1:-}" in
  start)
    if [ ! -d "$DIR/data" ]; then
      mkdir -p "$DIR"
      chown postgres "$DIR"
      su postgres -c "$BIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
    fi
    if ! su postgres -c "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
      su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start" >/dev/null
    fi
    echo "Postgres de teste: postgresql://postgres@127.0.0.1:$PORT/postgres"
    ;;
  stop)
    su postgres -c "$BIN/pg_ctl -D $DIR/data -w stop" >/dev/null
    echo "Postgres de teste parado"
    ;;
  *)
    echo "uso: $0 start|stop" >&2
    exit 1
    ;;
esac
