export type SyncKind = 'issues' | 'merge_requests' | 'todos' | 'all';
export type GitlabEntityKind = 'issue' | 'merge_request' | 'todo';

export interface GitlabNote {
	kind: GitlabEntityKind;
	id: number;
	iid: string;
	title: string;
	description: string;
	state: string;
	webUrl: string;
	labels: string;
	assignee: string;
	author: string;
	milestone: string;
	dueDate: string;
	project: string;
	updatedAt: string;
	reference: string;
}

export interface GitlabListItem {
	kind: GitlabEntityKind | 'project';
	title: string;
	state: string;
	project: string;
	url: string;
	updatedAt: string;
}

export interface GitlabOverview {
	username: string;
	issues: GitlabListItem[];
	mergeRequests: GitlabListItem[];
	todos: GitlabListItem[];
	projects: GitlabListItem[];
}

export interface FetchSelection {
	issues: boolean;
	mergeRequests: boolean;
	todos: boolean;
	projects: boolean;
	user: boolean;
}

export interface GitlabSnapshot {
	username: string;
	issues: GitlabNote[];
	mergeRequests: GitlabNote[];
	todos: GitlabNote[];
	projects: GitlabListItem[];
}

export interface SyncReport {
	issues: number;
	mergeRequests: number;
	todos: number;
	projects: number;
	empty: boolean;
}
