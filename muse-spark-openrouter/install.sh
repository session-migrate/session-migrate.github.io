#!/bin/sh
# POSIX user-level installer for muse-spark-openrouter-patch.

set -eu

package_name="muse-spark-openrouter-patch"
package_version="0.1.0"
wheel_name="muse_spark_openrouter_patch-${package_version}-py3-none-any.whl"
wheel_sha256="5d4f3701da9e9fe8c0350a9bc56e3b1b2e7cebe43902069d45874839d7e07f8b"
release_base_url="${MUSE_SPARK_INSTALL_BASE_URL:-https://session-migrate.github.io/muse-spark-openrouter/releases/${package_version}}"
pypi_index_url="${MUSE_SPARK_PYPI_INDEX_URL:-https://pypi.org/simple}"
package_spec="${package_name}==${package_version}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Install Muse Spark OpenRouter support for the current user.

Usage:
  curl -LsSf https://session-migrate.github.io/muse-spark-openrouter/install.sh | sh
  sh install.sh [options]

Options:
  --install-only       Install commands without storing a key or changing Codex.
  --no-set-default     Configure without making Muse Spark the default model.
  --model MODEL        OpenRouter model slug (default: meta/muse-spark-1.2).
  --port PORT          Compatibility-proxy port (default: 8787).
  --no-validate        Skip live OpenRouter key validation.
  --no-systemd         Use a detached process instead of a systemd user service.
  --no-patch-shell     Leave an existing OPENROUTER_API_KEY export unchanged.
  -h, --help           Show this help.

The installer never accepts an API key as a command-line argument. Setup reads
it from a hidden /dev/tty prompt and stores it in a mode-0600 credential file.
EOF
}

install_only=0
set_default=1
model="meta/muse-spark-1.2"
port="8787"
no_validate=0
no_systemd=0
no_patch_shell=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-only)
      install_only=1
      shift
      ;;
    --no-set-default)
      set_default=0
      shift
      ;;
    --model)
      [ "$#" -ge 2 ] || die "--model requires a value"
      model="$2"
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || die "--port requires a value"
      port="$2"
      shift 2
      ;;
    --no-validate)
      no_validate=1
      shift
      ;;
    --no-systemd)
      no_systemd=1
      shift
      ;;
    --no-patch-shell)
      no_patch_shell=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (run with --help)"
      ;;
  esac
done

case "$port" in
  ''|*[!0-9]*) die "--port must be numeric" ;;
esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
  die "--port must be between 1 and 65535"
fi

script_dir=""
case "$0" in
  */*) script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null && pwd -P) || script_dir='' ;;
esac

temporary_dir=""
temporary_wheel=""
wheel_path=""
cleanup() {
  if [ -n "$temporary_wheel" ] && [ -f "$temporary_wheel" ]; then
    rm -f -- "$temporary_wheel"
  fi
  if [ -n "$temporary_dir" ] && [ -d "$temporary_dir" ]; then
    rmdir -- "$temporary_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 1' HUP INT TERM

verify_wheel() {
  checked_wheel=$1
  if command -v sha256sum >/dev/null 2>&1; then
    actual_sha256=$(sha256sum "$checked_wheel" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    actual_sha256=$(shasum -a 256 "$checked_wheel" | awk '{print $1}')
  elif command -v openssl >/dev/null 2>&1; then
    actual_sha256=$(openssl dgst -sha256 "$checked_wheel" | awk '{print $NF}')
  else
    die "sha256sum, shasum, or openssl is required to verify the release"
  fi
  [ "$actual_sha256" = "$wheel_sha256" ] || die "release checksum mismatch"
  printf 'Verified fallback release checksum.\n'
}

prepare_fallback_wheel() {
  if [ -n "$wheel_path" ]; then
    return
  fi
  temporary_dir=$(mktemp -d "${TMPDIR:-/tmp}/muse-spark-openrouter.XXXXXXXX")
  temporary_wheel="$temporary_dir/$wheel_name"
  wheel_url="$release_base_url/$wheel_name"
  printf 'Downloading checksum-pinned fallback for %s %s...\n' "$package_name" "$package_version"
  if command -v curl >/dev/null 2>&1; then
    curl -LsSf --retry 3 --output "$temporary_wheel" "$wheel_url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$temporary_wheel" "$wheel_url"
  else
    die "curl or wget is required to download the release"
  fi
  wheel_path="$temporary_wheel"
  verify_wheel "$wheel_path"
}

if [ -n "$script_dir" ] && [ -f "$script_dir/dist/$wheel_name" ]; then
  wheel_path="$script_dir/dist/$wheel_name"
  verify_wheel "$wheel_path"
fi

printf 'Installing %s %s for user %s...\n' "$package_name" "$package_version" "$(id -un)"
installed_command=""

if command -v uv >/dev/null 2>&1; then
  if [ -n "$wheel_path" ]; then
    uv tool install --force "$wheel_path"
  elif ! uv tool install --force --default-index "$pypi_index_url" "$package_spec"; then
    printf 'PyPI installation failed; using the verified release fallback.\n' >&2
    prepare_fallback_wheel
    uv tool install --force "$wheel_path"
  fi
  uv_bin_dir="${UV_TOOL_BIN_DIR:-$HOME/.local/bin}"
  if [ -x "$uv_bin_dir/muse-spark-openrouter" ]; then
    installed_command="$uv_bin_dir/muse-spark-openrouter"
  elif command -v muse-spark-openrouter >/dev/null 2>&1; then
    installed_command=$(command -v muse-spark-openrouter)
  fi
else
  python="${PYTHON:-python3}"
  command -v "$python" >/dev/null 2>&1 || die "Python 3.10+ or uv is required"
  "$python" -c 'import sys; raise SystemExit(sys.version_info < (3, 10))' \
    || die "Python 3.10 or newer is required"

  data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
  install_dir="${MUSE_SPARK_INSTALL_DIR:-$data_home/muse-spark-openrouter/tool}"
  mkdir -p -- "$install_dir" "$bin_dir"
  for command_name in muse-spark-openrouter codex-muse; do
    destination="$bin_dir/$command_name"
    if [ -e "$destination" ] && [ ! -L "$destination" ]; then
      die "refusing to replace existing file: $destination"
    fi
  done

  "$python" -m venv "$install_dir"
  if [ -n "$wheel_path" ]; then
    "$install_dir/bin/python" -m pip install \
      --disable-pip-version-check --force-reinstall "$wheel_path"
  elif ! "$install_dir/bin/python" -m pip install \
    --disable-pip-version-check --index-url "$pypi_index_url" \
    --force-reinstall "$package_spec"; then
    printf 'PyPI installation failed; using the verified release fallback.\n' >&2
    prepare_fallback_wheel
    "$install_dir/bin/python" -m pip install \
      --disable-pip-version-check --force-reinstall "$wheel_path"
  fi
  ln -sfn -- "$install_dir/bin/muse-spark-openrouter" "$bin_dir/muse-spark-openrouter"
  ln -sfn -- "$install_dir/bin/codex-muse" "$bin_dir/codex-muse"
  installed_command="$bin_dir/muse-spark-openrouter"
fi

if [ -z "$installed_command" ] || [ ! -x "$installed_command" ]; then
  die "installation completed but muse-spark-openrouter was not found"
fi
printf 'Installed command: %s\n' "$installed_command"

if [ "$install_only" -eq 1 ]; then
  printf 'Installation complete. Run: %s setup --set-default\n' "$installed_command"
  exit 0
fi

set -- setup --model "$model" --port "$port"
[ "$set_default" -eq 1 ] && set -- "$@" --set-default
[ "$no_validate" -eq 1 ] && set -- "$@" --no-validate
[ "$no_systemd" -eq 1 ] && set -- "$@" --no-systemd
[ "$no_patch_shell" -eq 1 ] && set -- "$@" --no-patch-shell

if [ -r /dev/tty ]; then
  "$installed_command" "$@" </dev/tty
else
  die "interactive setup needs a terminal; rerun setup directly after installation"
fi
"$installed_command" doctor --port "$port"

printf '\n%s\n' 'Muse Spark is ready. Run codex-muse, or open a new Codex task.'
