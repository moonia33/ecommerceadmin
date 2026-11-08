<script lang="ts">
	let {
		title = $bindable(''),
		description = $bindable(''),
		fallbackTitle = ''
	}: { title: string; description: string; fallbackTitle?: string } = $props();
</script>

<details class="rounded-xl border border-slate-200 bg-white p-4">
	<summary class="cursor-pointer text-sm font-semibold text-slate-700">SEO (Google paieškai)</summary>
	<div class="mt-3 space-y-3">
		<label class="block text-sm">
			<span class="text-slate-600">SEO pavadinimas <span class="text-slate-400">({title.length}/60)</span></span>
			<input bind:value={title} placeholder={fallbackTitle} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
		</label>
		<label class="block text-sm">
			<span class="text-slate-600">SEO aprašymas <span class="text-slate-400">({description.length}/160)</span></span>
			<textarea bind:value={description} rows="3" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"></textarea>
		</label>
		<div class="rounded-lg bg-slate-50 p-3 text-sm">
			<div class="truncate text-[#1a0dab]">{title || fallbackTitle || 'Pavadinimas'}</div>
			<div class="line-clamp-2 text-slate-600">{description || 'Aprašymas, kuris bus rodomas paieškos rezultatuose.'}</div>
		</div>
	</div>
</details>
