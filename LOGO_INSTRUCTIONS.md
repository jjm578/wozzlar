# Logo File Instructions

## Current Issue
The splash screen logo is using a low-resolution Windows icon file (48x48 max) from `src/images/wozzlar-logo.png`.

## Solution Required
Please add your high-resolution 512x512 PNG logo file to replace the current low-quality version.

### Option 1: Replace existing file (Recommended)
Replace the file at: `src/images/wozzlar-logo.png`
- Use the 512x512 PNG version
- Keep the same filename
- The splash screen will automatically use the higher quality image

### Option 2: Use public folder structure  
If you prefer to organize assets in a public folder:
1. Create `public/images/` folder
2. Add `wozzlar-logo.png` (512x512) there
3. Update `src/index.html` line 29 to: `<img src="../public/images/wozzlar-logo.png"...`

## Current Display Settings
- Logo displays at 180x180 pixels on splash screen
- Positioned directly under "Wozzlar" heading
- Has rounded corners (20px border-radius)
- Fades in with animation

## File Specifications
- Format: PNG
- Recommended size: 512x512 pixels
- Transparent background preferred
- Should be clear and high-quality for crisp display
