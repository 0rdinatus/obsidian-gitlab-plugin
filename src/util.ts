import type { GitlabNote } from './gitlab/types';

export function sanitizeFileName(value: string): string {
	return value
		.replace(/[:]/g, '')
		.replace(/[*"/\\<>|?]/g, '-');
}

export function noteFileName(kind: GitlabNote['kind'], project: string, iid: string, id: number): string {
	const prefix = kind === 'merge_request' ? 'mr' : kind === 'todo' ? 'todo' : 'issue';
	const slug = sanitizeFileName(project)
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
	const key = kind === 'todo' ? String(id) : (iid || String(id));
	const base = [prefix, slug, key].filter(part => part.length > 0).join('-').slice(0, 120);
	return `${base}.md`;
}

export function folderFor(kind: GitlabNote['kind']): string {
	if (kind === 'merge_request') return 'merge-requests';
	if (kind === 'todo') return 'todos';
	return 'issues';
}

export function applyTemplate(template: string, values: Record<string, string>): string {
	return template.replace(/\{\{([a-z0-9_]+)\}\}/g, (match, key: string) => {
		return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
	});
}

export function yamlQuote(value: string): string {
	const singleLine = value.replace(/\r?\n/g, ' ').trim();
	if (singleLine === '') return '""';
	if (/^[\w./@+-]+$/.test(singleLine)) return singleLine;
	return `"${singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim()) return error.message.trim();
	return 'Неизвестная ошибка';
}

export function isDoneState(state: string): boolean {
	return state === 'closed' || state === 'merged' || state === 'done';
}

export function personName(value: unknown): string {
	if (!value || typeof value !== 'object') return '';
	const record = value as { name?: unknown; username?: unknown };
	if (typeof record.name === 'string' && record.name.trim()) return record.name.trim();
	if (typeof record.username === 'string') return record.username.trim();
	return '';
}

export function peopleNames(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map(personName).filter(name => name.length > 0).join(', ');
	}
	return personName(value);
}

export function labelText(labels: unknown): string {
	if (!Array.isArray(labels)) return '';
	return labels.map(label => {
		if (typeof label === 'string') return label;
		if (label && typeof label === 'object' && 'name' in label) {
			const name = (label as { name?: unknown }).name;
			return typeof name === 'string' ? name : '';
		}
		return '';
	}).filter(label => label.length > 0).join(', ');
}

export function stringField(value: unknown): string {
	return typeof value === 'string' ? value : '';
}
