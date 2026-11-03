import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { GitlabPluginApi } from './api';
import { errorMessage } from './util';
import type { GitlabScope, GitlabStateFilter } from './settings-model';

type GitlabPluginLike = Plugin & GitlabPluginApi;

export class GitlabSettingTab extends PluginSettingTab {
	private readonly gitlab: GitlabPluginApi;

	constructor(app: App, plugin: GitlabPluginLike) {
		super(app, plugin);
		this.gitlab = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Подключение' });
		new Setting(containerEl)
			.setName('Адрес GitLab')
			.setDesc('Корневой адрес инстанса, без /api/v4.')
			.addText(text => text
				.setPlaceholder('https://gitlab.com')
				.setValue(this.gitlab.settings.host)
				.onChange(async (value) => {
					this.gitlab.settings.host = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Personal access token')
			.setDesc('Токен хранится локально. Для чтения хватает области read_api.')
			.addText(text => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('glpat-…')
					.setValue(this.gitlab.settings.token)
					.onChange(async (value) => {
						this.gitlab.settings.token = value;
						await this.persist();
					});
			});

		new Setting(containerEl)
			.setName('Проверка соединения')
			.setDesc('Запрашивает текущего пользователя через Gitbeaker.')
			.addButton(button => button
				.setButtonText('Проверить токен')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const name = await this.gitlab.testConnection();
						new Notice(`GitLab: ${name}`);
					} catch (error) {
						new Notice(`GitLab: ${errorMessage(error)}`);
					} finally {
						button.setDisabled(false);
					}
				}));

		containerEl.createEl('h2', { text: 'Что загружать' });
		new Setting(containerEl)
			.setName('Область')
			.addDropdown(drop => drop
				.addOption('assigned_to_me', 'Назначенные мне')
				.addOption('created_by_me', 'Созданные мной')
				.addOption('all', 'Все доступные')
				.setValue(this.gitlab.settings.scope)
				.onChange(async (value: string) => {
					this.gitlab.settings.scope = value as GitlabScope;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Состояние')
			.setDesc('Для списка дел «открытые» — pending, «закрытые» — done.')
			.addDropdown(drop => drop
				.addOption('opened', 'Открытые')
				.addOption('closed', 'Закрытые')
				.addOption('all', 'Все')
				.setValue(this.gitlab.settings.issueState)
				.onChange(async (value: string) => {
					this.gitlab.settings.issueState = value as GitlabStateFilter;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Проект')
			.setDesc('Необязательно. Числовой id или путь group/project.')
			.addText(text => text
				.setPlaceholder('group/project')
				.setValue(this.gitlab.settings.project)
				.onChange(async (value) => {
					this.gitlab.settings.project = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Метки')
			.setDesc('Список через запятую. Пусто — без фильтра по меткам.')
			.addText(text => text
				.setPlaceholder('bug,priority::high')
				.setValue(this.gitlab.settings.labels)
				.onChange(async (value) => {
					this.gitlab.settings.labels = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Задачи')
			.addToggle(toggle => toggle
				.setValue(this.gitlab.settings.syncIssues)
				.onChange(async (value) => {
					this.gitlab.settings.syncIssues = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Запросы на слияние')
			.addToggle(toggle => toggle
				.setValue(this.gitlab.settings.syncMergeRequests)
				.onChange(async (value) => {
					this.gitlab.settings.syncMergeRequests = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Список дел')
			.addToggle(toggle => toggle
				.setValue(this.gitlab.settings.syncTodos)
				.onChange(async (value) => {
					this.gitlab.settings.syncTodos = value;
					await this.persist();
				}));

		containerEl.createEl('h2', { text: 'Заметки' });
		new Setting(containerEl)
			.setName('Папка')
			.setDesc('Сюда пишутся issues, merge-requests, todos и projects.md.')
			.addText(text => text
				.setPlaceholder('GitLab')
				.setValue(this.gitlab.settings.outputDir)
				.onChange(async (value) => {
					this.gitlab.settings.outputDir = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Шаблон')
			.setDesc('Путь к заметке. Плейсхолдеры: {{title}}, {{description}}, {{state}}, {{web_url}}, {{iid}}, {{labels}}, {{assignee}}, {{author}}, {{due_date}}, {{project}}, {{checkbox}}.')
			.addText(text => text
				.setPlaceholder('templates/gitlab-issue.md')
				.setValue(this.gitlab.settings.templateFile)
				.onChange(async (value) => {
					this.gitlab.settings.templateFile = value;
					await this.persist();
				}));

		containerEl.createEl('h2', { text: 'Расписание' });
		new Setting(containerEl)
			.setName('Синхронизировать при запуске')
			.addToggle(toggle => toggle
				.setValue(this.gitlab.settings.syncOnStartup)
				.onChange(async (value) => {
					this.gitlab.settings.syncOnStartup = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Интервал, минуты')
			.setDesc('0 выключает повтор. Не больше 1440.')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.gitlab.settings.refreshIntervalMinutes))
				.onChange(async (value) => {
					const parsed = Number(value);
					this.gitlab.settings.refreshIntervalMinutes = Number.isFinite(parsed) ? parsed : 0;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Значок на боковой панели')
			.addToggle(toggle => toggle
				.setValue(this.gitlab.settings.showIcon)
				.onChange(async (value) => {
					this.gitlab.settings.showIcon = value;
					await this.persist();
				}));

		new Setting(containerEl)
			.setName('Синхронизация')
			.addButton(button => button
				.setButtonText('Синхронизировать сейчас')
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					try {
						await this.gitlab.sync('all');
					} finally {
						button.setDisabled(false);
					}
				}));
	}

	private async persist(): Promise<void> {
		await this.gitlab.saveSettings();
		this.gitlab.onSettingsChanged();
	}
}
