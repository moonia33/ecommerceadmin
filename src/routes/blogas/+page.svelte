<script lang="ts">
	import { onMount } from 'svelte';
	import { FolderTree, Plus, Search } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		fetchBlogCategories,
		fetchBlogPosts,
		fetchCmsLookups,
		mediaUrl,
		saveBlogCategory,
		type BlogCategory,
		type BlogPostListItem,
		type BlogState,
		type CmsLookups
	} from '#lib/api/client';
	import { formatDateTime, slugify } from '#lib/components/cms/legacy';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;
	const STATES: Record<BlogState, { label: string; tone: 'slate' | 'amber' | 'emerald' }> = {
		draft: { label: 'Juodraštis', tone: 'slate' },
		scheduled: { label: 'Suplanuotas', tone: 'amber' },
		published: { label: 'Publikuotas', tone: 'emerald' }
	};

	let loading = $state(true);
	let rows = $state<BlogPostListItem[]>([]);
	let total = $state(0);
	let page = $state(1);
	let q = $state('');
	let stateFilter = $state<'' | BlogState>('');

	let lookups = $state<CmsLookups | null>(null);
	let catsOpen = $state(false);
	let cats = $state<BlogCategory[]>([]);
	let catDraft = $state<{ id: number | null; slug: string; names: Record<string, string> }>({ id: null, slug: '', names: {} });

	async function load() {
		loading = true;
		try {
			const res = await fetchBlogPosts({ q, state: stateFilter, page, page_size: PAGE_SIZE });
			rows = res.results;
			total = res.total_count;
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		} finally {
			loading = false;
		}
	}

	async function openCats() {
		catsOpen = true;
		lookups = lookups ?? (await fetchCmsLookups());
		cats = await fetchBlogCategories();
		catDraft = { id: null, slug: '', names: {} };
	}

	function editCat(c: BlogCategory) {
		catDraft = { id: c.id, slug: c.slug, names: Object.fromEntries(c.translations.map((t) => [t.language_code, t.name])) };
	}

	async function saveCat() {
		if (!lookups) return;
		const slug = slugify(catDraft.slug || catDraft.names[lookups.default_language] || '');
		if (!slug) return pushToast('error', 'Įrašykite pavadinimą');
		try {
			await saveBlogCategory(catDraft.id, {
				slug,
				shop_id: null,
				sort_order: 0,
				is_active: true,
				translations: lookups.languages.map((l) => ({ language_code: l.code, name: catDraft.names[l.code] ?? '', description: '' }))
			});
			cats = await fetchBlogCategories();
			await fetchCmsLookups(true);
			catDraft = { id: null, slug: '', names: {} };
			pushToast('success', 'Kategorija išsaugota');
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko išsaugoti');
		}
	}

	onMount(load);
</script>

<div class="space-y-4">
	<PageHeader title="Blogas" subtitle="Straipsniai ir patarimai. Prekes galima įterpti tiesiai į tekstą.">
		{#snippet actions()}
			<button type="button" onclick={openCats} class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><FolderTree size={16} /> Kategorijos</button>
			<a href="/blogas/naujas" class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"><Plus size={16} /> Naujas straipsnis</a>
		{/snippet}
	</PageHeader>

	<form class="flex flex-wrap gap-2" onsubmit={(e) => { e.preventDefault(); page = 1; load(); }}>
		<label class="relative w-full max-w-sm">
			<Search size={16} class="absolute top-2.5 left-3 text-slate-400" />
			<input bind:value={q} placeholder="Ieškoti" class="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm" />
		</label>
		<select bind:value={stateFilter} onchange={() => { page = 1; load(); }} class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
			<option value="">Visi</option>
			<option value="draft">Juodraščiai</option>
			<option value="scheduled">Suplanuoti</option>
			<option value="published">Publikuoti</option>
		</select>
	</form>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
		{#if loading}
			<div class="p-10"><Spinner label="Kraunama…" /></div>
		{:else if !rows.length}
			<EmptyState title="Straipsnių dar nėra" hint="Sukurkite pirmą straipsnį" />
		{:else}
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-left text-xs text-slate-500 uppercase">
					<tr><th class="px-4 py-2"></th><th class="px-4 py-2">Pavadinimas</th><th class="px-4 py-2">Būsena</th><th class="px-4 py-2">Publikuojama</th><th class="px-4 py-2">Kalbos</th><th class="px-4 py-2">Parduotuvė</th></tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="w-16 px-4 py-2">
								{#if row.cover_image}<img src={mediaUrl(row.cover_image)} alt="" class="h-10 w-14 rounded object-cover" />{:else}<div class="h-10 w-14 rounded bg-slate-100"></div>{/if}
							</td>
							<td class="px-4 py-2">
								<a href="/blogas/{row.id}" class="font-medium text-sky-700 hover:underline">{row.title || '(be pavadinimo)'}</a>
								{#if row.is_featured}<Badge label="Išskirtinis" tone="violet" />{/if}
								<div class="font-mono text-xs text-slate-400">{row.slug}</div>
							</td>
							<td class="px-4 py-2"><Badge label={STATES[row.state].label} tone={STATES[row.state].tone} /></td>
							<td class="px-4 py-2 text-slate-500">{formatDateTime(row.published_at)}</td>
							<td class="px-4 py-2 text-xs uppercase">{row.languages.join(', ')}</td>
							<td class="px-4 py-2">{row.shop_code || 'Visos'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
	<Pagination {page} pageSize={PAGE_SIZE} {total} onchange={(p) => { page = p; load(); }} />
</div>

<Modal bind:open={catsOpen} title="Blogo kategorijos">
	<div class="space-y-4 text-sm">
		<div class="flex flex-wrap gap-1.5">
			{#each cats as c (c.id)}
				<button type="button" onclick={() => editCat(c)} class="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50 {catDraft.id === c.id ? 'bg-sky-50' : ''}">
					{c.translations.find((t) => t.language_code === lookups?.default_language)?.name ?? c.slug}
				</button>
			{/each}
		</div>
		{#if lookups}
			<div class="space-y-2 rounded-lg bg-slate-50 p-3">
				<div class="font-semibold">{catDraft.id ? 'Redaguoti' : 'Nauja kategorija'}</div>
				{#each lookups.languages as l (l.code)}
					<label class="flex items-center gap-2">
						<span class="w-8 text-xs uppercase text-slate-500">{l.code}</span>
						<input bind:value={catDraft.names[l.code]} class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5" />
					</label>
				{/each}
				<label class="flex items-center gap-2">
					<span class="w-8 text-xs text-slate-500">URL</span>
					<input bind:value={catDraft.slug} placeholder={slugify(catDraft.names[lookups.default_language] ?? '')} class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs" />
				</label>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<button type="button" onclick={saveCat} class="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500">Išsaugoti kategoriją</button>
	{/snippet}
</Modal>
