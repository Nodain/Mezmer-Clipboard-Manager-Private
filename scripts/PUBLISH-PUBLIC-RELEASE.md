# Publishing a release (maintainers)

Use a **private** repo for full source and a **public** repo that only contains `release-public/README.md` plus GitHub Release installers.

## One-time setup

### 1. Private repo (full source)

On GitHub: create **Mezmer-Clipboard-Manager** as **Private** (no README).

```powershell
cd "C:\Users\AEGISLJR\Desktop\Projects\Mezmer-Clipboard-Manager"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Mezmer-Clipboard-Manager.git
git push -u origin main
```

### 2. Public releases repo

On GitHub: create **Mezmer-Clipboard-Manager-Releases** as **Public** (no README).

Edit `release-public/README.md` — replace every `YOUR_USERNAME` with your GitHub username.

```powershell
cd "C:\Users\AEGISLJR\Desktop\Projects\Mezmer-Clipboard-Manager\release-public"
git init
git add README.md .gitignore
git commit -m "Add release page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Mezmer-Clipboard-Manager-Releases.git
git push -u origin main
```

Only push `README.md` and `.gitignore` from `release-public/` — nothing else.

---

## Each new version

From the **private** project root:

```powershell
.\scripts\prepare-public-release.ps1
```

This builds the MSI and copies it to `release-public\artifacts\`.

### Publish on GitHub (website)

1. Open `https://github.com/YOUR_USERNAME/Mezmer-Clipboard-Manager-Releases/releases`
2. **Draft a new release**
3. Tag: `v0.1.0` (match `src-tauri/tauri.conf.json`)
4. Title: `Mezmer Clipboard 0.1.0`
5. Upload `release-public\artifacts\Mezmer-Clipboard-0.1.0-x64.msi`
6. **Publish release**

Do **not** commit `.msi` files to git.

### Publish with GitHub CLI (optional)

```powershell
gh release create v0.1.0 `
  --repo YOUR_USERNAME/Mezmer-Clipboard-Manager-Releases `
  --title "Mezmer Clipboard 0.1.0" `
  --notes "Windows installer for Mezmer Clipboard." `
  "C:\Users\AEGISLJR\Desktop\Projects\Mezmer-Clipboard-Manager\release-public\artifacts\Mezmer-Clipboard-0.1.0-x64.msi"
```

---

## Repo summary

| Repo | Visibility | Contents |
|------|------------|----------|
| `Mezmer-Clipboard-Manager` | **Private** | Full source, scripts, dev README |
| `Mezmer-Clipboard-Manager-Releases` | **Public** | User README + Release MSI files only |
