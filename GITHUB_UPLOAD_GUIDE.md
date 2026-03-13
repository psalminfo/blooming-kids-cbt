# How to put this on GitHub — Step by Step

## What you have

35 files that replace your current management.js + management.html setup.
Your live site stays up the whole time. You only go live when YOU decide to merge.

---

## Step 1 — Create a safe branch

1. Open your GitHub repo in the browser
2. Click the branch dropdown (it says "main" or "master")  
3. Type:   modular-refactor
4. Click "Create branch: modular-refactor"

Everything you upload goes here. Your live site is untouched.

---

## Step 2 — Upload the files

GitHub accepts drag-and-drop folder uploads.

1. Make sure you are on the "modular-refactor" branch
2. Click "Add file" → "Upload files"
3. Open the folder you downloaded from here
4. Drag the ENTIRE contents into the GitHub upload box:
   - management.html
   - management-auth.html  
   - management-auth.js
   - main.js
   - README.md
   - GITHUB_UPLOAD_GUIDE.md
   - The folders:  core/   panels/   modals/   notifications/

5. Scroll down. Write commit message:
      add modular file structure
6. Click "Commit changes"

If your browser does not support folder drag-and-drop, upload in batches:
   Batch 1: all root-level files (management.html, main.js, etc.)
   Batch 2: everything inside core/
   Batch 3: everything inside panels/
   Batch 4: everything inside modals/
   Batch 5: everything inside notifications/

---

## Step 3 — Check the Netlify preview

Netlify automatically builds a preview for every branch.

1. Go to your Netlify dashboard
2. Click "Deploys"  
3. Look for a deploy from branch "modular-refactor"
4. Click the preview URL
5. Log in and test every panel — tutor directory, enrollments, pay advice, messaging, everything

If it all works: go to Step 4.
If something looks broken: come back here, describe what you see, and we will fix it.

---

## Step 4 — Go live (merge to main)

When you are happy the preview works:

1. In GitHub, click "Pull requests"
2. Click "New pull request"
3. Set:  base: main  ←  compare: modular-refactor
4. Click "Create pull request"
5. Click "Merge pull request"
6. Netlify auto-deploys. Your live site is now on the new structure.

---

## Step 5 — Clean up

After confirming the live site works:
1. Delete management.js from the repo (it is fully replaced by main.js + the module files)
2. Optionally delete the modular-refactor branch

---

## Adding new features going forward

New panel:
  1. Create  panels/myPanel.js
  2. Export your render function:  export async function renderMyPanel(container) { ... }
  3. In core/auth.js — add the import at the top and add a nav entry in navigationGroups
  4. Done. No other files change.

New shared helper:
  Put it in core/utils.js and export it. Import it wherever needed.

Firebase version upgrade:
  Change the version string in core/firebase.js only. One line. Done.
