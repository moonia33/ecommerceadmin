<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	let {
		open = $bindable(false),
		title,
		subtitle = '',
		children,
		footer
	}: {
		open?: boolean;
		title: string;
		subtitle?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	function close() {
		open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-slate-900/50"
			onclick={close}
			aria-label="Uždaryti"
			tabindex="-1"
		></button>
		<div
			class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
			role="dialog"
			aria-modal="true"
		>
			<div class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
				<div>
					<h3 class="text-lg font-semibold text-slate-900">{title}</h3>
					{#if subtitle}
						<p class="mt-0.5 text-sm text-slate-500">{subtitle}</p>
					{/if}
				</div>
				<button
					type="button"
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					onclick={close}
					aria-label="Uždaryti langą"
				>
					<X size={18} />
				</button>
			</div>
			<div class="px-5 py-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
