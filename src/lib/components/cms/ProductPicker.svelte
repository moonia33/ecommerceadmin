<script lang="ts">
	import { Check, Search } from '@lucide/svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { fetchCatalogProducts, mediaUrl, type BlogProductRef } from '#lib/api/client';

	let {
		open = $bindable(false),
		title = 'Pasirinkite prekes',
		initial = [],
		withTitle = false,
		onpick
	}: {
		open?: boolean;
		title?: string;
		initial?: BlogProductRef[];
		withTitle?: boolean;
		onpick: (products: BlogProductRef[], blockTitle: string) => void;
	} = $props();

	let q = $state('');
	let loading = $state(false);
	let results = $state<BlogProductRef[]>([]);
	let picked = $state<BlogProductRef[]>([]);
	let blockTitle = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (open) {
			picked = [...initial];
			blockTitle = '';
			search();
		}
	});

	async function search() {
		loading = true;
		try {
			const res = await fetchCatalogProducts({ q: q.trim(), page_size: 20, is_active: true });
			results = res.results.map((p) => ({ id: p.id, sku: p.sku, name: p.name, image: p.thumbnail_url }));
		} catch {
			results = [];
		} finally {
			loading = false;
		}
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(search, 300);
	}

	function toggle(p: BlogProductRef) {
		picked = picked.some((x) => x.id === p.id) ? picked.filter((x) => x.id !== p.id) : [...picked, p];
	}

	function confirm() {
		onpick(picked, blockTitle.trim());
		open = false;
	}
</script>

<Modal bind:open {title} subtitle="Ieškokite pagal pavadinimą arba SKU">
	<div class="space-y-3">
		{#if withTitle}
			<input
				bind:value={blockTitle}
				placeholder="Bloko antraštė (nebūtina), pvz. „Straipsnyje minimos prekės“"
				class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
			/>
		{/if}
		<label class="relative block">
			<Search size={16} class="absolute top-2.5 left-3 text-slate-400" />
			<input
				bind:value={q}
				oninput={onInput}
				placeholder="Paieška…"
				class="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm"
			/>
		</label>
		{#if picked.length}
			<div class="flex flex-wrap gap-1.5">
				{#each picked as p (p.id)}
					<button
						type="button"
						onclick={() => toggle(p)}
						class="rounded-full bg-sky-100 px-2.5 py-1 text-xs text-sky-800 hover:bg-sky-200"
						title="Pašalinti">{p.sku} ✕</button
					>
				{/each}
			</div>
		{/if}
		<div class="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
			{#if loading}
				<div class="p-6"><Spinner label="Ieškoma…" /></div>
			{:else if !results.length}
				<p class="p-6 text-center text-sm text-slate-500">Nieko nerasta</p>
			{:else}
				{#each results as p (p.id)}
					{@const on = picked.some((x) => x.id === p.id)}
					<button
						type="button"
						onclick={() => toggle(p)}
						class="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 {on
							? 'bg-sky-50'
							: ''}"
					>
						{#if p.image}
							<img src={mediaUrl(p.image)} alt="" class="h-10 w-10 rounded object-cover" />
						{:else}
							<div class="h-10 w-10 rounded bg-slate-100"></div>
						{/if}
						<span class="flex-1">
							<span class="block font-medium text-slate-800">{p.name}</span>
							<span class="text-xs text-slate-500">{p.sku}</span>
						</span>
						{#if on}<Check size={16} class="text-sky-600" />{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (open = false)}
			class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
			>Atšaukti</button
		>
		<button
			type="button"
			onclick={confirm}
			disabled={!picked.length && !initial.length}
			class="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
			>Pasirinkti ({picked.length})</button
		>
	{/snippet}
</Modal>
