# 🎨 How to Add Your High-Resolution Logo

## Quick Start

You have **3 easy ways** to add your 512x512 wozzlar-logo.png file:

---

### Method 1: Using the Helper Script (Easiest!) ⭐

1. **Drag your logo file** into the root of the repository (the same folder as this README)
2. **Open the terminal** in Codespaces (Terminal → New Terminal)
3. **Run this command:**
   ```bash
   ./add-logo.sh wozzlar-logo.png
   ```
4. **Follow the prompts** - the script will do everything for you!

---

### Method 2: Manual Copy (Simple)

1. **Using the File Explorer** in VS Code:
   - Find your `wozzlar-logo.png` file
   - Drag it into the `public/images/` folder
   
2. **Commit the file:**
   - Open Source Control panel (Ctrl+Shift+G or click the branch icon)
   - You should see `public/images/wozzlar-logo.png` listed
   - Click the **+** icon next to the file name to stage it
   - Type a commit message: "Add high-resolution logo"
   - Click the ✓ checkmark to commit
   - Click **"Sync Changes"** to push to GitHub

---

### Method 3: Command Line

```bash
# Copy your file to the right location
cp /path/to/your/wozzlar-logo.png public/images/wozzlar-logo.png

# Add it to git
git add public/images/wozzlar-logo.png

# Commit it
git commit -m "Add high-resolution 512x512 logo"

# Push it
git push
```

---

## What Happens Next?

Once you add the file, the splash screen will automatically:
- ✅ Use your high-resolution 512x512 PNG
- ✅ Display it at 180x180 pixels (nice and crisp!)
- ✅ Show it directly under the "Wozzlar" heading
- ✅ Look professional and clear (no more blur!)

---

## Troubleshooting

### "I can't find my file"
- Check your Downloads folder
- Look on your Desktop
- Make sure it's named exactly `wozzlar-logo.png`

### "The file didn't upload"
- Try Method 1 (helper script) - it's the most reliable
- Make sure you're in the Codespaces environment
- Check that you have write permissions

### "I see errors"
- Run: `git status` to see what's happening
- Run: `./add-logo.sh` without arguments for help
- Make sure the file is actually a PNG (not renamed)

---

## Need Help?

Run the helper script without arguments for automatic detection:
```bash
./add-logo.sh
```

It will search for your logo file and guide you through the process!
