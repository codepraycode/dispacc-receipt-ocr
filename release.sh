#!/usr/bin/env bash
# =============================================================================
# release.sh — Smart release script for receipt-ocr-ng
# Usage: ./release.sh [patch|minor|major]
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }
step()    { echo -e "\n${BOLD}── $* ${RESET}"; }

# ── Args ─────────────────────────────────────────────────────────────────────
BUMP="${1:-}"
if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
    die "Usage: ./release.sh [patch|minor|major]"
fi

# ── 1. Detect package manager ─────────────────────────────────────────────────
step "Detecting package manager"
if command -v pnpm &>/dev/null && [[ -f "pnpm-lock.yaml" ]]; then
    PKG="pnpm"
elif command -v yarn &>/dev/null && [[ -f "yarn.lock" ]]; then
    PKG="yarn"
else
    PKG="npm"
fi
success "Using $PKG"

# ── 2. Check npm auth ─────────────────────────────────────────────────────────
step "Checking npm authentication"
NPM_USER=$(npm whoami 2>/dev/null || true)
if [[ -z "$NPM_USER" ]]; then
    warn "You are not logged into npm."
    echo ""
    echo -e "  If you have 2FA enabled on npm, ${BOLD}npm login won't work${RESET} for publishing."
    echo -e "  You need a Granular Access Token instead:"
    echo -e "  👉  https://www.npmjs.com/settings/~/tokens/granular-access-tokens/new"
    echo -e "  Set permissions to ${BOLD}Read and write${RESET}, then paste the token below.\n"
    read -rsp "$(echo -e "${YELLOW}Paste your npm token (input hidden):${RESET} ")" NPM_TOKEN
    echo ""
    [[ -z "$NPM_TOKEN" ]] && die "No token provided. Aborting."
    npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
    NPM_USER=$(npm whoami 2>/dev/null || true)
    [[ -z "$NPM_USER" ]] && die "Token appears invalid — npm whoami still failed."
fi
success "Logged in as: $NPM_USER"

# ── 3. Check package name availability / ownership ────────────────────────────
step "Checking package name on npm registry"
PKG_NAME=$(node -p "require('./package.json').name")
PKG_VERSION=$(node -p "require('./package.json').version")
info "Package: $PKG_NAME @ $PKG_VERSION"

REGISTRY_INFO=$(npm view "$PKG_NAME" --json 2>/dev/null || echo "NOT_FOUND")

if [[ "$REGISTRY_INFO" == "NOT_FOUND" ]]; then
    warn "Package '$PKG_NAME' does not exist on npm yet — this will be the first publish."
else
    OWNER=$(echo "$REGISTRY_INFO" | node -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const m = d.maintainers || [];
        console.log(m.map(u => typeof u === 'string' ? u.split('<')[0].trim() : u.name).join(', '));
    " 2>/dev/null || true)

    if [[ -n "$OWNER" && "$OWNER" != *"$NPM_USER"* ]]; then
        die "Package '$PKG_NAME' is owned by '$OWNER', not '$NPM_USER'. Rename it or use a scope like @$NPM_USER/$PKG_NAME."
    fi
    success "Package exists and you have access."
fi

# ── 4. Clean working tree check ───────────────────────────────────────────────
step "Checking git working tree"
if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "You have uncommitted changes:"
    git status --short
    echo ""
    read -rp "$(echo -e "${YELLOW}Continue anyway? [y/N]:${RESET} ")" CONTINUE
    [[ "$CONTINUE" =~ ^[Yy]$ ]] || die "Aborting. Please commit or stash your changes first."
fi
success "Working tree is clean (or proceeding with your consent)"

# ── 5. Ensure we're on main/master ────────────────────────────────────────────
step "Checking current branch"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    warn "You are on branch '$CURRENT_BRANCH', not main/master."
    read -rp "$(echo -e "${YELLOW}Continue releasing from this branch? [y/N]:${RESET} ")" CONTINUE
    [[ "$CONTINUE" =~ ^[Yy]$ ]] || die "Aborting. Switch to main/master first."
fi
success "On branch: $CURRENT_BRANCH"

# ── 6. Build ──────────────────────────────────────────────────────────────────
step "Building"
$PKG run build || die "Build failed. Fix errors before releasing."
success "Build passed"

# ── 7. Bump version ───────────────────────────────────────────────────────────
step "Bumping version ($BUMP)"
npm version "$BUMP" -m "chore: release v%s" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")

# Commit and tag manually so it works regardless of package manager
git add package.json
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"
success "Version bumped to v$NEW_VERSION"

# ── 8. Push to git ────────────────────────────────────────────────────────────
step "Pushing to git"
git push origin "$CURRENT_BRANCH" || die "git push failed."
git push origin "v$NEW_VERSION"   || die "git push --tags failed."
success "Pushed branch and tag v$NEW_VERSION"

# ── 9. Publish to npm ─────────────────────────────────────────────────────────
step "Publishing to npm"

# Scoped packages need --access public explicitly; unscoped ones don't care but it's harmless
if [[ "$PKG_NAME" == @* ]]; then
    npm publish --access public || die "npm publish failed."
else
    npm publish || die "npm publish failed."
fi

success "Published $PKG_NAME@$NEW_VERSION to npm 🎉"

echo -e "\n${GREEN}${BOLD}Release v$NEW_VERSION complete!${RESET}"
echo -e "  npm: https://www.npmjs.com/package/$PKG_NAME"
echo -e "  tag: https://github.com/codepraycode/dispacc-receipt-ocr/releases/tag/v$NEW_VERSION\n"