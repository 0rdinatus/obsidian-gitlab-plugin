export type GitlabScope = 'assigned_to_me' | 'created_by_me' | 'all';
export type GitlabStateFilter = 'opened' | 'closed' | 'all';

export interface GitlabSettings {
	host: string;
	token: string;
	outputDir: string;
	templateFile: string;
	scope: GitlabScope;
	issueState: GitlabStateFilter;
	project: string;
	labels: string;
	syncIssues: boolean;
	syncMergeRequests: boolean;
	syncTodos: boolean;
	showIcon: boolean;
	syncOnStartup: boolean;
	refreshIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: GitlabSettings = {
	host: 'https://gitlab.com',
	token: '',
	outputDir: 'GitLab',
	templateFile: '',
	scope: 'assigned_to_me',
	issueState: 'opened',
	project: '',
	labels: '',
	syncIssues: true,
	syncMergeRequests: true,
	syncTodos: true,
	showIcon: true,
	syncOnStartup: false,
	refreshIntervalMinutes: 0,
};

const SCOPES: readonly GitlabScope[] = ['assigned_to_me', 'created_by_me', 'all'];
const STATES: readonly GitlabStateFilter[] = ['opened', 'closed', 'all'];

export function normalizeHost(value: string): string {
	const trimmed = value.trim().replace(/\/+$/, '');
	if (!trimmed) return DEFAULT_SETTINGS.host;
	if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
}

export function clampInterval(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1440, Math.max(0, Math.round(value)));
}

export function projectId(value: string): string | number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (/^\d+$/.test(trimmed)) return Number(trimmed);
	return trimmed;
}

export function migrateSettings(raw: unknown): GitlabSettings {
	const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
	const settings: GitlabSettings = {
		...DEFAULT_SETTINGS,
		host: pickString(data, 'host', DEFAULT_SETTINGS.host),
		token: pickString(data, 'token', ''),
		outputDir: pickString(data, 'outputDir', DEFAULT_SETTINGS.outputDir),
		templateFile: pickString(data, 'templateFile', ''),
		project: pickString(data, 'project', ''),
		labels: pickString(data, 'labels', ''),
		scope: pickScope(data.scope),
		issueState: pickState(data.issueState),
		syncIssues: pickBoolean(data, 'syncIssues', DEFAULT_SETTINGS.syncIssues),
		syncMergeRequests: pickBoolean(data, 'syncMergeRequests', DEFAULT_SETTINGS.syncMergeRequests),
		syncTodos: pickBoolean(data, 'syncTodos', DEFAULT_SETTINGS.syncTodos),
		showIcon: pickBoolean(data, 'showIcon', DEFAULT_SETTINGS.showIcon),
		syncOnStartup: pickBoolean(data, 'syncOnStartup', DEFAULT_SETTINGS.syncOnStartup),
		refreshIntervalMinutes: pickInterval(data.refreshIntervalMinutes),
	};

	if (typeof data.filter === 'string' && typeof data.issueState !== 'string') {
		const match = /(?:^|&)state=(opened|closed|all)(?:&|$)/.exec(data.filter);
		if (match && isState(match[1])) settings.issueState = match[1];
	}
	if (typeof data.showIssues === 'boolean' && typeof data.syncIssues !== 'boolean') {
		settings.syncIssues = data.showIssues;
	}

	settings.host = normalizeHost(settings.host);
	settings.token = settings.token.trim();
	if (!settings.outputDir.trim() || settings.outputDir.trim() === '/') {
		settings.outputDir = DEFAULT_SETTINGS.outputDir;
	}
	return settings;
}

function pickString(data: Record<string, unknown>, key: string, fallback: string): string {
	const value = data[key];
	return typeof value === 'string' ? value : fallback;
}

function pickBoolean(data: Record<string, unknown>, key: string, fallback: boolean): boolean {
	const value = data[key];
	return typeof value === 'boolean' ? value : fallback;
}

function pickInterval(value: unknown): number {
	if (typeof value === 'number') return clampInterval(value);
	if (typeof value === 'string' && value.trim()) return clampInterval(Number(value));
	return 0;
}

function pickScope(value: unknown): GitlabScope {
	return typeof value === 'string' && isScope(value) ? value : DEFAULT_SETTINGS.scope;
}

function pickState(value: unknown): GitlabStateFilter {
	return typeof value === 'string' && isState(value) ? value : DEFAULT_SETTINGS.issueState;
}

function isScope(value: string): value is GitlabScope {
	return SCOPES.indexOf(value as GitlabScope) !== -1;
}

function isState(value: string): value is GitlabStateFilter {
	return STATES.indexOf(value as GitlabStateFilter) !== -1;
}
