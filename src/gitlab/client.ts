import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { Gitlab } from '@gitbeaker/rest';
import {
	createRequesterFn,
	getMatchingRateLimiter,
	GitbeakerRequestError,
	GitbeakerRetryError,
	type RateLimiters,
	type ResponseBodyTypes,
} from '@gitbeaker/requester-utils';
import { normalizeHost, type GitlabSettings } from '../settings-model';

const RETRY_STATUSES = [429, 502];
const MAX_RETRIES = 3;

interface OutgoingRequest {
	method?: string;
	headers?: Record<string, string>;
	body?: string | FormData;
	searchParams?: string;
	prefixUrl?: string;
	rateLimiters?: RateLimiters;
}

/**
 * Gitbeaker 43 client.
 * The default requester uses fetch; Obsidian plugins call GitLab through requestUrl
 * so the request is not blocked by the app origin.
 */
export function createGitlab(settings: GitlabSettings): Gitlab {
	const token = settings.token.trim();
	if (!token) {
		throw new Error('Укажите personal access token в настройках GitLab');
	}
	return new Gitlab({
		host: normalizeHost(settings.host),
		token,
		queryTimeout: null,
		requesterFn: createRequesterFn(async (_service, request) => request, obsidianRequestHandler),
	});
}

async function obsidianRequestHandler(
	endpoint: string,
	options?: Record<string, unknown>,
): Promise<{ body: ResponseBodyTypes; headers: Record<string, string>; status: number }> {
	const request = (options ?? {}) as OutgoingRequest;
	const method = request.method ?? 'GET';
	const limiter = getMatchingRateLimiter(endpoint, request.rateLimiters ?? {}, method);
	await limiter();

	const url = buildUrl(endpoint, request.prefixUrl, request.searchParams);
	let lastStatus = 0;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const response = await requestUrl({
			url,
			method,
			headers: request.headers,
			body: typeof request.body === 'string' ? request.body : undefined,
			throw: false,
		});
		if (response.status >= 200 && response.status < 300) {
			return {
				body: readBody(response) as ResponseBodyTypes,
				headers: lowercaseHeaders(response.headers),
				status: response.status,
			};
		}
		if (RETRY_STATUSES.indexOf(response.status) === -1) {
			throw new GitbeakerRequestError(extractError(response));
		}
		lastStatus = response.status;
		await delay(2 ** attempt * 250);
	}
	throw new GitbeakerRetryError(
		`GitLab не ответил после ${MAX_RETRIES} попыток, последний статус ${lastStatus}`,
	);
}

function buildUrl(endpoint: string, prefixUrl?: string, searchParams?: string): string {
	if (!prefixUrl) throw new Error('Gitbeaker не передал адрес GitLab API');
	const base = prefixUrl.endsWith('/') ? prefixUrl : `${prefixUrl}/`;
	const url = new URL(endpoint, base);
	if (searchParams) url.search = searchParams;
	return url.toString();
}

function readBody(response: RequestUrlResponse): unknown {
	if (response.status === 204) return null;
	const contentType = (response.headers['content-type'] ?? response.headers['Content-Type'] ?? '').toLowerCase();
	if (contentType.includes('application/json')) {
		try {
			return response.json ?? {};
		} catch {
			return response.text;
		}
	}
	return response.text ?? '';
}

function extractError(response: RequestUrlResponse): string {
	try {
		const payload = response.json as { message?: unknown; error?: unknown } | undefined;
		const content = payload?.error ?? payload?.message;
		if (typeof content === 'string' && content.trim()) return content.trim();
		if (content) return JSON.stringify(content);
	} catch {
		// The body is not JSON.
	}
	const text = response.text?.trim();
	return text || `GitLab ответил статусом ${response.status}`;
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		result[key.toLowerCase()] = value;
	}
	return result;
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => {
		window.setTimeout(resolve, ms);
	});
}
