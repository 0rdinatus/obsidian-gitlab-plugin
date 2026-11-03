import { migrateSettings, normalizeHost, projectId } from '../src/settings-model';
import { applyTemplate, noteFileName, sanitizeFileName, yamlQuote } from '../src/util';
import { renderNote, renderProjects } from '../src/render';
import type { GitlabNote } from '../src/gitlab/types';

describe('sanitizeFileName', () => {
	const dataSet = [
		{
			input: 'Normal filenames are unchanged',
			output: 'Normal filenames are unchanged',
		},
		{
			input: "Single 'quote' characters are left intact",
			output: "Single 'quote' characters are left intact",
		},
		{
			input: 'Colon : characters are removed completely',
			output: 'Colon  characters are removed completely',
		},
		{
			input: 'Double "quote" characters are replaced with hyphens',
			output: 'Double -quote- characters are replaced with hyphens',
		},
		{
			input: 'Slash / and \\ characters are replaced with hyphens',
			output: 'Slash - and - characters are replaced with hyphens',
		},
		{
			input: 'Angle brackets <> characters are replaced with hyphens',
			output: 'Angle brackets -- characters are replaced with hyphens',
		},
		{
			input: 'Pipe | characters are replaced with hyphens',
			output: 'Pipe - characters are replaced with hyphens',
		},
		{
			input: 'Question mark ? characters are replaced with hyphens',
			output: 'Question mark - characters are replaced with hyphens',
		},
	];

	it.each(dataSet)('$input', ({ input, output }) => {
		expect(sanitizeFileName(input)).toBe(output);
	});
});

describe('note names and templates', () => {
	it('builds a stable file name from the project and iid', () => {
		expect(noteFileName('issue', 'group/project', '12', 99)).toBe('issue-group-project-12.md');
		expect(noteFileName('todo', 'group/project', '', 7)).toBe('todo-group-project-7.md');
	});

	it('replaces placeholders once', () => {
		const rendered = applyTemplate('{{title}} {{description}}', {
			title: 'Alpha',
			description: 'contains {{title}}',
		});
		expect(rendered).toBe('Alpha contains {{title}}');
	});

	it('quotes yaml values that contain colons', () => {
		expect(yamlQuote('https://gitlab.com/group/proj')).toBe('"https://gitlab.com/group/proj"');
		expect(yamlQuote('plain')).toBe('plain');
	});

	it('renders a task checkbox and frontmatter', () => {
		const note: GitlabNote = {
			kind: 'issue',
			id: 5,
			iid: '12',
			title: 'Fix login',
			description: 'Steps',
			state: 'opened',
			webUrl: 'https://gitlab.com/group/proj/-/issues/12',
			labels: 'bug',
			assignee: 'Ada',
			author: 'Grace',
			milestone: '1.0',
			dueDate: '2026-12-01',
			project: 'group/proj',
			updatedAt: '2026-11-01',
			reference: 'group/proj#12',
		};
		const content = renderNote(note, null);
		expect(content).toContain('gitlab_iid: 12');
		expect(content).toContain('- [ ] Fix login 📅 2026-12-01 🆔 12');
		expect(content).toContain('[group/proj#12](https://gitlab.com/group/proj/-/issues/12)');
	});

	it('lists projects', () => {
		const content = renderProjects([{
			kind: 'project',
			title: 'Proj',
			state: '',
			project: 'group/proj',
			url: 'https://gitlab.com/group/proj',
			updatedAt: '',
		}]);
		expect(content).toContain('[Proj](https://gitlab.com/group/proj)');
	});
});

describe('settings migration', () => {
	it('normalizes the host and reads the old filter', () => {
		expect(normalizeHost('gitlab.example.com/')).toBe('https://gitlab.example.com');
		expect(projectId('42')).toBe(42);
		expect(projectId('group/proj')).toBe('group/proj');

		const settings = migrateSettings({
			host: 'https://gitlab.example.com/',
			token: ' secret ',
			filter: 'state=closed',
			showIssues: false,
			outputDir: '/',
		});
		expect(settings.host).toBe('https://gitlab.example.com');
		expect(settings.token).toBe('secret');
		expect(settings.issueState).toBe('closed');
		expect(settings.syncIssues).toBe(false);
		expect(settings.outputDir).toBe('GitLab');
		expect(settings.syncMergeRequests).toBe(true);
	});
});
