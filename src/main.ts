import {Notice, Plugin, addIcon, TFile} from 'obsidian';
import {DEFAULT_SETTINGS, GitlabSettings, GitlabSettingTab} from './settings';
import gitlabIcon from './assets/gitlab-icon.svg';
import { Gitlab } from '@gitbeaker/rest';

// GitLab icon SVG as fallback
const GITLAB_ICON_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M234.415,153.53322,207.08594,51.04787a7.99994,7.99994,0,0,0-15.22022-.74756L170.228,108H85.772L64.13477,50.3008a8.00014,8.00014,0,0,0-15.22071.74707L21.585,153.53322a12.02834,12.02834,0,0,0,4.76416,12.958l94.82031,65.645a11.94608,11.94608,0,0,0,5.45264,2.03467,3.97163,3.97163,0,0,0,.71924.07275c.02734,0,.05517-.00683.08252-.00732.19214.00879.384.02148.57617.02148s.384-.01269.57617-.02148c.02735.00049.05518.00732.08252.00732a3.95865,3.95865,0,0,0,.71826-.07275,11.9487,11.9487,0,0,0,5.45362-2.03467l94.82031-65.645A12.02834,12.02834,0,0,0,234.415,153.53322ZM199.35645,53.1094,213.9939,108H178.772ZM128,220.60891,88.77173,116h78.45654ZM56.644,53.1094,77.228,108H42.00635ZM29.31445,155.59426,39.87305,116H80.228l39.53784,105.43457-88.863-61.52051A4.01148,4.01148,0,0,1,29.31445,155.59426Zm195.78272,4.31982-88.863,61.52051L175.772,116H216.1272l10.55835,39.59424A4.01148,4.01148,0,0,1,225.09717,159.91408Z"/>
</svg>`;

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
		console.log('GitLab Plugin: updateIconVisibility called, showIcon =', this.settings.showIcon);
		
		// Register icon globally first (only once)
		if (!this.iconAdded) {
			try {
				// Try to use imported SVG, fallback to embedded SVG
				let iconSvg: string;
				if (gitlabIcon && typeof gitlabIcon === 'string' && gitlabIcon.trim().length > 0) {
					iconSvg = gitlabIcon.trim();
				} else {
					iconSvg = GITLAB_ICON_SVG;
					console.log('GitLab Plugin: Using embedded SVG fallback');
				}
				
				console.log('GitLab Plugin: SVG icon type:', typeof gitlabIcon);
				console.log('GitLab Plugin: SVG icon length:', iconSvg.length);
				console.log('GitLab Plugin: SVG icon preview:', iconSvg.substring(0, 100));
				
				if (iconSvg && iconSvg.trim().length > 0) {
					addIcon("gitlab", iconSvg);
					this.iconAdded = true;
					console.log('GitLab Plugin: Icon registered successfully');
				} else {
					console.error('GitLab Plugin: SVG icon is empty or invalid');
				}
			} catch (error) {
				console.error('GitLab Plugin: Error registering icon:', error);
			}
		} else {
			console.log('GitLab Plugin: Icon already registered');
		}

		// Remove existing icon if it exists
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
			console.log('GitLab Plugin: Removed existing ribbon icon');
		}

		// Add icon if enabled
		if (this.settings.showIcon) {
			try {
				console.log('GitLab Plugin: Attempting to add ribbon icon');
				this.ribbonIconEl = this.addRibbonIcon('gitlab', 'Gitlab Issues', (evt: MouseEvent) => {
					if (this.settings.token) {
						this.fetchFromGitlab();
					} else {
						new Notice('Please configure GitLab token in settings');
					}
				});
				console.log('GitLab Plugin: Ribbon icon added successfully', this.ribbonIconEl);
			} catch (error) {
				console.error('GitLab Plugin: Error adding ribbon icon:', error);
			}
		} else {
			console.log('GitLab Plugin: Icon display is disabled in settings');
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
		}, 60 * 1000); // after 60 seconds
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

	private async loadTemplate(): Promise<string> {
		if (!this.settings.templateFile) {
			// Default template
			return `---
ID: {{id}}
State: {{state}}  
Labels: {{labels}}  
Assignee: {{assignee}}  
Author: {{author}}  
Updated:   {{updated_at}}

---



- [ ]  {{title}} []({{web_url}}) 🔼 📅 {{due_date}} ⏳ 2025-12-15 🆔 {{iid}}

## Description

{{description}}
`;
		}

		try {
			const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFile);
			if (templateFile && templateFile instanceof TFile) {
				return await this.app.vault.read(templateFile);
			}
		} catch (error) {
			console.error('Error loading template file:', error);
			new Notice(`Error loading template file: ${this.settings.templateFile}`);
		}

		// Fallback to default template
		return `---
gitlab_url: {{web_url}}
gitlab_state: {{state}}
---

# {{title}}

{{description}}
`;
	}

	private formatIssueContent(template: string, issue: any): string {
		let content = template;

		// Replace template variables
		const replacements: Record<string, string> = {
			'{{id}}': String(issue.id || ''),
			'{{iid}}': String(issue.iid || ''),
			'{{title}}': issue.title || '',
			'{{description}}': issue.description || '',
			'{{state}}': issue.state || '',
			'{{web_url}}': issue.web_url || '',
			'{{labels}}': issue.labels ? issue.labels.map((l: any) => typeof l === 'string' ? l : l.name).join(', ') : '',
			'{{assignee}}': issue.assignee ? (issue.assignee.name || issue.assignee.username || '') : 'Unassigned',
			'{{author}}': issue.author ? (issue.author.name || issue.author.username || '') : '',
			'{{milestone}}': issue.milestone ? issue.milestone.title : '',
			'{{due_date}}': issue.due_date ? new Date(issue.due_date).toISOString().split('T')[0] : '',
		};

		for (const [key, value] of Object.entries(replacements)) {
			content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
		}

		return content;
	}

	private getIssueFileName(issue: any): string {
		// Create a safe filename from issue title
		const title = issue.title || `Issue ${issue.iid || issue.id}`;
		const safeTitle = title
			.replace(/[<>:"/\\|?*]/g, ' ')
			.replace(/\s+/g, ' ')
			.substring(0, 100)
			.trim();
		
		return `${safeTitle}.md`;
	}

	private async processIssues(issues: any[]): Promise<void> {
		if (issues.length === 0) {
			console.log('No issues to process');
			return;
		}

		// Load template
		const template = await this.loadTemplate();
		
		// Ensure output folder exists
		await this.createOutputFolder();

		let processed = 0;
		let errors = 0;

		for (const issue of issues) {
			try {
				// Generate content from template
				const content = this.formatIssueContent(template, issue);
				
				// Get filename
				const fileName = this.getIssueFileName(issue);
				const filePath = this.settings.outputDir === '/' 
					? fileName 
					: `${this.settings.outputDir}/${fileName}`;

				// Check if file exists
				const file = this.app.vault.getAbstractFileByPath(filePath);
				
				if (file && file instanceof TFile) {
					// Update existing file
					await this.app.vault.modify(file, content);
					console.log(`Updated: ${filePath}`);
				} else {
					// Create new file
					await this.app.vault.create(filePath, content);
					console.log(`Created: ${filePath}`);
				}

				processed++;
			} catch (error) {
				console.error(`Error processing issue ${issue.id}:`, error);
				errors++;
			}
		}

		new Notice(`Processed ${processed} issues${errors > 0 ? `, ${errors} errors` : ''}`);
		console.log(`GitLab Plugin: Processed ${processed} issues, ${errors} errors`);
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

			// Process issues and create/update files
			await this.processIssues(issues);

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
