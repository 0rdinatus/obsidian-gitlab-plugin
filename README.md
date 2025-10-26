# Obsidian x Gitlab Plugin

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/0rdinatus/obsidian-gitlab-plugin/premerge.yml?branch=master&style=for-the-badge) ![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/0rdinatus/obsidian-gitlab-plugin?style=for-the-badge)

[Obsidian](https://obsidian.md/) plugin to materialize [Gitlab](https://gitlab.com/) issues lists campatible with [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks/) and wiki in Obsidian notes.

## Development
git clone plugin repo then cd to plugin folder
Check `node --version` will be >= 16
Install dependansies `npm i`
Run `npm run build` will be create `build/main.js` build artifact.
Copy `build/main.js` plugin to `ObsidianVault/.obsidian/plugins` for checking in Obsidian UI.

### Debuging

Obsidian debug console
```
CTRL+SHIFT+I
```
## TODO

- [ ] Add License