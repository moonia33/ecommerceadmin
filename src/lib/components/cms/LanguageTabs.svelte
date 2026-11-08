<script lang="ts">
	import type { CmsOption } from '#lib/api/client';

	let {
		languages,
		current = $bindable(),
		filled = []
	}: { languages: CmsOption[]; current: string; filled?: string[] } = $props();
</script>

<div class="flex flex-wrap gap-1 border-b border-slate-200">
	{#each languages as lang (lang.code)}
		<button
			type="button"
			onclick={() => (current = lang.code)}
			class="-mb-px rounded-t-lg border px-3 py-1.5 text-sm {current === lang.code
				? 'border-slate-200 border-b-white bg-white font-semibold text-slate-900'
				: 'border-transparent text-slate-500 hover:text-slate-800'}"
		>
			{lang.code.toUpperCase()}
			{#if filled.includes(lang.code)}<span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>{/if}
		</button>
	{/each}
</div>
