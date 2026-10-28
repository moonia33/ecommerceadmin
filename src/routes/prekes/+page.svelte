<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Image as ImageIcon, Plus, RotateCcw, Search } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		ApiError,
		catalogBulkAction,
		createCatalogProduct,
		fetchCatalogLookups,
		fetchCatalogProducts,
		toggleCatalogProduct,
		type OpsCatalogProduct,
		type OpsLookupOption
	} from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let products = $state<OpsCatalogProduct[]>([]);
	let total = $state(0);
	let page = $state(1);
	let selected = $state<Set<number>>(new Set());
	let busyId = $state<number | null>(null);
	let bulkBusy = $state(false);

	let q = $state('');
	let isActive = $state('');
	let categoryId = $state('');
	let groupId = $state('');
	let brandId = $state('');

	// Kategorijų lookup (inline redagavimui + bulk priskyrimui)
	let categories = $state<OpsLookupOption[]>([]);
	let groups = $state<OpsLookupOption[]>([]);
	let brands = $state<OpsLookupOption[]>([]);
	let catBusyId = $state<number | null>(null);

	// Masinio veiksmo patvirtinimas
	let bulkKind = $state<'' | 'activate_products' | 'deactivate_products' | 'assign_category' | 'assign_group'>('');
	let bulkCategoryId = $state<number | null>(null);
	let createOpen = $state(false);
	let createDraft = $state({ name: '', sku: '', price_eur: '' });
	let createBusy = $state(false);

	async function createProduct() {
		if (!createDraft.name.trim() || createBusy) return;
		createBusy = true;
		try {
			const p = await createCatalogProduct({
				name: createDraft.name.trim(),
				sku: createDraft.sku.trim() || undefined,
				price_eur: createDraft.price_eur.trim() || undefined
			});
			pushToast('success', 'Prekė sukurta.');
			createOpen = false;
			createDraft = { name: '', sku: '', price_eur: '' };
			goto(`/prekes/${p.id}`);
		} catch (e) {
			pushToast('error', e instanceof Error ? e.message : 'Nepavyko sukurti.');
		} finally {
			createBusy = false;
		}
	}
	let bulkGroupId = $state<number | null>(null);

	async function assignCategory(productId: number, categoryId: number | null) {
		if (catBusyId !== null) return;
		catBusyId = productId;
		try {
			await catalogBulkAction('assign_category', [productId], { categoryId });
			pushToast('success', 'Kategorija pakeista.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko pakeisti kategorijos.');
		} finally {
			catBusyId = null;
		}
	}

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchCatalogProducts({
				q: q.trim(),
				is_active: isActive,
				category_id: categoryId || undefined,
				group_id: groupId || undefined,
				brand_id: brandId || undefined,
				page: pageNum,
				page_size: PAGE_SIZE
			});
			products = res.results;
			total = res.total_count;
			page = res.page;
			selected = new Set();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti prekių.');
		} finally {
			loading = false;
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleSelectAll() {
		if (selected.size === products.length) selected = new Set();
		else selected = new Set(products.map((p) => p.id));
	}

	async function toggleActive(product: OpsCatalogProduct) {
		if (busyId !== null) return;
		busyId = product.id;
		try {
			await toggleCatalogProduct(product.id);
			pushToast(
				'success',
				product.is_active
					? `„${product.name}" deaktyvuota — nebematoma parduotuvėje.`
					: `„${product.name}" aktyvuota.`
			);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busyId = null;
		}
	}

	async function runBulk() {
		if (!bulkKind || bulkBusy || selected.size === 0) return;
		if (bulkKind === 'assign_category' && bulkCategoryId === null && !confirm('Nuimti kategoriją pažymėtoms prekėms?')) return;
		if (bulkKind === 'assign_group' && bulkGroupId === null && !confirm('Nuimti grupę pažymėtoms prekėms?')) return;
		bulkBusy = true;
		try {
			const res = await catalogBulkAction(bulkKind, [...selected], { categoryId: bulkCategoryId, groupId: bulkGroupId });
			pushToast(
				'success',
				bulkKind === 'assign_group'
					? `Grupė priskirta ${res.updated_ids.length} prekėms.`
					: bulkKind === 'assign_category'
						? `Kategorija priskirta ${res.updated_ids.length} prekėms.`
					: bulkKind === 'activate_products'
						? `Aktyvuota prekių: ${res.updated_ids.length}.`
						: `Deaktyvuota prekių: ${res.updated_ids.length}.`
			);
			bulkKind = '';
			bulkCategoryId = null;
			bulkGroupId = null;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Masinis veiksmas nepavyko.');
		} finally {
			bulkBusy = false;
		}
	}

	onMount(() => {
		void load(1);
		fetchCatalogLookups()
			.then((l) => {
				categories = l.categories;
				groups = l.groups;
				brands = l.brands;
			})
			.catch(() => {});
	});

	const selectClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<PageHeader title="Prekės" subtitle="Katalogo administravimas: aktyvumas, kainos, matomumas">
	{#snippet actions()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => void load()}
		>
			Atnaujinti
		</button>
	{/snippet}
</PageHeader>

<section
	class="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
>
	<div class="relative min-w-64 flex-1">
		<Search size={16} class="pointer-events-none absolute top-3 left-3 text-slate-400" />
		<input
			class={`${inputClass} w-full pl-9`}
			placeholder="Ieškoti pagal pavadinimą, SKU arba slug"
			bind:value={q}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
	</div>
	<select class={selectClass} bind:value={categoryId} aria-label="Kategorija" onchange={() => void load(1)}>
		<option value="">Visos kategorijos</option>
		<option value="0">— be kategorijos —</option>
		{#each categories as cat (cat.id)}
			<option value={cat.id}>{' '.repeat(Math.min(cat.depth, 6) * 2)}{cat.name}</option>
		{/each}
	</select>
	<select class={selectClass} bind:value={groupId} aria-label="Grupė" onchange={() => void load(1)}>
		<option value="">Visos grupės</option>
		<option value="0">— be grupės —</option>
		{#each groups as g (g.id)}
			<option value={g.id}>{g.name}</option>
		{/each}
	</select>
	<select class={selectClass} bind:value={brandId} aria-label="Gamintojas" onchange={() => void load(1)}>
		<option value="">Visi gamintojai</option>
		<option value="0">— be gamintojo —</option>
		{#each brands as b (b.id)}
			<option value={b.id}>{b.name}</option>
		{/each}
	</select>
	<select class={selectClass} bind:value={isActive} aria-label="Aktyvumas">
		<option value="">Visos</option>
		<option value="true">Aktyvios</option>
		<option value="false">Neaktyvios</option>
	</select>
	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
		onclick={() => void load(1)}
	>
		<Search size={15} /> Ieškoti
	</button>
	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
		onclick={() => {
			q = '';
			isActive = '';
			categoryId = '';
			groupId = '';
			brandId = '';
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

{#if selected.size > 0}
	<div
		class="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm"
	>
		<span class="text-sm font-medium text-sky-900">Pažymėta: {selected.size}</span>
		<button
			type="button"
			class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"
			onclick={() => (bulkKind = 'activate_products')}
		>
			Aktyvuoti
		</button>
		<button
			type="button"
			class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50"
			onclick={() => (bulkKind = 'deactivate_products')}
		>
			Deaktyvuoti
		</button>
		<button
			type="button"
			class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50"
			onclick={() => {
				bulkCategoryId = null;
				bulkKind = 'assign_category';
			}}
		>
			Priskirti kategorijai
		</button>
		<button
			type="button"
			class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50"
			onclick={() => {
				bulkGroupId = null;
				bulkKind = 'assign_group';
			}}
		>
			Priskirti grupei
		</button>
		<button
			type="button"
			class="ml-auto text-sm text-slate-500 hover:text-slate-700"
			onclick={() => (selected = new Set())}
		>
			Atžymėti visus
		</button>
	</div>
{/if}

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunamos prekės…" />
	{:else if products.length === 0}
		<EmptyState title="Prekių nerasta" hint="Pakeiskite paieškos tekstą arba filtrus." />
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-3 py-3">
							<input
								type="checkbox"
								class="h-4 w-4 rounded border-slate-300"
								checked={selected.size === products.length && products.length > 0}
								onchange={toggleSelectAll}
								aria-label="Pažymėti visas"
							/>
						</th>
						<th class="px-3 py-3 font-medium">Prekė</th>
						<th class="px-3 py-3 font-medium">SKU</th>
						<th class="px-3 py-3 font-medium">Gamintojas</th>
						<th class="px-3 py-3 font-medium">Kategorija</th>
						<th class="px-3 py-3 text-right font-medium">Variantai</th>
						<th class="px-3 py-3 font-medium">Būsena</th>
						<th class="px-3 py-3 text-right font-medium">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each products as product (product.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-3 py-3">
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-slate-300"
									checked={selected.has(product.id)}
									onchange={() => toggleSelect(product.id)}
									aria-label={`Pažymėti ${product.name}`}
								/>
							</td>
							<td class="px-3 py-3">
								<div class="flex items-center gap-3">
									{#if product.thumbnail_url}
										<img
											src={product.thumbnail_url}
											alt={product.name}
											class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
											loading="lazy"
										/>
									{:else}
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300"
										>
											<ImageIcon size={16} />
										</div>
									{/if}
									<div class="min-w-0">
										<a
											href={`/prekes/${product.id}`}
											class="font-semibold text-sky-700 hover:underline">{product.name}</a
										>
										<div class="truncate text-xs text-slate-400">{product.slug}</div>
									</div>
								</div>
							</td>
							<td class="px-3 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
							<td class="px-3 py-3 text-slate-700">{product.brand_name || '—'}</td>
							<td class="px-3 py-3">
							<input
								list="cat-list"
								class="w-52 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 focus:outline-none disabled:opacity-50"
								value={product.category_name || ''}
								placeholder="— be kategorijos —"
								disabled={catBusyId !== null}
								onchange={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value.trim().toLowerCase();
									const cat = categories.find((c) => c.name.toLowerCase() === v);
									if (v === '' || cat) void assignCategory(product.id, cat?.id ?? null);
								}}
								aria-label={`Kategorija: ${product.name}`}
							/>
						</td>
							<td class="px-3 py-3 text-right text-slate-600">{product.variants_count}</td>
							<td class="px-3 py-3">
								<Badge
									label={product.is_active ? 'Aktyvi' : 'Neaktyvi'}
									tone={product.is_active ? 'emerald' : 'slate'}
								/>
							</td>
							<td class="px-3 py-3">
								<div class="flex justify-end gap-1.5">
									<a
										href={`/prekes/${product.id}`}
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
									>
										Atidaryti
									</a>
									<button
										type="button"
										class={`rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
											product.is_active
												? 'border-rose-200 text-rose-600 hover:bg-rose-50'
												: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
										}`}
										disabled={busyId !== null}
										onclick={() => void toggleActive(product)}
									>
										{product.is_active ? 'Deaktyvuoti' : 'Aktyvuoti'}
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="border-t border-slate-200 px-4 py-3">
			<Pagination {page} pageSize={PAGE_SIZE} {total} onchange={(p) => void load(p)} />
		</div>
	{/if}
</section>

{#if createOpen}
	<Modal bind:open={createOpen} title="Nauja prekė">
		<div class="space-y-3">
			<div>
				<label class="text-sm font-medium text-slate-700" for="np-name">Pavadinimas *</label>
				<input id="np-name" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" bind:value={createDraft.name} />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="text-sm font-medium text-slate-700" for="np-sku">SKU (tuščia = auto)</label>
					<input id="np-sku" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" bind:value={createDraft.sku} />
				</div>
				<div>
					<label class="text-sm font-medium text-slate-700" for="np-price">Kaina € be PVM</label>
					<input id="np-price" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" bind:value={createDraft.price_eur} />
				</div>
			</div>
		</div>
		{#snippet footer()}
			<button type="button" class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50" disabled={!createDraft.name.trim() || createBusy} onclick={() => void createProduct()}>
				Sukurti
			</button>
		{/snippet}
	</Modal>
{/if}

<datalist id="cat-list">
	{#each categories as cat (cat.id)}
		<option value={cat.name}></option>
	{/each}
</datalist>

<Modal
	bind:open={
		() => bulkKind !== '',
		(v) => {
			if (!v) bulkKind = '';
		}
	}
	title={
		bulkKind === 'assign_group'
			? 'Priskirti grupei'
			: bulkKind === 'assign_category'
				? 'Priskirti kategorijai'
				: bulkKind === 'activate_products'
					? 'Aktyvuoti prekes'
					: 'Deaktyvuoti prekes'
	}
	subtitle={`Veiksmas bus pritaikytas ${selected.size} prekėms.`}
>
	{#if bulkKind === 'assign_group'}
		<label class="block text-sm font-medium text-slate-700" for="bulk-grp">Grupė</label>
		<select
			id="bulk-grp"
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
			bind:value={bulkGroupId}
		>
			<option value={null}>— be grupės (nuimti) —</option>
			{#each groups as g (g.id)}
				<option value={g.id}>{g.name}</option>
			{/each}
		</select>
	{:else if bulkKind === 'assign_category'}
		<label class="block text-sm font-medium text-slate-700" for="bulk-cat">Kategorija</label>
		<select
			id="bulk-cat"
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
			bind:value={bulkCategoryId}
		>
			<option value={null}>— be kategorijos (nuimti) —</option>
			{#each categories as cat (cat.id)}
				<option value={cat.id}>{' '.repeat(Math.min(cat.depth, 6) * 2)}{cat.name}</option>
			{/each}
		</select>
	{:else if bulkKind === 'deactivate_products'}
		<p class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
			Deaktyvuotos prekės nebebus matomos parduotuvėje.
		</p>
	{:else}
		<p class="text-sm text-slate-600">Pažymėtos prekės taps matomos parduotuvėje.</p>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (bulkKind = '')}
			disabled={bulkBusy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void runBulk()}
			disabled={bulkBusy}
		>
			{bulkBusy ? 'Vykdoma…' : 'Vykdyti'}
		</button>
	{/snippet}
</Modal>
