#!/bin/bash
# Simple release script
# Usage: ./release.sh [patch|minor|major]

set -e

RELEASE_TYPE=${1:-patch}

echo "🚀 Starting $RELEASE_TYPE release..."

# Make sure we're on main branch
if [ "$(git branch --show-current)" != "main" ]; then
    echo "❌ Please switch to main branch first"
    exit 1
fi

# Make sure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory is not clean. Please commit your changes first."
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Run the release
echo "🔖 Creating $RELEASE_TYPE release..."
npm run "release:$RELEASE_TYPE"

echo "✅ Release completed successfully!"
echo "📦 GitHub Actions will automatically build and publish to npm"
echo "🔗 Check the Actions tab: https://github.com/Skulldorom/react-session.mananger.sk/actions"
