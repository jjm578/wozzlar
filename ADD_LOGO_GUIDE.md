# How to Add the High-Resolution Logo

## Steps to Add Your 512x512 Logo:

### Option 1: Using Git Command Line (Recommended)
1. Make sure your `wozzlar-logo.png` file (512x512) is in the correct location
2. Run these commands:
   ```bash
   cp /path/to/your/wozzlar-logo.png public/images/wozzlar-logo.png
   git add public/images/wozzlar-logo.png
   git commit -m "Add high-resolution 512x512 logo to public/images"
   git push
   ```

### Option 2: Using Codespaces UI
1. In the VS Code Explorer, navigate to the `public/images/` folder
2. Drag your `wozzlar-logo.png` file into that folder
3. In the Source Control panel (Ctrl+Shift+G), you should see the new file
4. Click the "+" icon next to the file to stage it
5. Enter a commit message like "Add high-resolution logo"
6. Click the checkmark to commit
7. Click "Sync Changes" or push to upload

### What the Logo Should Be:
- **Size**: 512x512 pixels
- **Format**: PNG
- **Location**: `public/images/wozzlar-logo.png`
- **Display**: Will be shown at 180x180 pixels on the splash screen

### Current Status:
- ❌ Current logo in `src/images/` is only 48x48 pixels (icon file)
- ✅ Splash screen HTML is already configured to look for the logo
- ⏳ Waiting for the 512x512 PNG to be added to `public/images/`

Once you add the file, the code will automatically use it and it will look crisp and clear!
