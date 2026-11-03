import type { GitlabOverview, SyncKind, SyncReport } from './gitlab/types';
import type { GitlabSettings } from './settings-model';

export interface GitlabPluginApi {
	settings: GitlabSettings;
	saveSettings(): Promise<void>;
	onSettingsChanged(): void;
	testConnection(): Promise<string>;
	loadOverview(): Promise<GitlabOverview>;
	sync(kind: SyncKind): Promise<SyncReport | null>;
	openView(): Promise<void>;
}
