#!/bin/bash
# Helper script to add the high-resolution logo

echo "🎨 Wozzlar Logo Addition Helper"
echo "================================"
echo ""

# Check if a file path was provided
if [ -z "$1" ]; then
    echo "Usage: ./add-logo.sh /path/to/your/wozzlar-logo.png"
    echo ""
    echo "This script will:"
    echo "  1. Copy your logo to public/images/wozzlar-logo.png"
    echo "  2. Verify it's a PNG file"
    echo "  3. Show you the file size"
    echo "  4. Stage it for commit"
    echo ""
    echo "Looking for wozzlar-logo.png in common locations..."
    
    # Search for the file
    found_files=$(find . -maxdepth 3 -name "wozzlar-logo.png" -size +20k 2>/dev/null | grep -v "src/images")
    
    if [ -n "$found_files" ]; then
        echo ""
        echo "Found these files:"
        echo "$found_files"
        echo ""
        echo "Run: ./add-logo.sh <path-from-above>"
    else
        echo ""
        echo "❌ No logo file found. Please:"
        echo "   1. Save your 512x512 wozzlar-logo.png somewhere"
        echo "   2. Run: ./add-logo.sh /path/to/wozzlar-logo.png"
    fi
    exit 1
fi

SOURCE_FILE="$1"

# Check if source file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "❌ Error: File not found: $SOURCE_FILE"
    exit 1
fi

# Check if it's a PNG
if ! file "$SOURCE_FILE" | grep -q "PNG"; then
    echo "⚠️  Warning: This doesn't appear to be a PNG file"
    file "$SOURCE_FILE"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Show file info
echo "📊 File Information:"
ls -lh "$SOURCE_FILE"
echo ""

# Get image dimensions if possible
if command -v identify &> /dev/null; then
    echo "📐 Image Dimensions:"
    identify "$SOURCE_FILE"
    echo ""
fi

# Copy the file
DEST_FILE="public/images/wozzlar-logo.png"
echo "📁 Copying to: $DEST_FILE"
cp "$SOURCE_FILE" "$DEST_FILE"

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully!"
    echo ""
    echo "📦 Staging for commit..."
    git add "$DEST_FILE"
    
    echo ""
    echo "✨ Done! Next steps:"
    echo "   1. Review changes: git status"
    echo "   2. Commit: git commit -m 'Add high-resolution 512x512 logo'"
    echo "   3. Push: git push"
    echo ""
    echo "The logo will appear under the Wozzlar heading at 180x180 pixels!"
else
    echo "❌ Error copying file"
    exit 1
fi
