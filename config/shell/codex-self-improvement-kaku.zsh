# Managed by Codex Self Improvement for interactive Kaku panes
[[ -n "${_CODEX_SELF_IMPROVEMENT_KAKU_LOADED:-}" ]] && return 0
typeset -g _CODEX_SELF_IMPROVEMENT_KAKU_LOADED=1
[[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/codex-self-improvement/env.zsh" ]] && source "${XDG_CONFIG_HOME:-$HOME/.config}/codex-self-improvement/env.zsh"
export CODEX_SELF_IMPROVEMENT_SURFACE="kaku"

_csi_terminal_session() {
  local terminal_id="${TTY:-${WEZTERM_PANE:-${PPID:-shell}}}"
  builtin print -rn -- "$terminal_id"
}

typeset -g _CSI_COMMAND_TRACKED=0

_csi_preexec() {
  local command_text="$1"
  _CSI_COMMAND_TRACKED=0
  case "$command_text" in
    (*'>'*|*'apply_patch'*|rm\ *|mv\ *|cp\ *|touch\ *|mkdir\ *|install\ *|sed\ -i*|perl\ -pi*|git\ checkout*|git\ restore*|git\ reset*|git\ clean*|git\ apply*|npm\ install*|pnpm\ add*|pnpm\ install*|yarn\ add*|bun\ test*|bun\ run*|npm\ test*|npm\ run*|pnpm\ test*|pnpm\ run*|yarn\ test*|pytest*|python\ -m\ pytest*|cargo\ test*|go\ test*|dotnet\ test*|mvn\ *test*|gradle*test*|swift\ test*|xcodebuild*test*|git\ diff\ --check*|codex*|claude*|gemini*|aider*|delegate-team*)
      _CSI_COMMAND_TRACKED=1
      command codex-harness terminal preexec --session "$(_csi_terminal_session)" --command "$command_text" >/dev/null 2>&1 || true
      ;;
  esac
}

_csi_precmd() {
  local exit_code=$?
  local message=""
  [[ "${_CSI_COMMAND_TRACKED:-0}" == "1" ]] || return 0
  _CSI_COMMAND_TRACKED=0
  message="$(command codex-harness terminal postexec --session "$(_csi_terminal_session)" --exit-code "$exit_code" 2>/dev/null)" || true
  [[ -n "$message" ]] && builtin print -r -- "$message"
}

codex() {
  export CODEX_SELF_IMPROVEMENT_SURFACE="kaku-codex"
  command codex "$@"
}


_codex_harness() {
  local -a commands
  commands=(
    'status:show installed surfaces and versions'
    'doctor:run Codex plugin shell and Kaku checks'
    'paths:list reviewed harness paths'
    'plugin:manage the native Codex plugin'
    'shell:manage zsh and Kaku integration'
    'terminal:inspect bounded terminal evidence state'
    'codex:launch the original Codex executable'
    'install:install shell integration and plugin'
    'uninstall:remove shell integration and plugin'
    'version:show harness and plugin versions'
  )
  _arguments '1:command:->command' '*::argument:->argument'
  case "$state" in
    command) _describe 'command' commands ;;
    argument)
      case "${words[2]}" in
        paths) _values 'action' list ;;
        plugin|shell) _values 'action' status install uninstall ;;
        terminal) _values 'action' status preexec postexec ;;
      esac
      ;;
  esac
}

if (( ${+functions[compdef]} )); then
  compdef _codex_harness codex-harness cxh
fi

autoload -Uz add-zsh-hook
add-zsh-hook -d preexec _csi_preexec 2>/dev/null || true
add-zsh-hook -d precmd _csi_precmd 2>/dev/null || true
add-zsh-hook preexec _csi_preexec
add-zsh-hook precmd _csi_precmd
precmd_functions=(_csi_precmd "${precmd_functions[@]:#_csi_precmd}")
