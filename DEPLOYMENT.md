# Deploy THE SPIDER DXB 0.4.0

The frontend ZIP contains the static app with `index.html` at the top level. It uses relative paths and can be served directly from GitHub Pages.

## Upload from an iPhone

1. Download `THE-SPIDER-DXB-0.4.0-frontend.zip` and tap it in Files to extract it.
2. If you use broker records, export a backup in **Workspace data** and save it outside the upload folder. Publish at the same Pages address to keep using the existing browser database.
3. Open your repository on GitHub and select the branch that GitHub Pages serves. At the repository root, choose **Add file** and then **Upload files**.
4. Select the files inside the extracted folder. Keep `index.html`, the other runtime files and the assets together at the repository root. Commit the files, replacing existing runtime files with matching names.
5. When the Pages deployment finishes, open it and check the version in the navigation menu footer. Check a broker screen and open **AI assistant** from the navigation menu.

To configure Pages, open **Settings**, **Pages**, then **Deploy from a branch**, and select the publishing branch and **/ (root)**. If the earlier version is still open, save your edits and reload when prompted. Close and reopen the site if the update takes longer to appear. Use a backup before removing browser data.

## Connect a model provider

The frontend initially shows a disconnected status. Extract `THE-SPIDER-DXB-0.4.0-backend.zip` and follow its included README. The same guide is in the complete source ZIP under `backend/README.md`. The provider key is a Cloudflare secret. Keep the Worker package and all credentials outside the GitHub Pages upload.

Open **AI assistant**. Under **Connection settings**, enter the `https://<worker>.<account>.workers.dev` address and the dedicated workspace access token, then choose **Check connection**. The connection check verifies Worker authorization and configuration. Review and send a synthetic prompt to verify that the configured model can generate.

## Editable source and tests

Use `THE-SPIDER-DXB-0.4.0-source.zip` for source changes and automated tests. The ZIP uses visible file paths for iPhone extraction. On a new development checkout, copy `ci/gitignore.example` to `.gitignore` before creating local configuration or secrets. To enable GitHub Actions from the source package, copy `ci/continuous-integration.yml` into `.github/workflows/` on your development checkout. The isolated Worker package is `THE-SPIDER-DXB-0.4.0-backend.zip`. [Local setup and test commands](README.md)
