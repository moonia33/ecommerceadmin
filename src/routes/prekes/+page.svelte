<script lang="ts">
	import { onMount } from 'svelte';
	import { RotateCcw, Search } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		ApiError,
		catalogBulkAction,
		fetchCatalogProducts,
		toggleCatalogProduct,
		type OpsCatalogProduct
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

	// Masinio veiksmo patvirtinimas
	let bulkKind = $state<'' | 'activate_products' | 'deactivate_products'>('');

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchCatalogProducts({
				q: q.trim(),
				is_active: isActive,
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
		bulkBusy = true;
		try {
			const res = await catalogBulkAction(bulkKind, [...selected]);
			pushToast(
				'success',
				bulkKind === 'activate_products'
					? `Aktyvuota prekių: ${res.updated_ids.length}.`
					: `Deaktyvuota prekių: ${res.updated_ids.length}.`
			);
			bulkKind = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Masinis veiksmas nepavyko.');
		} finally {
			bulkBusy = false;
		}
	}

	onMount(() => void load(1));

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
								<a
									href={`/prekes/${product.id}`}
									class="font-semibold text-sky-700 hover:underline">{product.name}</a
								>
								<div class="text-xs text-slate-400">{product.slug}</div>
							</td>
							<td class="px-3 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
							<td class="px-3 py-3 text-slate-700">{product.brand_name || '—'}</td>
							<td class="px-3 py-3 text-slate-700">{product.category_name || '—'}</td>
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

<Modal
	bind:open={
		() => bulkKind !== '',
		(v) => {
			if (!v) bulkKind = '';
		}
	}
	title={bulkKind === 'activate_products' ? 'Aktyvuoti prekes' : 'Deaktyvuoti prekes'}
	subtitle={`Veiksmas bus pritaikytas ${selected.size} prekėms.`}
>
	{#if bulkKind === 'deactivate_products'}
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
