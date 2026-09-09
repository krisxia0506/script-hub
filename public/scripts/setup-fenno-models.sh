#!/bin/sh
set -eu

codex_home=${CODEX_HOME:-"${HOME}/.codex"}
config=${codex_home}/config.toml
catalog_dir=${codex_home}/model-catalogs
catalog=${catalog_dir}/fenno.json

mkdir -p "$codex_home" "$catalog_dir"

token=${FENNO_API_KEY:-${CODEX_FENNO_TOKEN:-}}
if [ -z "$token" ] && [ -f "$config" ]; then
  token=$(awk '
    /^[[:space:]]*experimental_bearer_token[[:space:]]*=/ {
      line = $0
      sub(/^[^"]*"/, "", line)
      sub(/".*/, "", line)
      print line
      exit
    }
  ' "$config")
fi

if [ -f "$config" ]; then
  backup=${config}.bak-fenno-$(date +%Y%m%d%H%M%S)
  cp -p "$config" "$backup"
  printf 'backup %s\n' "$backup"
fi

cat >"$catalog" <<'FENNO_CATALOG'
{"models":[{"slug":"gpt-5.4-mini","display_name":"GPT-5.4 Mini","description":"Small, fast GPT-5.4 for simpler coding tasks.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":8,"additional_speed_tiers":[],"service_tiers":[],"context_window":272000,"max_context_window":272000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"gpt-5.6-luna","display_name":"GPT-5.6 Luna","description":"Fast and affordable GPT-5.6.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":5,"additional_speed_tiers":[],"service_tiers":[],"context_window":1050000,"max_context_window":1050000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"gpt-5.6-sol","display_name":"GPT-5.6 Sol","description":"Balanced GPT-5.6 for most coding work.","default_reasoning_level":"low","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"},{"effort":"ultra","description":"Maximum reasoning with automatic task splitting"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":3,"additional_speed_tiers":[],"service_tiers":[],"context_window":1050000,"max_context_window":1050000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"gpt-5.6-terra","display_name":"GPT-5.6 Terra","description":"Higher-capability GPT-5.6.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"},{"effort":"ultra","description":"Maximum reasoning with automatic task splitting"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":4,"additional_speed_tiers":[],"service_tiers":[],"context_window":1050000,"max_context_window":1050000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"gpt-5.5","display_name":"GPT-5.5","description":"GPT-5.5 coding model.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":6,"additional_speed_tiers":[],"service_tiers":[],"context_window":1050000,"max_context_window":1050000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"gpt-5.4","display_name":"GPT-5.4","description":"GPT-5.4 coding model.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":7,"additional_speed_tiers":[],"service_tiers":[],"context_window":1050000,"max_context_window":1050000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"codex-auto-review","display_name":"Codex Auto Review","description":"Automatic approval review model for Codex.","default_reasoning_level":"medium","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"}],"shell_type":"unified_exec","visibility":"none","supported_in_api":true,"priority":9,"additional_speed_tiers":[],"service_tiers":[],"context_window":272000,"max_context_window":872000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"grok-4.5","display_name":"Grok 4.5","description":"xAI Grok 4.5: 500k-context coding model. Official efforts: low/medium/high.","default_reasoning_level":"high","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":2,"additional_speed_tiers":[],"service_tiers":[],"context_window":500000,"max_context_window":500000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false},{"slug":"grok-4.6","display_name":"Grok 4.6","description":"xAI Grok 4.6: 500k-context frontier model. Official efforts: low/medium/high/xhigh.","default_reasoning_level":"high","supported_reasoning_levels":[{"effort":"low","description":"Fast responses with lighter reasoning"},{"effort":"medium","description":"Balances speed and reasoning depth for everyday tasks"},{"effort":"high","description":"Greater reasoning depth for complex problems"},{"effort":"xhigh","description":"Extra high reasoning depth for complex problems"},{"effort":"max","description":"Maximum reasoning depth for the hardest problems"}],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":1,"additional_speed_tiers":[],"service_tiers":[],"context_window":500000,"max_context_window":500000,"effective_context_window_percent":95,"input_modalities":["text","image"],"used_fallback_model_metadata":false}]}
FENNO_CATALOG
printf 'wrote %s (9 models)\n' "$catalog"

old_config=$(mktemp "${codex_home}/.fenno-old.XXXXXX")
new_config=$(mktemp "${codex_home}/.fenno-new.XXXXXX")
trap 'rm -f "$old_config" "$new_config"' 0 HUP INT TERM

if [ -f "$config" ]; then
  awk '
    /^#:schema[[:space:]]/ { next }
    /^\[model_providers\.fenno\][[:space:]]*$/ { skip = 1; next }
    skip && /^\[/ { skip = 0 }
    skip { next }
    /^(model|model_reasoning_effort|model_provider|model_catalog_json|model_context_window)[[:space:]]*=/ { next }
    { print }
  ' "$config" >"$old_config"
fi

escaped_catalog=$(printf '%s' "$catalog" | sed 's/[\\"]/\\&/g')
escaped_token=$(printf '%s' "$token" | sed 's/[\\"]/\\&/g')
{
  printf '%s\n' '#:schema https://developers.openai.com/codex/config-schema.json'
  printf '%s\n' 'model = "grok-4.6"'
  printf '%s\n' 'model_reasoning_effort = "max"'
  printf '%s\n' 'model_provider = "fenno"'
  printf 'model_catalog_json = "%s"\n' "$escaped_catalog"
  printf '%s\n\n' 'model_context_window = 500000'
  cat "$old_config"
  printf '\n'
  printf '%s\n' '[model_providers.fenno]'
  printf '%s\n' 'request_max_retries = 15'
  printf '%s\n' 'name = "Fenno"'
  printf '%s\n' 'base_url = "https://llmapi.qiniu.io/v1"'
  printf '%s\n' 'wire_api = "responses"'
  if [ -n "$escaped_token" ]; then
    printf 'experimental_bearer_token = "%s"\n' "$escaped_token"
  fi
} >"$new_config"
mv "$new_config" "$config"
printf 'updated %s\n' "$config"

if [ -z "$token" ]; then
  printf '%s\n' 'missing Fenno token: set FENNO_API_KEY or add experimental_bearer_token'
fi
printf '%s\n' 'fully quit Codex TUI/Desktop, then run: codex'
