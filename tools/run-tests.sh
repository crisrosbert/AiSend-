#!/bin/bash
# Sandbox-only helper: runs the new tests against the untouched repo copy with the stand-in runner.
cd "$(dirname "$0")/.."
TS_API=/sessions/nifty-trusting-lovelace/.npm/_npx/2b0c79b2deda3034/node_modules/typescript OVERLAY_SRC="$PWD/src" node ../issues-v3b/tools/mini-vitest-runner.cjs "/sessions/nifty-trusting-lovelace/mnt/AiSend--main (9)/AiSend--main/src" "$@"
