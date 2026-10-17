<script lang="ts">
	import { CheckCircle2, Info, X, XCircle } from '@lucide/svelte';
	import { dismissToast, toasts } from '#lib/stores/toasts.svelte';

	const styles: Record<string, string> = {
		success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
		error: 'border-rose-300 bg-rose-50 text-rose-900',
		info: 'border-sky-300 bg-sky-50 text-sky-900'
	};
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2">
	{#each toasts as toast (toast.id)}
		<div
			class={`pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 shadow-lg ${styles[toast.kind]}`}
		>
			<span class="mt-0.5 shrink-0">
				{#if toast.kind === 'success'}
					<CheckCircle2 size={17} />
				{:else if toast.kind === 'error'}
					<XCircle size={17} />
				{:else}
					<Info size={17} />
				{/if}
			</span>
			<p class="flex-1 text-sm">{toast.message}</p>
			<button
				type="button"
				class="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
				onclick={() => dismissToast(toast.id)}
				aria-label="Uždaryti pranešimą"
			>
				<X size={15} />
			</button>
		</div>
	{/each}
</div>
