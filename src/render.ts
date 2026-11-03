import type { GitlabListItem, GitlabNote } from './gitlab/types';
import { applyTemplate, isDoneState, yamlQuote } from './util';

const DEFAULT_BODY = `{{checkbox}} {{title}}{{due}}{{iid_suffix}}

[{{reference}}]({{web_url}})

## Описание

{{description}}`;

export function renderNote(note: GitlabNote, template: string | null): string {
	const body = applyTemplate(template ?? DEFAULT_BODY, templateValues(note)).trim();
	if (body.startsWith('---')) return `${body}\n`;
	return `${frontmatter(note)}\n\n${body}\n`;
}

export function renderProjects(projects: GitlabListItem[]): string {
	const lines = ['# Проекты GitLab', ''];
	if (projects.length === 0) {
		lines.push('Нет проектов.');
	} else {
		for (const project of projects) {
			const title = project.title || project.project;
			lines.push(`- [${title}](${project.url}) — ${project.project}`);
		}
	}
	lines.push('');
	return lines.join('\n');
}

function templateValues(note: GitlabNote): Record<string, string> {
	return {
		id: String(note.id),
		iid: note.iid,
		iid_suffix: note.iid ? ` 🆔 ${note.iid}` : '',
		title: note.title,
		description: note.description || 'Нет описания.',
		state: note.state,
		web_url: note.webUrl,
		labels: note.labels,
		assignee: note.assignee || 'Unassigned',
		author: note.author,
		milestone: note.milestone,
		due_date: note.dueDate,
		due: note.dueDate ? ` 📅 ${note.dueDate}` : '',
		project: note.project,
		updated_at: note.updatedAt,
		type: note.kind,
		reference: note.reference || 'GitLab',
		checkbox: isDoneState(note.state) ? '- [x]' : '- [ ]',
	};
}

function frontmatter(note: GitlabNote): string {
	return [
		'---',
		`gitlab_id: ${yamlQuote(String(note.id))}`,
		`gitlab_iid: ${yamlQuote(note.iid)}`,
		`gitlab_type: ${yamlQuote(note.kind)}`,
		`gitlab_state: ${yamlQuote(note.state)}`,
		`gitlab_project: ${yamlQuote(note.project)}`,
		`gitlab_url: ${yamlQuote(note.webUrl)}`,
		`labels: ${yamlQuote(note.labels)}`,
		`assignee: ${yamlQuote(note.assignee)}`,
		`author: ${yamlQuote(note.author)}`,
		`updated: ${yamlQuote(note.updatedAt)}`,
		'---',
	].join('\n');
}
