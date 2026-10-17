<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	let {
		page,
		pageSize,
		total,
		onchange
	}: {
		page: number;
		pageSize: number;
		total: number;
		onchange: (page: number) => void;
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const from = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const to = $derived(Math.min(total, page * pageSize));
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<p class="text-sm text-slate-500">
		Rodoma <span class="font-medium text-slate-700">{from}–{to}</span> iš
		<span class="font-medium text-slate-700">{total}</span>
	</p>
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={page <= 1}
			onclick={() => onchange(page - 1)}
		>
			<ChevronLeft size={15} />
			Ankstesnis
		</button>
		<span class="px-2 text-sm text-slate-600">
			{page} / {totalPages}
		</span>
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={page >= totalPages}
			onclick={() => onchange(page + 1)}
		>
			Kitas
			<ChevronRight size={15} />
		</button>
	</div>
</div>
