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
		adjustInventoryItem,
		ApiError,
		fetchInventoryAlerts,
		fetchInventoryItems,
		type OpsInventoryItem
	} from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;
	const REASONS: { value: string; label: string }[] = [
		{ value: 'restock', label: 'Papildymas (gautos prekės)' },
		{ value: 'damage', label: 'Žala / sugadinta pakuotė' },
		{ value: 'correction', label: 'Inventorizacijos korekcija' },
		{ value: 'return', label: 'Grąžinimas iš kliento' },
		{ value: 'other', label: 'Kita priežastis' }
	];

	let tab = $state<'alerts' | 'all'>('alerts');
	let loading = $state(true);
	let items = $state<OpsInventoryItem[]>([]);
	let total = $state(0);
	let page = $state(1);

	// Filtrai
	let threshold = $state(3);
	let sku = $state('');
	let productQ = $state('');
	let warehouseCode = $state('');

	// Koregavimo modalas
	let adjustItem = $state<OpsInventoryItem | null>(null);
	let delta = $state('0');
	let reasonCode = $state('restock');
	let comment = $state('');
	let busy = $state(false);

	async function load(pageNum = page) {
		loading = true;
		try {
			const res =
				tab === 'alerts'
					? await fetchInventoryAlerts({ threshold, page: pageNum, page_size: PAGE_SIZE })
					: await fetchInventoryItems({
							sku: sku.trim(),
							product_q: productQ.trim(),
							warehouse_code: warehouseCode.trim(),
							page: pageNum,
							page_size: PAGE_SIZE
						});
			items = res.results;
			total = res.total_count;
			page = res.page;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti atsargų.');
		} finally {
			loading = false;
		}
	}

	function switchTab(next: 'alerts' | 'all') {
		if (tab === next) return;
		tab = next;
		void load(1);
	}

	function openAdjust(item: OpsInventoryItem) {
		adjustItem = item;
		delta = '0';
		reasonCode = 'restock';
		comment = '';
	}

	async function runAdjust() {
		if (!adjustItem || busy) return;
		const deltaNum = Number.parseInt(delta, 10);
		if (!Number.isFinite(deltaNum) || deltaNum === 0) {
			pushToast('error', 'Įveskite kiekio pokytį (pvz. 5 arba -2).');
			return;
		}
		const nextQty = adjustItem.qty_on_hand + deltaNum;
		if (nextQty < 0 || nextQty < adjustItem.qty_reserved) {
			pushToast(
				'error',
				`Negalima: naujas likutis būtų ${nextQty}, o rezervuota ${adjustItem.qty_reserved} vnt.`
			);
			return;
		}
		busy = true;
		try {
			await adjustInventoryItem(adjustItem.id, {
				delta: deltaNum,
				reason_code: reasonCode,
				comment: comment.trim()
			});
			pushToast('success', 'Likutis pakoreguotas.');
			adjustItem = null;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Koregavimas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load(1));

	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<PageHeader title="Atsargos" subtitle="Prekių likučiai, rezervacijos ir koregavimas">
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

<!-- Tabai -->
<div class="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
	<button
		type="button"
		class={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'alerts' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
		onclick={() => switchTab('alerts')}
	>
		Mažos atsargos
	</button>
	<button
		type="button"
		class={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'all' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
		onclick={() => switchTab('all')}
	>
		Visos prekės sandėlyje
	</button>
</div>

<section class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
	{#if tab === 'alerts'}
		<label class="flex items-center gap-2 text-sm text-slate-600">
			Rodyti kai likutis ≤
			<input
				type="number"
				min="0"
				class={`${inputClass} w-24`}
				bind:value={threshold}
			/>
			vnt.
		</label>
	{:else}
		<input
			class={inputClass}
			placeholder="SKU"
			bind:value={sku}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
		<input
			class={inputClass}
			placeholder="Prekės pavadinimas"
			bind:value={productQ}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
		<input
			class={inputClass}
			placeholder="Sandėlio kodas"
			bind:value={warehouseCode}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
	{/if}
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
			sku = '';
			productQ = '';
			warehouseCode = '';
			threshold = 3;
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunamos atsargos…" />
	{:else if items.length === 0}
		<EmptyState
			title={tab === 'alerts' ? 'Mažų atsargų nėra' : 'Prekių nerasta'}
			hint={tab === 'alerts' ? 'Visų prekių likučiai virš nurodyto slenksčio.' : 'Pakeiskite paieškos kriterijus.'}
		/>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">SKU</th>
						<th class="px-4 py-3 font-medium">Prekė</th>
						<th class="px-4 py-3 font-medium">Sandėlis</th>
						<th class="px-4 py-3 text-right font-medium">Likutis</th>
						<th class="px-4 py-3 text-right font-medium">Rezervuota</th>
						<th class="px-4 py-3 text-right font-medium">Laisva</th>
						<th class="px-4 py-3 font-medium">Matomumas</th>
						<th class="px-4 py-3 text-right font-medium">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-4 py-3 font-mono text-xs text-slate-700">{item.sku}</td>
							<td class="px-4 py-3 font-medium text-slate-800">{item.product_name || '—'}</td>
							<td class="px-4 py-3 text-slate-600">{item.warehouse_code}</td>
							<td class="px-4 py-3 text-right">
								<span
									class={`font-semibold ${item.qty_on_hand <= 0 ? 'text-rose-600' : 'text-slate-900'}`}
									>{item.qty_on_hand}</span
								>
							</td>
							<td class="px-4 py-3 text-right text-slate-600">{item.qty_reserved}</td>
							<td class="px-4 py-3 text-right">
								<span class={item.qty_available <= 0 ? 'font-semibold text-rose-600' : 'text-slate-800'}
									>{item.qty_available}</span
								>
							</td>
							<td class="px-4 py-3">
								<Badge
									label={item.offer_visibility === 'OUTLET' ? 'Outlet' : 'Normali'}
									tone={item.offer_visibility === 'OUTLET' ? 'orange' : 'slate'}
								/>
							</td>
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
									onclick={() => openAdjust(item)}
								>
									Koreguoti
								</button>
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
		() => adjustItem !== null,
		(v) => {
			if (!v) adjustItem = null;
		}
	}
	title="Koreguoti likutį"
	subtitle={adjustItem ? `${adjustItem.product_name || adjustItem.sku} · ${adjustItem.warehouse_code}` : ''}
>
	{#if adjustItem}
		<div class="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
			<div class="rounded-lg bg-slate-50 py-2">
				<p class="text-lg font-semibold text-slate-900">{adjustItem.qty_on_hand}</p>
				<p class="text-xs text-slate-400">Likutis</p>
			</div>
			<div class="rounded-lg bg-slate-50 py-2">
				<p class="text-lg font-semibold text-slate-900">{adjustItem.qty_reserved}</p>
				<p class="text-xs text-slate-400">Rezervuota</p>
			</div>
			<div class="rounded-lg bg-slate-50 py-2">
				<p class="text-lg font-semibold text-slate-900">
					{adjustItem.qty_on_hand + (Number.parseInt(delta, 10) || 0)}
				</p>
				<p class="text-xs text-slate-400">Bus po korekcijos</p>
			</div>
		</div>
	{/if}
	<label class="block text-sm font-medium text-slate-700" for="delta">Pokytis (vnt.)</label>
	<input
		id="delta"
		type="number"
		class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
		placeholder="Pvz.: 5 arba -2"
		bind:value={delta}
	/>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="reason">Priežastis</label>
	<select
		id="reason"
		class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
		bind:value={reasonCode}
	>
		{#each REASONS as reason}
			<option value={reason.value}>{reason.label}</option>
		{/each}
	</select>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="comment">Komentaras</label>
	<textarea
		id="comment"
		class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
		rows="2"
		placeholder="Neprivaloma"
		bind:value={comment}
	></textarea>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (adjustItem = null)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void runAdjust()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>
