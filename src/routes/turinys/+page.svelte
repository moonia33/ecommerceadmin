<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Search } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { fetchCmsPages, type CmsPageListItem } from '#lib/api/client';
	import { formatDateTime } from '#lib/components/cms/legacy';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 50;
	let loading = $state(true);
	let rows = $state<CmsPageListItem[]>([]);
	let total = $state(0);
	let page = $state(1);
	let q = $state('');

	async function load() {
		loading = true;
		try {
			const res = await fetchCmsPages({ q, page, page_size: PAGE_SIZE });
			rows = res.results;
			total = res.total_count;
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		} finally {
			loading = false;
		}
	}

	onMount(load);
</script>

<div class="space-y-4">
	<PageHeader title="Puslapiai" subtitle="Informaciniai puslapiai (apie mus, pristatymas, DUK…). Taisyklės ir privatumas — Django admin „Teisiniai dokumentai“.">
		{#snippet actions()}
			<a href="/turinys/naujas" class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"><Plus size={16} /> Naujas puslapis</a>
		{/snippet}
	</PageHeader>

	<form class="relative max-w-sm" onsubmit={(e) => { e.preventDefault(); page = 1; load(); }}>
		<Search size={16} class="absolute top-2.5 left-3 text-slate-400" />
		<input bind:value={q} placeholder="Ieškoti pagal pavadinimą ar adresą" class="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm" />
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
		{#if loading}
			<div class="p-10"><Spinner label="Kraunama…" /></div>
		{:else if !rows.length}
			<EmptyState title="Puslapių nėra" />
		{:else}
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-left text-xs text-slate-500 uppercase">
					<tr><th class="px-4 py-2">Pavadinimas</th><th class="px-4 py-2">Adresas</th><th class="px-4 py-2">Parduotuvė</th><th class="px-4 py-2">Kalbos</th><th class="px-4 py-2">Būsena</th><th class="px-4 py-2">Atnaujinta</th></tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-4 py-2"><a href="/turinys/{row.id}" class="font-medium text-sky-700 hover:underline">{row.title || row.slug}</a></td>
							<td class="px-4 py-2 font-mono text-xs text-slate-500">/info/{row.slug}</td>
							<td class="px-4 py-2">{row.shop_code || 'Visos'}</td>
							<td class="px-4 py-2 text-xs uppercase">{row.languages.join(', ')}</td>
							<td class="px-4 py-2">
								<Badge label={row.is_active ? 'Rodomas' : 'Paslėptas'} tone={row.is_active ? 'emerald' : 'slate'} />
								{#if !row.uses_editor}<Badge label="Senas formatas" tone="amber" />{/if}
							</td>
							<td class="px-4 py-2 text-slate-500">{formatDateTime(row.updated_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
	<Pagination {page} pageSize={PAGE_SIZE} {total} onchange={(p) => { page = p; load(); }} />
</div>
