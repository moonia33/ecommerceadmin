export function formatMoney(
	value: number | string | null | undefined,
	currency = 'EUR'
): string {
	const num =
		typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN;
	if (!Number.isFinite(num)) return '—';
	return new Intl.NumberFormat('lt-LT', {
		style: 'currency',
		currency: currency || 'EUR',
		maximumFractionDigits: 2
	}).format(num);
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const datePart = new Intl.DateTimeFormat('lt-LT', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
	const timePart = new Intl.DateTimeFormat('lt-LT', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(date);
	return `${datePart} ${timePart}`;
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('lt-LT', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}
