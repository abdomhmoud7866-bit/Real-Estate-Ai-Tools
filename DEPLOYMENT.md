# Deploy THE SPIDER DXB 0.3.0

The deployment ZIP contains the static app with `index.html` at the top level. Serve these files directly from GitHub Pages. The app uses relative paths and requires no build command or runtime secrets.

## Upload from an iPhone

1. Download `THE-SPIDER-DXB-0.3.0-deployment.zip`. Tap it in the Files app to extract it.
2. If your existing workspace contains broker records, export a backup from **Workspace data** before changing its publishing address or clearing browser data. Keep the backup outside the upload folder.
3. Open your repository in GitHub and select the branch that GitHub Pages serves. In the repository root, choose **Add file** and then **Upload files**.
4. Select the individual files inside the extracted folder. Keep `index.html` and the supporting assets, scripts, and styles together in the repository root. Commit the uploaded files, replacing the previous runtime versions where names match.
5. After the Pages deployment finishes, open the site and check that the dashboard and a broker screen load. The navigation menu footer displays the version.

If configuring a new site, select **Settings**, **Pages**, then **Deploy from a branch**. Choose the publishing branch and **/ (root)**. For a browser still showing the previous version, save any open edits, then reload the page. If the older page persists, close all tabs for the site and reopen it. Export a local backup before clearing site data.

## Editable source and tests

Use `THE-SPIDER-DXB-0.3.0-source.zip` for source changes. It already contains the unit tests, browser tests, lockfile, and CI workflow. The separate `THE-SPIDER-DXB-0.3.0-test-suite.zip` mirrors those development files. To use it, extract it into the source project root and follow the test commands in the [README](README.md).
