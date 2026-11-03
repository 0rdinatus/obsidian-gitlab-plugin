import { Notice, Plugin, addIcon, type WorkspaceLeaf } from 'obsidian';
import gitlabIcon from './assets/gitlab-icon.svg';
import type { GitlabPluginApi } from './api';
import { GITLAB_VIEW_TYPE } from './constants';
import { fetchOverview } from './gitlab/entities';
import { createGitlab } from './gitlab/client';
import type { GitlabOverview, SyncKind, SyncReport } from './gitlab/types';
import { writeGitlabNotes } from './notes';
import { GitlabSettingTab } from './settings';
import { clampInterval, migrateSettings, normalizeHost, type GitlabSettings } from './settings-model';
import { GitlabView } from './view';
import { errorMessage } from './util';

export default class GitlabPlugin extends Plugin implements GitlabPluginApi {
	settings: GitlabSettings = migrateSettings(null);
	private ribbon: HTMLElement | null = null;
	private iconReady = false;
	private refreshTimer: number | null = null;
	private startupTimer: number | null = null;
	private startupScheduled = false;
	private syncing = false;

	async onload(): Promise<void> {
		this.settings = migrateSettings(await this.loadData());
		this.addSettingTab(new GitlabSettingTab(this.app, this));
		this.registerView(GITLAB_VIEW_TYPE, (leaf: WorkspaceLeaf) => new GitlabView(leaf, this));
		this.registerIcon();
		this.updateRibbon();
		this.addCommands();
		this.applySchedule();
	}

	onunload(): void {
		this.clearSchedule();
		this.ribbon?.remove();
		this.ribbon = null;
	}

	async saveSettings(): Promise<void> {
		this.settings.host = normalizeHost(this.settings.host);
		this.settings.token = this.settings.token.trim();
		this.settings.refreshIntervalMinutes = clampInterval(this.settings.refreshIntervalMinutes);
		if (!this.settings.outputDir.trim() || this.settings.outputDir.trim() === '/') {
			this.settings.outputDir = 'GitLab';
		}
		await this.saveData(this.settings);
	}

	onSettingsChanged(): void {
		this.updateRibbon();
		this.applySchedule();
	}

	async testConnection(): Promise<string> {
		const api = createGitlab(this.settings);
		const user = await api.Users.showCurrentUser();
		return user.name || user.username;
	}

	async loadOverview(): Promise<GitlabOverview> {
		return fetchOverview(this.settings);
	}

	async sync(kind: SyncKind): Promise<SyncReport | null> {
		if (this.syncing) {
			new Notice('Синхронизация GitLab уже выполняется');
			return null;
		}
		this.syncing = true;
		try {
			const report = await writeGitlabNotes(this.app.vault, this.settings, kind);
			if (report.empty) {
				new Notice('В настройках выключены все типы сущностей');
				return report;
			}
			new Notice(
				`GitLab: задачи ${report.issues}, запросы ${report.mergeRequests}, дела ${report.todos}`,
			);
			return report;
		} catch (error) {
			console.error('GitLab sync failed', error);
			new Notice(`GitLab: ${errorMessage(error)}`);
			return null;
		} finally {
			this.syncing = false;
		}
	}

	async openView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(GITLAB_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(false);
			await leaf.setViewState({ type: GITLAB_VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	private addCommands(): void {
		this.addCommand({
			id: 'open-gitlab-view',
			name: 'Открыть панель GitLab',
			callback: () => {
				void this.openView();
			},
		});
		this.addCommand({
			id: 'sync-gitlab-issues',
			name: 'Синхронизировать задачи',
			callback: () => {
				void this.sync('issues');
			},
		});
		this.addCommand({
			id: 'sync-gitlab-merge-requests',
			name: 'Синхронизировать запросы на слияние',
			callback: () => {
				void this.sync('merge_requests');
			},
		});
		this.addCommand({
			id: 'sync-gitlab-todos',
			name: 'Синхронизировать список дел',
			callback: () => {
				void this.sync('todos');
			},
		});
		this.addCommand({
			id: 'sync-gitlab',
			name: 'Синхронизировать GitLab',
			callback: () => {
				void this.sync('all');
			},
		});
	}

	private registerIcon(): void {
		if (this.iconReady) return;
		addIcon('gitlab', gitlabIcon);
		this.iconReady = true;
	}

	private updateRibbon(): void {
		this.registerIcon();
		if (this.ribbon) {
			this.ribbon.remove();
			this.ribbon = null;
		}
		if (!this.settings.showIcon) return;
		this.ribbon = this.addRibbonIcon('gitlab', 'GitLab', () => {
			void this.openView();
		});
	}

	private applySchedule(): void {
		if (this.refreshTimer !== null) {
			window.clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
		this.scheduleStartup();
		if (!this.settings.token || this.settings.refreshIntervalMinutes <= 0) return;
		this.refreshTimer = window.setInterval(() => {
			void this.sync('all');
		}, this.settings.refreshIntervalMinutes * 60 * 1000);
		this.registerInterval(this.refreshTimer);
	}

	private scheduleStartup(): void {
		if (this.startupScheduled || !this.settings.syncOnStartup || !this.settings.token) return;
		this.startupScheduled = true;
		this.startupTimer = window.setTimeout(() => {
			void this.sync('all');
		}, 5000);
		this.registerInterval(this.startupTimer);
	}

	private clearSchedule(): void {
		if (this.startupTimer !== null) {
			window.clearTimeout(this.startupTimer);
			this.startupTimer = null;
		}
		if (this.refreshTimer !== null) {
			window.clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}
}
