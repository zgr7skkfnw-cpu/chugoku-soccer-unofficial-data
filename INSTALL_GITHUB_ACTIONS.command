#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "GitHubリポジトリのフォルダをこのウィンドウへドラッグして、Enterを押してください:"
read REPO
REPO="${REPO%/}"
mkdir -p "$REPO/.github/workflows"
cp "$SCRIPT_DIR/GITHUB_ACTIONS_FILES/sync-results.yml" "$REPO/.github/workflows/sync-results.yml"
echo "作成しました: $REPO/.github/workflows/sync-results.yml"
echo "GitHub Desktopへ戻ってCommitとPushをしてください。"
read -p "Enterで終了"
