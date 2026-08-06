# Managed by Codex Self Improvement
[[ -n "${_CODEX_SELF_IMPROVEMENT_ENV_LOADED:-}" ]] && return 0
typeset -g _CODEX_SELF_IMPROVEMENT_ENV_LOADED=1
export CODEX_SELF_IMPROVEMENT_ROOT="__HARNESS_ROOT__"
export CODEX_SELF_IMPROVEMENT_ENABLED=1
export CODEX_SELF_IMPROVEMENT_DATA="${XDG_STATE_HOME:-$HOME/.local/state}/codex-self-improvement"
export PATH="$HOME/.config/kaku/zsh/bin:$HOME/.local/bin:$PATH"
