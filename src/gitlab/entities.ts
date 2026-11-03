import type { Gitlab } from '@gitbeaker/rest';
import type {
	IssueSchemaWithBasicLabels,
	MergeRequestSchemaWithBasicLabels,
	ProjectSchema,
	SimpleProjectSchema,
	TodoSchema,
} from '@gitbeaker/rest';
import { MAX_PAGES, PAGE_SIZE, PROJECT_PAGE_SIZE } from '../constants';
import { projectId, type GitlabSettings } from '../settings-model';
import { labelText, peopleNames, personName, stringField } from '../util';
import { createGitlab } from './client';
import type { FetchSelection, GitlabListItem, GitlabNote, GitlabOverview, GitlabSnapshot } from './types';

export async function fetchOverview(settings: GitlabSettings): Promise<GitlabOverview> {
	const snapshot = await fetchSnapshot(settings, {
		issues: true,
		mergeRequests: true,
		todos: true,
		projects: true,
		user: true,
	});
	return {
		username: snapshot.username,
		issues: snapshot.issues.map(noteToItem),
		mergeRequests: snapshot.mergeRequests.map(noteToItem),
		todos: snapshot.todos.map(noteToItem),
		projects: snapshot.projects,
	};
}

export async function fetchSnapshot(settings: GitlabSettings, selection: FetchSelection): Promise<GitlabSnapshot> {
	const api = createGitlab(settings);
	const [username, issues, mergeRequests, todos, projects] = await Promise.all([
		selection.user ? fetchUsername(api) : Promise.resolve(''),
		selection.issues ? fetchIssues(api, settings) : Promise.resolve([]),
		selection.mergeRequests ? fetchMergeRequests(api, settings) : Promise.resolve([]),
		selection.todos ? fetchTodos(api, settings) : Promise.resolve([]),
		selection.projects ? fetchProjects(api, settings) : Promise.resolve([]),
	]);
	return { username, issues, mergeRequests, todos, projects };
}

async function fetchUsername(api: Gitlab): Promise<string> {
	const user = await api.Users.showCurrentUser();
	return user.name || user.username;
}

async function fetchIssues(api: Gitlab, settings: GitlabSettings): Promise<GitlabNote[]> {
	const page = { perPage: PAGE_SIZE, maxPages: MAX_PAGES, withLabelsDetails: false as const };
	const filter = listFilter(settings);
	const shared = {
		...page,
		scope: filter.scope,
		...labelsOf(filter),
		state: settings.issueState,
	};
	const issues = filter.projectId === undefined
		? await api.Issues.all(shared)
		: await api.Issues.all({ ...shared, projectId: filter.projectId });
	return issues.map(mapIssue);
}

async function fetchMergeRequests(api: Gitlab, settings: GitlabSettings): Promise<GitlabNote[]> {
	const page = { perPage: PAGE_SIZE, maxPages: MAX_PAGES, withLabelsDetails: false as const };
	const filter = listFilter(settings);
	const state = settings.issueState === 'all' ? {} : { state: settings.issueState };
	const requests = filter.projectId === undefined
		? await api.MergeRequests.all({ ...page, scope: filter.scope, ...labelsOf(filter), ...state })
		: await api.MergeRequests.all({
			...page,
			projectId: filter.projectId,
			scope: filter.scope,
			...labelsOf(filter),
			...state,
		});
	return requests.map(mapMergeRequest);
}

async function fetchTodos(api: Gitlab, settings: GitlabSettings): Promise<GitlabNote[]> {
	const id = projectId(settings.project);
	const state = settings.issueState === 'opened'
		? 'pending'
		: settings.issueState === 'closed'
			? 'done'
			: undefined;
	const todos = await api.TodoLists.all({
		...(id !== undefined ? { projectId: id } : {}),
		...(state ? { state } : {}),
		perPage: PAGE_SIZE,
		maxPages: MAX_PAGES,
	});
	return todos.map(mapTodo);
}

async function fetchProjects(api: Gitlab, settings: GitlabSettings): Promise<GitlabListItem[]> {
	const id = projectId(settings.project);
	if (id !== undefined) {
		const project = await api.Projects.show(id);
		return [mapProject(project)];
	}
	const projects = await api.Projects.all({
		membership: true,
		simple: true,
		perPage: PROJECT_PAGE_SIZE,
		maxPages: 1,
	});
	return projects.map(mapProject);
}

function listFilter(settings: GitlabSettings): {
	projectId?: string | number;
	scope: GitlabSettings['scope'];
	labels?: string;
} {
	const id = projectId(settings.project);
	const labels = settings.labels.trim();
	return {
		...(id !== undefined ? { projectId: id } : {}),
		scope: settings.scope,
		...(labels ? { labels } : {}),
	};
}

function labelsOf(filter: { labels?: string }): { labels?: string } {
	return filter.labels ? { labels: filter.labels } : {};
}

function mapIssue(issue: IssueSchemaWithBasicLabels): GitlabNote {
	const reference = issue.references?.full ?? '';
	return {
		kind: 'issue',
		id: issue.id,
		iid: String(issue.iid),
		title: issue.title || `Issue ${issue.iid}`,
		description: issue.description || '',
		state: issue.state || 'opened',
		webUrl: issue.web_url || '',
		labels: labelText(issue.labels),
		assignee: peopleNames(issue.assignees),
		author: personName(issue.author),
		milestone: issue.milestone?.title ?? '',
		dueDate: dateOnly(issue.due_date),
		project: projectFromReference(reference),
		updatedAt: dateOnly(issue.updated_at),
		reference: reference || `#${issue.iid}`,
	};
}

function mapMergeRequest(request: MergeRequestSchemaWithBasicLabels): GitlabNote {
	const reference = request.references?.full ?? request.reference ?? '';
	return {
		kind: 'merge_request',
		id: request.id,
		iid: String(request.iid),
		title: request.title || `Merge request ${request.iid}`,
		description: request.description || '',
		state: request.state || 'opened',
		webUrl: request.web_url || '',
		labels: labelText(request.labels),
		assignee: peopleNames(request.assignees ?? request.assignee),
		author: personName(request.author),
		milestone: request.milestone?.title ?? '',
		dueDate: '',
		project: projectFromReference(reference),
		updatedAt: dateOnly(request.updated_at),
		reference: reference || `!${request.iid}`,
	};
}

function mapTodo(todo: TodoSchema): GitlabNote {
	const target = todo.target ?? {};
	const iid = typeof target.iid === 'number' ? String(target.iid) : '';
	const title = stringField(target.title) || todo.body || todo.action_name;
	return {
		kind: 'todo',
		id: todo.id,
		iid,
		title,
		description: todo.body || '',
		state: todo.state,
		webUrl: todo.target_url || '',
		labels: '',
		assignee: '',
		author: personName(todo.author),
		milestone: '',
		dueDate: '',
		project: todo.project?.path_with_namespace ?? '',
		updatedAt: dateOnly(todo.updated_at),
		reference: `${todo.target_type} · ${todo.action_name}`,
	};
}

function mapProject(project: ProjectSchema | SimpleProjectSchema): GitlabListItem {
	return {
		kind: 'project',
		title: project.name_with_namespace || project.name,
		state: '',
		project: project.path_with_namespace || project.path,
		url: project.web_url,
		updatedAt: dateOnly(project.last_activity_at),
	};
}

function noteToItem(note: GitlabNote): GitlabListItem {
	return {
		kind: note.kind,
		title: note.title,
		state: note.state,
		project: note.project,
		url: note.webUrl,
		updatedAt: note.updatedAt,
	};
}

function projectFromReference(reference: string): string {
	const hash = reference.lastIndexOf('#');
	if (hash === -1) return reference;
	return reference.slice(0, hash);
}

function dateOnly(value: unknown): string {
	if (typeof value !== 'string' || !value) return '';
	return value.slice(0, 10);
}
