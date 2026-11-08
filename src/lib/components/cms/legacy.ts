import { marked } from 'marked';

/** Old CMS pages keep Markdown; the editor loads it as HTML and saves Tiptap JSON from then on. */
export function legacyMarkdownToHtml(markdown: string): string {
	if (!markdown.trim()) return '';
	return marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
}

export function slugify(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200);
}

export function formatDateTime(value: string | null): string {
	if (!value) return '—';
	return new Date(value).toLocaleString('lt-LT', { timeZone: 'Europe/Vilnius', dateStyle: 'short', timeStyle: 'short' });
}

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(value: string | null): string {
	if (!value) return '';
	const d = new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
	return value ? new Date(value).toISOString() : null;
}
