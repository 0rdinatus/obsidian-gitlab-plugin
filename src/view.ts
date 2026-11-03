import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { GitlabPluginApi } from './api';
import { GITLAB_VIEW_TYPE } from './constants';
import type { GitlabListItem, GitlabOverview } from './gitlab/types';
import { errorMessage } from './util';

export class GitlabView extends ItemView {
	private readonly plugin: GitlabPluginApi;
	private requestId = 0;

	constructor(leaf: WorkspaceLeaf, plugin: GitlabPluginApi) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return GITLAB_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'GitLab';
	}

	getIcon(): string {
		return 'gitlab';
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private async refresh(): Promise<void> {
		const requestId = ++this.requestId;
		this.paint(null, 'Загрузка из GitLab…');
		try {
			const overview = await this.plugin.loadOverview();
			if (requestId !== this.requestId) return;
			this.paint(overview, null);
		} catch (error) {
			if (requestId !== this.requestId) return;
			this.paint(null, errorMessage(error));
		}
	}

	private paint(overview: GitlabOverview | null, message: string | null): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('gitlab-view');

		const toolbar = root.createDiv({ cls: 'gitlab-toolbar' });
		const refresh = toolbar.createEl('button', { text: 'Обновить' });
		const sync = toolbar.createEl('button', { text: 'В заметки', cls: 'mod-cta' });
		refresh.addEventListener('click', () => {
			void this.refresh();
		});
		sync.addEventListener('click', () => {
			void this.syncAndRefresh();
		});

		if (message) {
			root.createEl('p', { text: message, cls: 'gitlab-message' });
		}
		if (!overview) return;

		const who = overview.username ? `Вход выполнен: ${overview.username}` : 'GitLab';
		root.createEl('p', { text: who, cls: 'gitlab-user' });
		this.section(root, 'Задачи', overview.issues);
		this.section(root, 'Запросы на слияние', overview.mergeRequests);
		this.section(root, 'Список дел', overview.todos);
		this.section(root, 'Проекты', overview.projects);
	}

	private section(root: HTMLElement, title: string, items: GitlabListItem[]): void {
		const section = root.createDiv({ cls: 'gitlab-section' });
		section.createEl('h3', { text: `${title} (${items.length})` });
		if (items.length === 0) {
			section.createEl('p', { text: 'Ничего не найдено', cls: 'gitlab-message' });
			return;
		}
		for (const item of items) {
			const row = section.createDiv({ cls: 'gitlab-item' });
			const link = row.createEl('a', { cls: 'gitlab-item-title', href: item.url, text: item.title || item.project });
			link.addEventListener('click', (event) => {
				event.preventDefault();
				if (item.url) window.open(item.url, '_blank');
			});
			const meta = [item.project, item.state, item.updatedAt].filter(part => part.length > 0).join(' · ');
			if (meta) row.createEl('div', { text: meta, cls: 'gitlab-meta' });
		}
	}

	private async syncAndRefresh(): Promise<void> {
		await this.plugin.sync('all');
		await this.refresh();
	}
}
