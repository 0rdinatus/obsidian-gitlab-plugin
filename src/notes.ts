import { normalizePath, TFile, TFolder, Vault } from 'obsidian';
import { fetchSnapshot } from './gitlab/entities';
import type { FetchSelection, GitlabListItem, GitlabNote, SyncKind, SyncReport } from './gitlab/types';
import { renderNote, renderProjects } from './render';
import type { GitlabSettings } from './settings-model';
import { folderFor, noteFileName } from './util';

export async function writeGitlabNotes(
	vault: Vault,
	settings: GitlabSettings,
	kind: SyncKind,
): Promise<SyncReport> {
	const selection = selectionFor(settings, kind);
	if (!selection.issues && !selection.mergeRequests && !selection.todos && !selection.projects) {
		return { issues: 0, mergeRequests: 0, todos: 0, projects: 0, empty: true };
	}
	const snapshot = await fetchSnapshot(settings, selection);
	const template = await readTemplate(vault, settings.templateFile);
	const outputDir = normalizePath(settings.outputDir);

	if (selection.issues) await writeNotes(vault, outputDir, snapshot.issues, template);
	if (selection.mergeRequests) await writeNotes(vault, outputDir, snapshot.mergeRequests, template);
	if (selection.todos) await writeNotes(vault, outputDir, snapshot.todos, template);
	if (selection.projects) await writeProjects(vault, outputDir, snapshot.projects);

	return {
		issues: selection.issues ? snapshot.issues.length : 0,
		mergeRequests: selection.mergeRequests ? snapshot.mergeRequests.length : 0,
		todos: selection.todos ? snapshot.todos.length : 0,
		projects: selection.projects ? snapshot.projects.length : 0,
		empty: false,
	};
}

function selectionFor(settings: GitlabSettings, kind: SyncKind): FetchSelection {
	if (kind === 'issues') {
		return { issues: true, mergeRequests: false, todos: false, projects: false, user: false };
	}
	if (kind === 'merge_requests') {
		return { issues: false, mergeRequests: true, todos: false, projects: false, user: false };
	}
	if (kind === 'todos') {
		return { issues: false, mergeRequests: false, todos: true, projects: false, user: false };
	}
	const anyEntity = settings.syncIssues || settings.syncMergeRequests || settings.syncTodos;
	return {
		issues: settings.syncIssues,
		mergeRequests: settings.syncMergeRequests,
		todos: settings.syncTodos,
		projects: anyEntity,
		user: false,
	};
}

async function readTemplate(vault: Vault, templateFile: string): Promise<string | null> {
	const path = normalizePath(templateFile.trim());
	if (!path) return null;
	const file = vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		throw new Error(`Шаблон не найден: ${path}`);
	}
	return vault.read(file);
}

async function writeNotes(vault: Vault, outputDir: string, notes: GitlabNote[], template: string | null): Promise<void> {
	for (const note of notes) {
		const folder = normalizePath(`${outputDir}/${folderFor(note.kind)}`);
		const name = noteFileName(note.kind, note.project, note.iid, note.id);
		await writeFile(vault, folder, name, renderNote(note, template));
	}
}

async function writeProjects(vault: Vault, outputDir: string, projects: GitlabListItem[]): Promise<void> {
	await writeFile(vault, outputDir, 'projects.md', renderProjects(projects));
}

async function writeFile(vault: Vault, folder: string, name: string, content: string): Promise<void> {
	await ensureFolder(vault, folder);
	const path = normalizePath(`${folder}/${name}`);
	const existing = vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await vault.modify(existing, content);
		return;
	}
	if (existing) {
		throw new Error(`Не удалось записать ${path}: путь занят папкой`);
	}
	await vault.create(path, content);
}

async function ensureFolder(vault: Vault, folder: string): Promise<void> {
	const path = normalizePath(folder);
	if (!path) return;
	const parts = path.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const node = vault.getAbstractFileByPath(current);
		if (node instanceof TFolder) continue;
		if (node) throw new Error(`Папка заметок занята файлом: ${current}`);
		try {
			await vault.createFolder(current);
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (!/exist/i.test(message)) throw error;
		}
	}
}
