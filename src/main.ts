import {Notice, Plugin, addIcon} from 'obsidian';
import {DEFAULT_SETTINGS, GitlabSettings, GitlabSettingTab} from './settings';
import gitlabIcon from './assets/gitlab-icon.svg';
import { Gitlab } from '@gitbeaker/rest';

export default class GitlabPlugin extends Plugin {
	settings: GitlabSettings;
	startupTimeout: number|null = null;
	automaticRefresh: number|null = null;
	iconAdded = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GitlabSettingTab(this.app, this));

		// Add icon if enabled (regardless of token)
		this.updateIconVisibility();

		if (this.settings.token) {
			await this.createOutputFolder();
			this.addCommandToPalette();
			this.refreshIssuesAtStartup();
			this.scheduleAutomaticRefresh();
		}
	}

	private ribbonIconEl: HTMLElement | null = null;

	updateIconVisibility() {
		// Register icon globally first (only once)
		if (!this.iconAdded) {
			try {
				// Ensure SVG is a string
				const iconSvg = typeof gitlabIcon === 'string' ? gitlabIcon : String(gitlabIcon);
				if (iconSvg && iconSvg.trim().length > 0) {
					addIcon("gitlab", iconSvg);
					this.iconAdded = true;
				} else {
					console.error('GitLab Plugin: SVG icon is empty or invalid');
				}
			} catch (error) {
				console.error('GitLab Plugin: Error registering icon:', error);
			}
		}

		// Remove existing icon if it exists
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}

		// Add icon if enabled
		if (this.settings.showIcon) {
			try {
				this.ribbonIconEl = this.addRibbonIcon('gitlab', 'Gitlab Issues', (evt: MouseEvent) => {
					if (this.settings.token) {
						this.fetchFromGitlab();
					} else {
						new Notice('Please configure GitLab token in settings');
					}
				});
			} catch (error) {
				console.error('GitLab Plugin: Error adding ribbon icon:', error);
			}
		}
	}

	private addCommandToPalette() {
		this.addCommand({
			id: 'import-gitlab-issues',
			name: 'Import Gitlab Issues',
			callback: () => {
				this.fetchFromGitlab();
			}
		});
	}

	private refreshIssuesAtStartup() {
		// Clear existing startup timeout
		if (this.startupTimeout) {
			window.clearTimeout(this.startupTimeout);
		}
		this.startupTimeout = window.setTimeout(() => {
			this.fetchFromGitlab();
		}, 30 * 1000); // after 30 seconds
	}

	private scheduleAutomaticRefresh() {
		if (this.automaticRefresh) {
			window.clearInterval(this.automaticRefresh);
		}
		this.automaticRefresh = this.registerInterval(window.setInterval(() => {
			this.fetchFromGitlab();
		}, 5 * 60 * 1000)); // every 5 minutes
	}

	private async createOutputFolder() {
		if (!this.settings.outputDir || this.settings.outputDir === '/') {
			return;
		}
		
		const normalizedPath = this.settings.outputDir;
		const folderExists = await this.app.vault.adapter.exists(normalizedPath);
		
		if (!folderExists) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}

	private async fetchFromGitlab() {
		try {
			new Notice('Updating issues from Gitlab');

			const GitlabApi = new Gitlab({
				host: this.settings.host,
				token: this.settings.token,
			});

			// Parse filter string (e.g., "state=opened&assignee_id=123")
			const filterParams: Record<string, string> = {};
			if (this.settings.filter) {
				this.settings.filter.split('&').forEach(param => {
					const [key, value] = param.split('=');
					if (key && value) {
						filterParams[key.trim()] = value.trim();
					}
				});
			}

			// Fetch issues with filter
			const issues = await GitlabApi.Issues.all({
				...filterParams,
			});

			console.log(`Fetched ${issues.length} issues from GitLab`);

			// TODO: Process issues and create/update files in output folder
			// This will be implemented based on template and output requirements

		} catch (error) {
			console.error('Error fetching from GitLab:', error);
			new Notice(`Error updating issues from Gitlab: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	onunload() {
		// Clear startup timeout
		if (this.startupTimeout) {
			window.clearTimeout(this.startupTimeout);
			this.startupTimeout = null;
		}
		
		// Clear automatic refresh interval
		if (this.automaticRefresh) {
			window.clearInterval(this.automaticRefresh);
			this.automaticRefresh = null;
		}

		// Remove ribbon icon
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
