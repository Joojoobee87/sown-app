#!/bin/bash
# Deployment script for Vercel
echo "🚀 Starting deployment process..."

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📤 Pushing to master branch..."
    git add .
    git commit -m "Auto deployment $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin master
    echo "🎉 Deployment pushed to Vercel!"
else
    echo "❌ Build failed!"
    exit 1
fi
