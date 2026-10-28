<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckSquare, ChevronDown, Filter, PackageOpen, RotateCcw, Search, Tag } from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import CopyText from '#lib/components/CopyText.svelte';
	import { goto } from '$app/navigation';
	import {
		ApiError,
		createOrder,
		fetchOrderPickList,
		fetchOrders,
		fetchWarehouses,
		generateShipmentLabelsBulk,
		mergeOrders,
		ordersBulkAction,
		type OpsOrderListItem,
		type OpsPickListRow,
		type OpsWarehouse
	} from '#lib/api/client';
	import { formatDateTime, formatMoney } from '#lib/format';
	import { shippingMethodLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let orders = $state<OpsOrderListItem[]>([]);
	let total = $state(0);
	let page = $state(1);
	let selected = $state<Set<number>>(new Set());
	let expanded = $state<Set<number>>(new Set());
	let warehouses = $state<OpsWarehouse[]>([]);
	let viewMode = $state<'orders' | 'pick'>('orders');
	let pickWarehouse = $state('');
	let pickRows = $state<OpsPickListRow[]>([]);
	let pickLoading = $state(false);

	async function loadPickList() {
		if (!pickWarehouse) { pickRows = []; return; }
		pickLoading = true;
		try {
			const res = await fetchOrderPickList(pickWarehouse);
			pickRows = res.rows;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti sąrašo.');
		} finally {
			pickLoading = false;
		}
	}

	// Filtrų forma
	let q = $state('');
	let status = $state('');
	let paymentStatus = $state('');
	let shippingType = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let productQ = $state('');
	let supplierCode = $state('');
	let supplierStatus = $state('');
	let manufacturerQ = $state('');
	let remoteOnly = $state(false);
	let showAdvanced = $state(false);

	// Bulk veiksmo modalas
	let bulkModal = $state<'' | 'confirm' | 'move_to_picking' | 'labels' | 'merge'>('');
	let bulkNote = $state('');
	let bulkBusy = $state(false);

	// Naujo užsakymo modalas
	let createModal = $state(false);
	let createBusy = $state(false);
	let newEmail = $state('');
	let newName = $state('');
	let newPhone = $state('');
	let newMethod = $state('dpd_courier');
	let newLines = $state<{ variant_id: string; qty: number }[]>([{ variant_id: '', qty: 1 }]);

	async function submitCreateOrder() {
		if (createBusy) return;
		const lines = newLines
			.filter((l) => l.variant_id.trim() !== '')
			.map((l) => ({ variant_id: Number(l.variant_id), qty: Number(l.qty) || 1 }));
		if (!newEmail.trim() || lines.length === 0) {
			pushToast('error', 'Reikalingas el. paštas ir bent viena prekės eilutė.');
			return;
		}
		createBusy = true;
		try {
			const created = await createOrder({
				user_email: newEmail.trim(),
				shipping_full_name: newName.trim(),
				shipping_phone: newPhone.trim(),
				shipping_method: newMethod,
				lines
			});
			pushToast('success', `Užsakymas #${created.id} sukurtas.`);
			createModal = false;
			void goto(`/uzsakymai/${created.id}`);
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko sukurti užsakymo.');
		} finally {
			createBusy = false;
		}
	}

	async function runMerge() {
		if (bulkBusy || selected.size < 2) return;
		const ids = [...selected];
		const primary = ids[0];
		bulkBusy = true;
		try {
			const res = await mergeOrders(primary, ids.slice(1));
			pushToast('success', res.message || 'Užsakymai sujungti.');
			bulkModal = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Sujungti nepavyko.');
		} finally {
			bulkBusy = false;
		}
	}

	function currentParams(pageNum = page) {
		return {
			q: q.trim(),
			status,
			payment_status: paymentStatus,
			shipping_type: shippingType,
			date_from: dateFrom,
			date_to: dateTo,
			product_q: productQ.trim(),
			supplier_code: supplierCode.trim(),
			supplier_status: supplierStatus,
			manufacturer_q: manufacturerQ.trim(),
			remote_only: remoteOnly ? 'true' : '',
			page: pageNum,
			page_size: PAGE_SIZE
		};
	}

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchOrders(currentParams(pageNum));
			orders = res.results;
			total = res.total_count;
			page = res.page;
			selected = new Set();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti užsakymų.');
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		void load(1);
	}

	function resetFilters() {
		q = '';
		status = '';
		paymentStatus = '';
		shippingType = '';
		dateFrom = '';
		dateTo = '';
		productQ = '';
		supplierCode = '';
		supplierStatus = '';
		manufacturerQ = '';
		remoteOnly = false;
		void load(1);
	}

	function toggleSelect(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleExpanded(id: number) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id); else next.add(id);
		expanded = next;
	}

	function toggleSelectAll() {
		if (selected.size === orders.length) selected = new Set();
		else selected = new Set(orders.map((o) => o.id));
	}

	async function runBulkAction() {
		if (bulkBusy || selected.size === 0) return;
		bulkBusy = true;
		try {
			if (bulkModal === 'labels') {
				const job = await generateShipmentLabelsBulk([...selected]);
				const failed = (job.result_payload?.failed as unknown[] | undefined)?.length ?? 0;
				if (job.status === 'success') {
					pushToast('success', `Lipdukai sugeneruoti (${selected.size} užsakymams).`);
				} else {
					pushToast(
						'error',
						`Lipdukų generavimas baigtas su klaidomis${failed ? ` (${failed} nepavyko)` : ''}: ${job.error_message}`
					);
				}
			} else {
				const job = await ordersBulkAction({
					action: bulkModal,
					selected_ids: [...selected],
					note: bulkNote.trim()
				});
				const updated = (job.result_payload?.updated_ids as number[] | undefined)?.length ?? 0;
				const failed = (job.result_payload?.failed_ids as number[] | undefined)?.length ?? 0;
				if (failed === 0) {
					pushToast('success', `Veiksmas atliktas (${updated} užsakymai).`);
				} else {
					pushToast('error', `Atlikta: ${updated}, nepavyko: ${failed}.`);
				}
			}
			bulkModal = '';
			bulkNote = '';
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

<PageHeader
	title="Užsakymai"
	subtitle="Visi užsakymai su paieška, filtrais ir masiniais veiksmais"
>
	{#snippet actions()}
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
			onclick={() => (createModal = true)}
		>
			+ Naujas užsakymas
		</button>
	{/snippet}
</PageHeader>

<!-- Filtrai -->
<section class="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<div class="relative xl:col-span-2">
			<Search size={16} class="pointer-events-none absolute top-3 left-3 text-slate-400" />
			<input
				class={`${inputClass} w-full pl-9`}
				placeholder="Ieškoti: užsakymo nr., tracking nr., vardas, tel."
				bind:value={q}
				onkeydown={(e) => e.key === 'Enter' && applyFilters()}
			/>
		</div>
		<select class={selectClass} bind:value={status} aria-label="Užsakymo būsena">
			<option value="">Visos būsenos</option>
			<option value="pending_payment">Laukia apmokėjimo</option>
			<option value="paid">Apmokėtas</option>
			<option value="cancelled">Atšauktas</option>
		</select>
		<select class={selectClass} bind:value={paymentStatus} aria-label="Mokėjimo būsena">
			<option value="">Visi mokėjimai</option>
			<option value="pending">Laukiama</option>
			<option value="succeeded">Apmokėta</option>
			<option value="failed">Nepavyko</option>
			<option value="cancelled">Atšaukta</option>
		</select>
		<select class={selectClass} bind:value={shippingType} aria-label="Pristatymo tipas">
			<option value="">Bet koks pristatymas</option>
			<option value="courier">Kurjeris</option>
			<option value="pickup">Paštomatas / atsiėmimas</option>
		</select>
		<div class="flex items-center gap-2">
			<input
				type="date"
				class={`${inputClass} w-full`}
				bind:value={dateFrom}
				aria-label="Data nuo"
			/>
			<span class="text-sm text-slate-400">–</span>
			<input
				type="date"
				class={`${inputClass} w-full`}
				bind:value={dateTo}
				aria-label="Data iki"
			/>
		</div>
		<div class="flex items-center gap-2 xl:col-span-2">
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
				onclick={() => (showAdvanced = !showAdvanced)}
			>
				<Filter size={15} />
				{showAdvanced ? 'Slėpti išplėstus filtrus' : 'Paieška pagal prekę / tiekėją / gamintoją'}
			</button>
		</div>
	</div>

	{#if showAdvanced}
		<div class="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-3">
			<input
				class={inputClass}
				placeholder="Prekė: SKU, pavadinimas arba EAN (barkodas)"
				bind:value={productQ}
				onkeydown={(e) => e.key === 'Enter' && applyFilters()}
			/>
			<select class={inputClass} bind:value={supplierCode} onchange={applyFilters} aria-label="Sandėlis">
				<option value="">Visi sandėliai</option>
				{#each warehouses as wh (wh.id)}
					<option value={wh.code}>{wh.code}{wh.name ? ` — ${wh.name}` : ''}{wh.kind === 'remote' ? ' (nuotolinis)' : ''}</option>
				{/each}
			</select>
			<input
				class={inputClass}
				placeholder="Gamintojas (brand)"
				bind:value={manufacturerQ}
				onkeydown={(e) => e.key === 'Enter' && applyFilters()}
			/>
			<select class={inputClass} bind:value={supplierStatus} aria-label="Tiekėjo rezervacija">
				<option value="">Tiekėjo rezervacija: visos</option>
				<option value="pending">Laukiama tiekėjo</option>
				<option value="reserved">Rezervuota pas tiekėją</option>
				<option value="not_needed">Nereikalinga</option>
				<option value="failed">Nepavyko rezervuoti</option>
				<option value="cancelled">Atšaukta</option>
			</select>
		</div>
		<label class="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
			<input type="checkbox" class="h-4 w-4 rounded border-slate-300" bind:checked={remoteOnly} />
			Tik nuotoliniai sandėliai (dropship / mišrūs)
		</label>
	{/if}

	<div class="mt-4 flex items-center gap-2">
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
			onclick={applyFilters}
		>
			<Search size={15} />
			Ieškoti
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
			onclick={resetFilters}
		>
			<RotateCcw size={15} />
			Išvalyti
		</button>
	</div>
</section>

<!-- Masiniai veiksmai -->
{#if selected.size > 0}
	<div
		class="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm"
	>
		<span class="text-sm font-medium text-sky-900">Pažymėta: {selected.size}</span>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
			onclick={() => (bulkModal = 'confirm')}
		>
			<CheckSquare size={15} /> Patvirtinti
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
			onclick={() => (bulkModal = 'move_to_picking')}
		>
			<PackageOpen size={15} /> Į komplektavimą
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
			onclick={() => (bulkModal = 'labels')}
		>
			<Tag size={15} /> Generuoti lipdukus
		</button>
		{#if selected.size >= 2}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
				onclick={() => (bulkModal = 'merge')}
			>
				Sujungti
			</button>
		{/if}
		<button
			type="button"
			class="ml-auto text-sm text-slate-500 hover:text-slate-700"
			onclick={() => (selected = new Set())}
		>
			Atžymėti visus
		</button>
	</div>
{/if}

<!-- Lentelė -->
<div class="mt-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm shadow-sm">
	<button
		type="button"
		class={`rounded-md px-3 py-1.5 font-medium ${viewMode === 'orders' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
		onclick={() => (viewMode = 'orders')}
	>Užsakymai</button>
	<button
		type="button"
		class={`rounded-md px-3 py-1.5 font-medium ${viewMode === 'pick' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
		onclick={() => { viewMode = 'pick'; if (pickRows.length === 0 && pickWarehouse) void loadPickList(); }}
	>Pagal prekę (receiving)</button>
</div>

{#if viewMode === 'pick'}
	<section class="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
			<h2 class="text-base font-semibold text-slate-900">Receiving / pick sąrašas</h2>
			<select class={inputClass + ' w-64'} bind:value={pickWarehouse} onchange={() => void loadPickList()} aria-label="Sandėlis">
				<option value="">Pasirinkite sandėlį…</option>
				{#each warehouses as wh (wh.id)}
					<option value={wh.code}>{wh.code}{wh.name ? ` — ${wh.name}` : ''}{wh.kind === 'remote' ? ' (nuotolinis)' : ''}</option>
				{/each}
			</select>
		</div>
		{#if pickLoading}
			<Spinner label="Kraunamas sąrašas…" />
		{:else if !pickWarehouse}
			<EmptyState title="Pasirinkite sandėlį" hint="Pasirinkite sandėlį, iš kurio atvyko arba atvyks prekės." />
		{:else if pickRows.length === 0}
			<EmptyState title="Nėra laukiančių eilučių" hint="Šiam sandėliui atvirų apmokėtų užsakymų eilučių nerasta." />
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-3 font-medium">Prekė</th>
							<th class="px-4 py-3 font-medium">SKU</th>
							<th class="px-4 py-3 font-medium">EAN</th>
							<th class="px-4 py-3 font-medium text-right">Reikia vnt.</th>
							<th class="px-4 py-3 font-medium">Užsakymai</th>
						</tr>
					</thead>
					<tbody>
						{#each pickRows as row (row.variant_id ?? row.sku)}
							<tr class="border-t border-slate-100">
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										{#if row.thumbnail_url}
											<img src={row.thumbnail_url} alt="" class="h-9 w-9 rounded border border-slate-200 object-cover" loading="lazy" />
										{/if}
										<CopyText text={row.name || '—'} class="max-w-80" />
									</div>
								</td>
								<td class="px-4 py-3"><CopyText text={row.sku || '—'} mono /></td>
								<td class="px-4 py-3">{#if row.barcode}<CopyText text={row.barcode} mono />{:else}—{/if}</td>
								<td class="px-4 py-3 text-right text-base font-bold text-slate-900">{row.total_qty}</td>
								<td class="px-4 py-3">
									<div class="flex flex-wrap gap-1.5">
										{#each row.orders as o (o.order_id)}
											<a href={`/uzsakymai/${o.order_id}`} class="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
												#{o.order_id} ×{o.qty}
											</a>
										{/each}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
{/if}

{#if viewMode === 'orders'}
<section class="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunami užsakymai…" />
	{:else if orders.length === 0}
		<EmptyState
			title="Užsakymų nerasta"
			hint="Pakeiskite filtrus arba paieškos tekstą."
		/>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-3 py-3">
							<input
								type="checkbox"
								class="h-4 w-4 rounded border-slate-300"
								checked={selected.size === orders.length && orders.length > 0}
								onchange={toggleSelectAll}
								aria-label="Pažymėti visus"
							/>
						</th>
						<th class="px-3 py-3 font-medium">Užsakymas</th>
						<th class="px-3 py-3 font-medium">Klientas</th>
						<th class="px-3 py-3 font-medium">Būsena</th>
						<th class="px-3 py-3 font-medium">Mokėjimas</th>
						<th class="px-3 py-3 font-medium">Pristatymas</th>
						<th class="px-3 py-3 font-medium">Suma</th>
						<th class="px-3 py-3 font-medium">Sukurta</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as order (order.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-3 py-3">
								<div class="flex items-center gap-1">
									<input
										type="checkbox"
										class="h-4 w-4 rounded border-slate-300"
										checked={selected.has(order.id)}
										onchange={() => toggleSelect(order.id)}
										aria-label={`Pažymėti užsakymą ${order.id}`}
									/>
									<button
										type="button"
										class={`rounded p-0.5 text-slate-400 transition-transform hover:text-slate-700 ${expanded.has(order.id) ? 'rotate-180' : ''}`}
										title="Išskleisti"
										onclick={() => toggleExpanded(order.id)}
									>
										<ChevronDown size={14} />
									</button>
								</div>
							</td>
							<td class="px-3 py-3">
								<span class="inline-flex items-center">
									<a
										href={`/uzsakymai/${order.id}`}
										class="font-semibold text-sky-700 hover:underline">#{order.id}</a
									>
									<CopyText text={String(order.id)} iconOnly />
								</span>
								<div class="text-xs text-slate-400">{order.shop.name || order.shop.code || '—'}</div>
							</td>
							<td class="px-3 py-3">
								<div class="font-medium text-slate-800">{order.customer.full_name || '—'}</div>
								<div class="text-xs text-slate-400">{order.customer.email}</div>
							</td>
							<td class="px-3 py-3"><StatusBadge kind="order" value={order.status} /></td>
							<td class="px-3 py-3"><StatusBadge kind="payment" value={order.payment_status} /></td>
							<td class="px-3 py-3">
								<div>{shippingMethodLabel(order.shipping_method)}</div>
								<div class="mt-1"><StatusBadge kind="delivery" value={order.delivery_status} /></div>
							</td>
							<td class="px-3 py-3 font-semibold text-slate-900">
								{formatMoney(order.amount_gross, order.amount_currency)}
							</td>
							<td class="px-3 py-3 text-slate-500">{formatDateTime(order.created_at)}</td>
						</tr>
						{#if expanded.has(order.id)}
							<tr class="border-t border-slate-100 bg-slate-50/60">
								<td colspan="8" class="px-4 py-3">
									<div class="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr]">
										<div class="text-xs leading-6 text-slate-600">
											<div class="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Klientas</div>
											<div class="font-medium text-slate-800">{order.customer.full_name || '—'}</div>
											{#if order.customer.email}
												<div><CopyText text={order.customer.email} /></div>
											{/if}
											{#if order.customer.phone}
												<div><CopyText text={order.customer.phone} mono /></div>
											{/if}
											<div class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 font-semibold text-slate-800 ring-1 ring-slate-200">
												Iš viso: {order.matched_lines.reduce((a, l) => a + (l.qty || 0), 0) || order.matched_items_count} vnt.
											</div>
										</div>
										<div class="overflow-x-auto">
											<table class="min-w-full text-left text-xs">
												<thead class="text-[11px] tracking-wide text-slate-400 uppercase">
													<tr>
														<th class="pr-3 pb-1 font-medium">Prekė</th>
														<th class="pr-3 pb-1 font-medium">SKU</th>
														<th class="pr-3 pb-1 font-medium">EAN</th>
														<th class="pr-3 pb-1 font-medium">Kiekis</th>
														<th class="pb-1 font-medium">Sandėlis</th>
													</tr>
												</thead>
												<tbody>
													{#each order.matched_lines as line (line.order_line_id)}
														<tr class="border-t border-slate-200/70">
															<td class="py-1.5 pr-3">
																<div class="flex items-center gap-2">
																	{#if line.thumbnail_url}
																		<img src={line.thumbnail_url} alt="" class="h-8 w-8 rounded border border-slate-200 object-cover" loading="lazy" />
																	{/if}
																	<CopyText text={line.name} class="max-w-72" />
																</div>
															</td>
															<td class="py-1.5 pr-3"><CopyText text={line.sku || line.variant_sku || '—'} mono /></td>
															<td class="py-1.5 pr-3">{#if line.barcode}<CopyText text={line.barcode} mono />{:else}—{/if}</td>
															<td class="py-1.5 pr-3 font-semibold">{line.qty}</td>
															<td class="py-1.5">{line.warehouse_name || line.warehouse_code || '—'}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		<div class="border-t border-slate-200 px-4 py-3">
			<Pagination {page} pageSize={PAGE_SIZE} {total} onchange={(p) => void load(p)} />
		</div>
	{/if}
</section>
{/if}

<!-- Bulk modalas -->
<Modal
	bind:open={
		() => bulkModal !== '',
		(v) => {
			if (!v) bulkModal = '';
		}
	}
	title={bulkModal === 'labels'
		? 'Generuoti siuntų lipdukus'
		: bulkModal === 'merge'
			? 'Sujungti užsakymus'
			: bulkModal === 'confirm'
				? 'Patvirtinti užsakymus'
				: 'Perkelti į komplektavimą'}
	subtitle={`Veiksmas bus pritaikytas ${selected.size} užsakymams.`}
>
	{#if bulkModal === 'merge'}
		<p class="text-sm text-slate-600">
			Užsakymai {[...selected].slice(1).map((i) => `#${i}`).join(', ')} bus sulieti į
			pagrindinį užsakymą <strong>#{[...selected][0]}</strong>. Jų eilutės, siuntos ir
			įvykiai bus perkelti; sujungti užsakymai bus atšaukti.
		</p>
	{:else if bulkModal !== 'labels'}
		<label class="block text-sm font-medium text-slate-700" for="bulk-note">
			Pastaba (neprivaloma)
		</label>
		<textarea
			id="bulk-note"
			class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
			rows="3"
			placeholder="Pvz.: nuotolinis sandėlis patvirtino rezervaciją"
			bind:value={bulkNote}
		></textarea>
	{:else}
		<p class="text-sm text-slate-600">
			Lipdukai bus generuojami pagal kiekvieno užsakymo pristatymo metodą (DPD / Unisend /
			LP Express). Nepalaikomi metodai bus praleisti ir parodyti rezultate.
		</p>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (bulkModal = '')}
			disabled={bulkBusy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void (bulkModal === 'merge' ? runMerge() : runBulkAction())}
			disabled={bulkBusy}
		>
			{bulkBusy ? 'Vykdoma…' : 'Vykdyti'}
		</button>
	{/snippet}
</Modal>

<!-- Naujas užsakymas -->
<Modal
	bind:open={
		() => createModal,
		(v) => {
			if (!v) createModal = false;
		}
	}
	title="Naujas užsakymas"
	subtitle="Telefoninis / rankinis užsakymas — kainos iš kainoraščio"
>
	<label class="block text-sm font-medium text-slate-700" for="no-email">Kliento el. paštas</label>
	<input id="no-email" class={`${inputClass} mt-1 w-full`} bind:value={newEmail} />
	<div class="mt-3 grid grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-slate-700" for="no-name">Vardas</label>
			<input id="no-name" class={`${inputClass} mt-1 w-full`} bind:value={newName} />
		</div>
		<div>
			<label class="block text-sm font-medium text-slate-700" for="no-phone">Telefonas</label>
			<input id="no-phone" class={`${inputClass} mt-1 w-full`} bind:value={newPhone} />
		</div>
	</div>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="no-method">Pristatymo būdas</label>
	<select id="no-method" class={`${inputClass} mt-1 w-full`} bind:value={newMethod}>
		<option value="dpd_locker">DPD paštomatas</option>
		<option value="dpd_courier">DPD kurjeris</option>
		<option value="unisend_pickup">Unisend paštomatas</option>
		<option value="unisend_courier">Unisend kurjeris</option>
	</select>
	<p class="mt-3 text-sm font-medium text-slate-700">Prekės (varianto ID · kiekis)</p>
	{#each newLines as line, i}
		<div class="mt-2 flex gap-2">
			<input
				class={`${inputClass} w-full`}
				placeholder="Varianto ID"
				bind:value={line.variant_id}
			/>
			<input
				class={`${inputClass} w-20`}
				type="number"
				min="1"
				bind:value={line.qty}
			/>
		</div>
	{/each}
	<button
		type="button"
		class="mt-2 text-xs font-medium text-sky-600 hover:underline"
		onclick={() => (newLines = [...newLines, { variant_id: '', qty: 1 }])}
	>
		+ Pridėti eilutę
	</button>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (createModal = false)}
			disabled={createBusy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitCreateOrder()}
			disabled={createBusy}
		>
			{createBusy ? 'Kuriama…' : 'Sukurti'}
		</button>
	{/snippet}
</Modal>
