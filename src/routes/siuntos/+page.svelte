<script lang="ts">
	import { onMount } from 'svelte';
	import { Printer, RefreshCw, RotateCcw, Search, Truck } from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		fetchShipmentRegistry,
		fetchShipments,
		generateLabelForShipment,
		generateShipmentLabel,
		generateShipmentLabelsBulk,
		markShipmentShipped,
		refreshShipmentTracking,
		type OpsShipment,
		type OpsShipmentRow
	} from '#lib/api/client';
	import { formatDateTime } from '#lib/format';
	import { shippingMethodLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let shipments = $state<OpsShipment[]>([]);
	let total = $state(0);
	let page = $state(1);
	let selected = $state<Set<number>>(new Set());
	let busyId = $state<number | null>(null);
	let bulkBusy = $state(false);

	let deliveryStatus = $state('');
	let shippingMethod = $state('');
	let trackingQ = $state('');
	let registry = $state<OpsShipmentRow[]>([]);
	let registryLoading = $state(false);

	async function searchRegistry() {
		if (!trackingQ.trim()) {
			registry = [];
			return;
		}
		registryLoading = true;
		try {
			registry = await fetchShipmentRegistry({ tracking: trackingQ.trim() });
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Paieška nepavyko.');
		} finally {
			registryLoading = false;
		}
	}

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchShipments({
				status: deliveryStatus,
				shipping_method: shippingMethod.trim(),
				page: pageNum,
				page_size: PAGE_SIZE
			});
			shipments = res.results;
			total = res.total_count;
			page = res.page;
			selected = new Set();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti siuntų.');
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
		if (selected.size === shipments.length) selected = new Set();
		else selected = new Set(shipments.map((s) => s.order_id));
	}

	async function runFor(orderId: number, fn: () => Promise<{ message?: string }>) {
		if (busyId !== null) return;
		busyId = orderId;
		try {
			const res = await fn();
			pushToast('success', res.message || 'Atlikta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busyId = null;
		}
	}

	async function bulkLabels() {
		if (bulkBusy || selected.size === 0) return;
		bulkBusy = true;
		try {
			const job = await generateShipmentLabelsBulk([...selected]);
			const failed = (job.result_payload?.failed as unknown[] | undefined)?.length ?? 0;
			if (job.status === 'success' && failed === 0) {
				pushToast('success', `Lipdukai sugeneruoti (${selected.size}).`);
			} else {
				pushToast('error', `${job.error_message || 'Dalį lipdukų sugeneruoti nepavyko.'}`);
			}
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Masinė generacija nepavyko.');
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

<PageHeader title="Siuntos" subtitle="Lipdukai, sekimo numeriai ir išsiuntimo būsenos">
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

<section class="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
	<select class={selectClass} bind:value={deliveryStatus} aria-label="Pristatymo būsena">
		<option value="">Visos pristatymo būsenos</option>
		<option value="pending">Nepraruošta</option>
		<option value="awaiting_stock">Laukia prekės</option>
		<option value="packing">Komplektuojama</option>
		<option value="packed">Supakuota</option>
		<option value="picked_up">Perduota vežėjui</option>
		<option value="in_transit">Kelyje</option>
		<option value="at_pickup_point">Atvyko į tašką</option>
		<option value="delivered">Pristatyta</option>
		<option value="error">Klaida</option>
	</select>
	<input
		class={inputClass}
		placeholder="Pristatymo metodas (pvz. dpd_locker)"
		bind:value={shippingMethod}
		onkeydown={(e) => e.key === 'Enter' && load(1)}
	/>
	<input
		class={inputClass}
		placeholder="Sekimo / siuntos nr."
		bind:value={trackingQ}
		onkeydown={(e) => e.key === 'Enter' && void searchRegistry()}
	/>
	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
		onclick={() => {
			if (trackingQ.trim()) void searchRegistry();
			else void load(1);
		}}
	>
		<Search size={15} /> Ieškoti
	</button>
	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
		onclick={() => {
			deliveryStatus = '';
			shippingMethod = '';
			trackingQ = '';
			registry = [];
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

{#if trackingQ.trim() && (registryLoading || registry.length > 0)}
	<section class="mt-4 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-3">
			<h2 class="text-sm font-semibold text-slate-900">
				Siuntų registro paieška: „{trackingQ}"
			</h2>
		</div>
		{#if registryLoading}
			<Spinner label="Ieškoma…" />
		{:else}
			<div class="divide-y divide-slate-100">
				{#each registry as s}
					<div class="flex flex-wrap items-center gap-4 px-5 py-3">
						<a
							href={`/uzsakymai/${s.order_id}`}
							class="font-semibold text-sky-700 hover:underline">#{s.order_id}</a
						>
						<span class="text-xs font-medium text-slate-500">S{s.id}</span>
						<span
							class={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
								s.kind === 'return'
									? 'bg-amber-50 text-amber-700 ring-amber-200'
									: 'bg-slate-50 text-slate-600 ring-slate-200'
							}`}
						>
							{s.kind === 'return' ? 'Grąžinimas' : 'Siuntimas'}
						</span>
						<StatusBadge kind="delivery" value={s.status} />
						<span class="font-mono text-xs text-slate-700">{s.tracking_number || '—'}</span>
						<span class="text-xs text-slate-500">{s.pickup_point_name}</span>
						{#if s.label_url}
							<a
								href={s.label_url}
								target="_blank"
								rel="noreferrer noopener"
								class="text-xs font-medium text-sky-600 hover:underline">PDF</a
							>
						{/if}
						<button
							type="button"
							class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
							onclick={() => void runFor(s.order_id, () => generateLabelForShipment(s.id))}
						>
							Lipdukas
						</button>
					</div>
				{/each}
				{#if registry.length === 0}
					<p class="px-5 py-4 text-sm text-slate-500">Pagal sekimo numerį siuntų nerasta.</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}

{#if selected.size > 0}
	<div
		class="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm"
	>
		<span class="text-sm font-medium text-sky-900">Pažymėta: {selected.size}</span>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
			onclick={() => void bulkLabels()}
			disabled={bulkBusy}
		>
			<Printer size={15} />
			{bulkBusy ? 'Generuojama…' : 'Generuoti lipdukus'}
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
		<Spinner label="Kraunamos siuntos…" />
	{:else if shipments.length === 0}
		<EmptyState title="Siuntų nerasta" hint="Pakeiskite filtrus." />
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-3 py-3">
							<input
								type="checkbox"
								class="h-4 w-4 rounded border-slate-300"
								checked={selected.size === shipments.length && shipments.length > 0}
								onchange={toggleSelectAll}
								aria-label="Pažymėti visas"
							/>
						</th>
						<th class="px-3 py-3 font-medium">Užsakymas</th>
						<th class="px-3 py-3 font-medium">Metodas</th>
						<th class="px-3 py-3 font-medium">Pristatymo būsena</th>
						<th class="px-3 py-3 font-medium">Vežėjas</th>
						<th class="px-3 py-3 font-medium">Sekimo nr.</th>
						<th class="px-3 py-3 font-medium">Lipdukas</th>
						<th class="px-3 py-3 text-right font-medium">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each shipments as s (s.order_id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-3 py-3">
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-slate-300"
									checked={selected.has(s.order_id)}
									onchange={() => toggleSelect(s.order_id)}
									aria-label={`Pažymėti ${s.order_id}`}
								/>
							</td>
							<td class="px-3 py-3">
								<a
									href={`/uzsakymai/${s.order_id}`}
									class="font-semibold text-sky-700 hover:underline">#{s.order_id}</a
								>
							</td>
							<td class="px-3 py-3 text-slate-700">
								<span class="inline-flex items-center gap-1.5">
									<Truck size={14} class="text-slate-400" />
									{shippingMethodLabel(s.shipping_method)}
								</span>
							</td>
							<td class="px-3 py-3"><StatusBadge kind="delivery" value={s.delivery_status} /></td>
							<td class="px-3 py-3 text-slate-700">{s.carrier_code || '—'}</td>
							<td class="px-3 py-3 font-mono text-xs text-slate-600">
								{s.tracking_number || '—'}
								{#if s.carrier_shipment_id}
									<div class="text-[10px] text-slate-400">{s.carrier_shipment_id}</div>
								{/if}
							</td>
							<td class="px-3 py-3 text-xs text-slate-500">
								{s.label_generated_at ? formatDateTime(s.label_generated_at) : 'Nesugeneruotas'}
							</td>
							<td class="px-3 py-3">
								<div class="flex justify-end gap-1.5">
									<button
										type="button"
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
										disabled={busyId !== null}
										onclick={() => void runFor(s.order_id, () => generateShipmentLabel(s.order_id))}
									>
										Lipdukas
									</button>
									<button
										type="button"
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
										disabled={busyId !== null}
										onclick={() => void runFor(s.order_id, () => markShipmentShipped(s.order_id))}
									>
										Išsiųsta
									</button>
									<button
										type="button"
										class="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
										title="Atnauinti sekimo informaciją"
										disabled={busyId !== null}
										onclick={() => void runFor(s.order_id, () => refreshShipmentTracking(s.order_id))}
									>
										<RefreshCw size={13} />
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
