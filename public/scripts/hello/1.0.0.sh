#!/bin/sh
set -eu

printf '%s\n' 'Script Hub is working.'
printf 'OS: %s\n' "$(uname -s 2>/dev/null || printf '%s' 'unknown')"
printf 'Arch: %s\n' "$(uname -m 2>/dev/null || printf '%s' 'unknown')"
