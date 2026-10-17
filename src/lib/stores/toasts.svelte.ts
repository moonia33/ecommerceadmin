export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
	id: number;
	kind: ToastKind;
	message: string;
};

let nextId = 1;

export const toasts = $state<Toast[]>([]);

export function pushToast(kind: ToastKind, message: string, timeoutMs = 4500): void {
	const id = nextId++;
	toasts.push({ id, kind, message });
	setTimeout(() => dismissToast(id), timeoutMs);
}

export function dismissToast(id: number): void {
	const index = toasts.findIndex((t) => t.id === id);
	if (index >= 0) toasts.splice(index, 1);
}
