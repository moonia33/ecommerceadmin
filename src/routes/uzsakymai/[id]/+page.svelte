<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		CheckSquare,
		ExternalLink,
		MapPin,
		PackageOpen,
		Printer,
		RefreshCw,
		Truck,
		UserCheck
	} from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		createShipment,
		createSurcharge,
		fetchLockers,
		fetchOrderDetail,
		generateLabelForShipment,
		generateShipmentLabel,
		markShipmentShipped,
		mediaUrl,
		orderAction,
		paymentAction,
		refreshShipmentTracking,
		updateOrderShipping,
		updateShipment,
		type OpsLockerOption,
		type OpsOrderDetail,
		type OpsShipmentRow
	} from '#lib/api/client';
	import { formatDate, formatDateTime, formatMoney } from '#lib/format';
	import { eventKindLabel, eventNameLabel, shippingMethodLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const orderId = $derived(page.params.id ?? '');

	let loading = $state(true);
	let order = $state<OpsOrderDetail | null>(null);
	let busy = $state(false);

	type ActionKind =
		| 'confirm'
		| 'assign'
		| 'move-to-picking'
		| 'mark-paid'
		| 'refund'
		| 'reconcile';

	let actionKind = $state<ActionKind | ''>('');
	let actionPaymentId = $state<number | null>(null);
	let note = $state('');
	let assignee = $state('');

	// --- Shipments / carrier / surcharge ---
	let shippingModalOpen = $state(false);
	let shippingMethod = $state('');
	let shippingLockerId = $state<number | null>(null);
	let lockers = $state<OpsLockerOption[]>([]);
	let lockerCountry = $state('');
	let lockerQuery = $state('');

	let shipmentModal = $state<'create' | 'edit' | ''>('');
	let editingShipment = $state<OpsShipmentRow | null>(null);
	let shKind = $state<'outbound' | 'return'>('outbound');
	let shMethod = $state('');
	let shTracking = $state('');
	let shLockerId = $state<number | null>(null);
	let shNotes = $state('');
	let shStatus = $state('');

	let surchargeOpen = $state(false);
	let surchargeAmount = $state('');
	let surchargeReason = $state('');
	let surchargeMethod = $state<'montonio' | 'bank_transfer'>('montonio');
	let surchargeSendEmail = $state(true);

	const SHIPPING_METHODS = [
		{ code: 'dpd_locker', label: 'DPD paštomatas' },
		{ code: 'dpd_courier', label: 'DPD kurjeris' },
		{ code: 'unisend_pickup', label: 'Unisend paštomatas' },
		{ code: 'unisend_courier', label: 'Unisend kurjeris' }
	];
	const SHIPMENT_STATUSES = [
		'pending', 'packed', 'picked_up', 'in_transit', 'at_pickup_point',
		'delivered', 'returning', 'returned', 'cancelled', 'error'
	];

	async function loadLockers() {
		try {
			lockers = await fetchLockers({
				country_code: lockerCountry || order?.shipping_country_code || 'LT',
				q: lockerQuery
			});
		} catch {
			lockers = [];
		}
	}

	function openShippingModal() {
		if (!order) return;
		shippingMethod = order.shipping_method;
		shippingLockerId = (order.pickup_point?.raw?.id as number | undefined) ?? null;
		lockerCountry = order.shipping_country_code || 'LT';
		shippingModalOpen = true;
		void loadLockers();
	}

	async function submitShippingChange() {
		if (!order || busy) return;
		busy = true;
		try {
			const res = await updateOrderShipping(order.id, {
				shipping_method: shippingMethod,
				pickup_locker_id: shippingLockerId
			});
			const delta = Number(res.price_delta_gross);
			if (delta > 0) {
				pushToast(
					'success',
					`Pristatymas pakeistas. Kainos skirtumas +${res.price_delta_gross} ${order.totals.currency} — galima sukurti priemoką.`
				);
				surchargeAmount = res.price_delta_gross;
				surchargeReason = 'Pakeistas pristatymo būdas';
			} else {
				pushToast('success', 'Pristatymas pakeistas.');
			}
			shippingModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko pakeisti pristatymo.');
		} finally {
			busy = false;
		}
	}

	function openShipmentCreate() {
		editingShipment = null;
		shKind = 'outbound';
		shMethod = order?.shipping_method ?? '';
		shTracking = '';
		shLockerId = null;
		shNotes = '';
		shStatus = 'pending';
		shipmentModal = 'create';
		void loadLockers();
	}

	function openShipmentEdit(s: OpsShipmentRow) {
		editingShipment = s;
		shKind = s.kind;
		shMethod = s.shipping_method;
		shTracking = s.tracking_number;
		shLockerId = s.pickup_locker_id;
		shNotes = s.notes;
		shStatus = s.status;
		shipmentModal = 'edit';
		void loadLockers();
	}

	async function submitShipment() {
		if (!order || busy) return;
		busy = true;
		try {
			if (shipmentModal === 'create') {
				await createShipment(order.id, {
					kind: shKind,
					shipping_method: shMethod,
					tracking_number: shTracking,
					pickup_locker_id: shLockerId,
					notes: shNotes
				});
			} else if (editingShipment) {
				await updateShipment(editingShipment.id, {
					kind: shKind,
					status: shStatus,
					shipping_method: shMethod,
					tracking_number: shTracking,
					pickup_locker_id: shLockerId,
					notes: shNotes
				});
			}
			pushToast('success', 'Siunta išsaugota.');
			shipmentModal = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Siuntos išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function submitSurcharge() {
		if (!order || busy) return;
		busy = true;
		try {
			await createSurcharge(order.id, {
				amount_gross: surchargeAmount,
				reason: surchargeReason,
				method: surchargeMethod,
				send_email: surchargeSendEmail
			});
			pushToast('success', 'Priemoka sukurta.');
			surchargeOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Priemokos sukurti nepavyko.');
		} finally {
			busy = false;
		}
	}

	const actionTitle: Record<ActionKind, string> = {
		confirm: 'Patvirtinti užsakymą',
		assign: 'Priskirti vadybininką',
		'move-to-picking': 'Perkelti į komplektavimą',
		'mark-paid': 'Pažymėti mokėjimą apmokėtu',
		refund: 'Inicijuoti pinigų grąžinimą',
		reconcile: 'Suderinti mokėjimą'
	};

	async function load() {
		loading = true;
		try {
			order = await fetchOrderDetail(orderId);
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti užsakymo.');
		} finally {
			loading = false;
		}
	}

	function openAction(kind: ActionKind, paymentId: number | null = null) {
		actionKind = kind;
		actionPaymentId = paymentId;
		note = '';
		assignee = '';
	}

	async function runAction() {
		if (!order || !actionKind || busy) return;
		busy = true;
		try {
			if (actionKind === 'mark-paid' || actionKind === 'refund' || actionKind === 'reconcile') {
				await paymentAction(actionPaymentId!, actionKind, { note: note.trim() });
			} else {
				await orderAction(order.id, actionKind, {
					note: note.trim(),
					assignee: assignee.trim()
				});
			}
			pushToast('success', 'Veiksmas atliktas.');
			actionKind = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function runSimple(fn: () => Promise<{ message?: string }>, fallback: string) {
		if (busy) return;
		busy = true;
		try {
			const res = await fn();
			pushToast('success', res.message || fallback);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load());

	const inputClass =
		'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<div class="mb-4">
	<a
		href="/uzsakymai"
		class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
	>
		<ArrowLeft size={15} />
		Atgal į užsakymus
	</a>
</div>

{#if loading}
	<Spinner label="Kraunamas užsakymas…" />
{:else if !order}
	<EmptyState title="Užsakymas nerastas" hint="Patikrinkite užsakymo numerį." />
{:else}
	<!-- Antraštė -->
	<div
		class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
	>
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-2xl font-semibold text-slate-900">Užsakymas #{order.id}</h1>
					<StatusBadge kind="order" value={order.status} />
					<StatusBadge kind="payment" value={order.payment_status} />
					<StatusBadge kind="delivery" value={order.delivery_status} />
				</div>
				<p class="mt-1.5 text-sm text-slate-500">
					Sukurtas {formatDateTime(order.created_at)} · Parduotuvė: {order.shop.name ||
						order.shop.code ||
						'—'}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<StatusBadge kind="fulfillment" value={order.fulfillment_mode} />
					<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-300 ring-inset">
						Tiekėjo rezervacija: {order.supplier_reservation_status || '—'}
					</span>
					{#if order.supplier_reference}
						<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-300 ring-inset">
							Tiekėjo ref.: {order.supplier_reference}
						</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('confirm')}
					disabled={busy}
				>
					<CheckSquare size={15} /> Patvirtinti
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('assign')}
					disabled={busy}
				>
					<UserCheck size={15} /> Priskirti
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('move-to-picking')}
					disabled={busy}
				>
					<PackageOpen size={15} /> Į komplektavimą
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					onclick={() => void runSimple(() => generateShipmentLabel(order!.id), 'Lipdukas sugeneruotas')}
					disabled={busy}
				>
					<Printer size={15} /> Generuoti lipduką
				</button>
			</div>
		</div>
	</div>

	<div class="mt-5 grid gap-5 xl:grid-cols-3">
		<!-- Klientas -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Klientas</h2>
			<p class="mt-3 text-lg font-semibold text-slate-900">
				{order.customer.full_name || '—'}
			</p>
			<div class="mt-2 space-y-1 text-sm text-slate-600">
				<p>{order.customer.email || '—'}</p>
				<p>{order.customer.phone || order.shipping_address.phone || '—'}</p>
				{#if order.customer.company}
					<p>Įmonė: {order.customer.company}</p>
				{/if}
			</div>
			{#if order.customer.user_id}
				<a
					href={`/klientai/${order.customer.user_id}`}
					class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
				>
					Kliento kortelė <ExternalLink size={13} />
				</a>
			{:else}
				<p class="mt-3 text-xs text-slate-400">Svečio užsakymas</p>
			{/if}
			{#if order.customer_stats}
				<div class="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
					<div>
						<p class="text-lg font-semibold text-slate-900">{order.customer_stats.orders_count}</p>
						<p class="text-xs text-slate-400">Užsakymai</p>
					</div>
					<div>
						<p class="text-lg font-semibold text-slate-900">{order.customer_stats.paid_orders_count}</p>
						<p class="text-xs text-slate-400">Apmokėti</p>
					</div>
					<div>
						<p class="text-lg font-semibold text-slate-900">
							{formatMoney(order.customer_stats.total_spent)}
						</p>
						<p class="text-xs text-slate-400">Iš viso</p>
					</div>
				</div>
			{/if}
		</section>

		<!-- Pristatymas -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Pristatymas</h2>
			<p class="mt-3 flex items-center gap-2 text-sm font-medium text-slate-900">
				<Truck size={15} class="text-slate-400" />
				{shippingMethodLabel(order.shipping_method)}
				{#if order.carrier_code}
					<span class="text-slate-400">({order.carrier_code})</span>
				{/if}
			</p>

			{#if order.pickup_point}
				<div class="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
					<p class="flex items-center gap-1.5 font-medium text-slate-800">
						<MapPin size={14} class="text-sky-600" /> Atsiėmimo taškas
					</p>
					<p class="mt-1 text-slate-700">{order.pickup_point.pickup_point_name || '—'}</p>
					<p class="text-xs text-slate-500">ID: {order.pickup_point.pickup_point_id || '—'}</p>
				</div>
			{/if}

			<div class="mt-3 space-y-1 text-sm text-slate-600">
				<p class="font-medium text-slate-800">{order.shipping_address.full_name || '—'}</p>
				{#if order.shipping_address.company}<p>{order.shipping_address.company}</p>{/if}
				<p>{order.shipping_address.line1 || '—'}</p>
				<p>
					{order.shipping_address.city || '—'}
					{order.shipping_address.postal_code || ''}, {order.shipping_address.country_code ||
						order.shipping_country_code}
				</p>
				{#if order.shipping_address.phone}<p>Tel.: {order.shipping_address.phone}</p>{/if}
			</div>

			<div class="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
				{#if order.tracking_number}
					<p class="text-slate-600">
						Sekimo nr.: <span class="font-semibold text-slate-900">{order.tracking_number}</span>
					</p>
				{/if}
				{#if order.delivery_min_date || order.delivery_max_date}
					<p class="text-slate-600">
						Numatoma: {formatDate(order.delivery_min_date)} – {formatDate(order.delivery_max_date)}
					</p>
				{/if}
				{#if order.label_pdf_url}
					<a
						href={mediaUrl(order.label_pdf_url)}
						target="_blank"
						rel="noreferrer noopener"
						class="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline"
					>
						<Printer size={14} /> Atsisiųsti lipduką (PDF)
					</a>
				{/if}
			</div>

			<div class="mt-4 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => void runSimple(() => markShipmentShipped(order!.id), 'Pažymėta išsiųsta')}
					disabled={busy}
				>
					Pažymėti išsiųsta
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => void runSimple(() => refreshShipmentTracking(order!.id), 'Sekimo informacija atnaujinta')}
					disabled={busy}
				>
					<RefreshCw size={12} /> Atnauinti sekimą
				</button>
				<button
					type="button"
					class="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
					onclick={openShippingModal}
					disabled={busy}
				>
					Keisti vežėją / paštomatą
				</button>
				<button
					type="button"
					class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
					onclick={() => {
						surchargeOpen = true;
					}}
					disabled={busy}
				>
					Priemoka
				</button>
			</div>
		</section>

		<!-- Sumos -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Sumos</h2>
			<dl class="mt-3 space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-slate-500">Prekės (be PVM)</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.items_net, order.totals.currency)}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-500">Pristatymas (be PVM)</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.shipping_net, order.totals.currency)}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-500">PVM</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.total_vat, order.totals.currency)}
					</dd>
				</div>
				<div
					class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"
				>
					<dt>Iš viso</dt>
					<dd>{formatMoney(order.totals.total_gross, order.totals.currency)}</dd>
				</div>
			</dl>
			{#if order.supplier_notes}
				<div class="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
					<p class="font-medium">Tiekėjo pastabos</p>
					<p class="mt-1">{order.supplier_notes}</p>
				</div>
			{/if}
		</section>
	</div>

	<!-- Siuntos -->
	<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
			<h2 class="text-base font-semibold text-slate-900">
				Siuntos <span class="text-slate-400">({order.shipments?.length ?? 0})</span>
			</h2>
			<button
				type="button"
				class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
				onclick={openShipmentCreate}
				disabled={busy}
			>
				+ Pridėti siuntą
			</button>
		</div>
		{#if !order.shipments || order.shipments.length === 0}
			<EmptyState title="Siuntų nėra" hint="Lipduko generavimas sukurs siuntą automatiškai." />
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-5 py-2.5 font-medium">#</th>
							<th class="px-4 py-2.5 font-medium">Tipas</th>
							<th class="px-4 py-2.5 font-medium">Būsena</th>
							<th class="px-4 py-2.5 font-medium">Vežėjas / būdas</th>
							<th class="px-4 py-2.5 font-medium">Sekimo nr.</th>
							<th class="px-4 py-2.5 font-medium">Paštomatas</th>
							<th class="px-5 py-2.5 text-right font-medium">Veiksmai</th>
						</tr>
					</thead>
					<tbody>
						{#each order.shipments as s}
							<tr class="border-t border-slate-100">
								<td class="px-5 py-3 font-medium text-slate-800">S{s.id}</td>
								<td class="px-4 py-3">
									<span
										class={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
											s.kind === 'return'
												? 'bg-amber-50 text-amber-700 ring-amber-200'
												: 'bg-slate-50 text-slate-600 ring-slate-200'
										}`}
									>
										{s.kind === 'return' ? 'Grąžinimas' : 'Siuntimas'}
									</span>
								</td>
								<td class="px-4 py-3"><StatusBadge kind="delivery" value={s.status} /></td>
								<td class="px-4 py-3 text-slate-600">
									{s.carrier_code || '—'} / {shippingMethodLabel(s.shipping_method)}
								</td>
								<td class="px-4 py-3 font-mono text-xs text-slate-700">{s.tracking_number || '—'}</td>
								<td class="px-4 py-3 text-xs text-slate-600">{s.pickup_point_name || '—'}</td>
								<td class="px-5 py-3">
									<div class="flex justify-end gap-2">
										{#if s.label_url}
											<a
												href={s.label_url}
												target="_blank"
												rel="noreferrer noopener"
												class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
											>
												PDF
											</a>
										{/if}
										<button
											type="button"
											class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
											onclick={() =>
												void runSimple(
													() => generateLabelForShipment(s.id),
													'Lipdukas sugeneruotas'
												)}
											disabled={busy || s.kind === 'return'}
										>
											Lipdukas
										</button>
										<button
											type="button"
											class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
											onclick={() => openShipmentEdit(s)}
											disabled={busy}
										>
											Redaguoti
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Priemokos -->
	{#if order.surcharges && order.surcharges.length > 0}
		<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Priemokos</h2>
			</div>
			<div class="divide-y divide-slate-100">
				{#each order.surcharges as s}
					<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
						<div>
							<span class="font-medium text-slate-900">
								{formatMoney(s.amount_gross, s.currency)}
							</span>
							<span class="ml-2 text-sm text-slate-500">
								{s.method === 'montonio' ? 'Montonio nuoroda' : 'Bankinis pavedimas'}
							</span>
							{#if s.reason}<p class="text-xs text-slate-400">{s.reason}</p>{/if}
						</div>
						<div class="flex items-center gap-3">
							<StatusBadge kind="payment" value={s.status} />
							{#if s.payment_url}
								<a
									href={s.payment_url}
									target="_blank"
									rel="noreferrer noopener"
									class="text-xs font-medium text-sky-600 hover:underline"
								>
									Mokėjimo nuoroda
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Prekės -->
	<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-3">
			<h2 class="text-base font-semibold text-slate-900">
				Prekės <span class="text-slate-400">({order.matched_lines.length})</span>
			</h2>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-5 py-2.5 font-medium">Prekė</th>
						<th class="px-4 py-2.5 font-medium">SKU</th>
						<th class="px-4 py-2.5 font-medium">Gamintojas</th>
						<th class="px-4 py-2.5 font-medium">Sandėlis</th>
						<th class="px-4 py-2.5 text-right font-medium">Kiekis</th>
						<th class="px-4 py-2.5 text-right font-medium">Vnt. kaina</th>
						<th class="px-5 py-2.5 text-right font-medium">Suma</th>
					</tr>
				</thead>
				<tbody>
					{#each order.matched_lines as line}
						<tr class="border-t border-slate-100">
							<td class="px-5 py-3">
								<div class="flex items-center gap-3">
									{#if line.thumbnail_url}
										<img
											src={mediaUrl(line.thumbnail_url)}
											alt={line.product_name || line.name}
											class="h-10 w-10 rounded-lg border border-slate-200 object-cover"
										/>
									{/if}
									<span class="font-medium text-slate-800">{line.product_name || line.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 font-mono text-xs text-slate-600">{line.sku || '—'}</td>
							<td class="px-4 py-3 text-slate-600">{line.brand_name || '—'}</td>
							<td class="px-4 py-3">
								<div class="text-slate-800">{line.warehouse_code || '—'}</div>
								<div class="text-xs text-slate-400">{line.warehouse_name}</div>
							</td>
							<td class="px-4 py-3 text-right text-slate-800">{line.qty}</td>
							<td class="px-4 py-3 text-right text-slate-600">
								{formatMoney(line.unit_gross, order.amount_currency)}
							</td>
							<td class="px-5 py-3 text-right font-semibold text-slate-900">
								{formatMoney(line.line_total_gross, order.amount_currency)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="mt-5 grid gap-5 xl:grid-cols-2">
		<!-- Mokėjimai -->
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Mokėjimai</h2>
			</div>
			{#if order.payments.length === 0}
				<EmptyState title="Mokėjimų nėra" />
			{:else}
				<div class="divide-y divide-slate-100">
					{#each order.payments as payment}
						<div class="px-5 py-3.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<span class="font-medium text-slate-900">#{payment.id}</span>
									<span class="ml-2 text-sm text-slate-500">{payment.provider}</span>
								</div>
								<StatusBadge kind="payment" value={payment.status} />
							</div>
							<p class="mt-1 text-sm text-slate-600">
								{formatMoney(payment.amount_gross, payment.currency)} ·
								{formatDateTime(payment.created_at)}
								{#if payment.external_id}
									· <span class="text-xs text-slate-400">ext: {payment.external_id}</span>
								{/if}
							</p>
							<div class="mt-2 flex flex-wrap gap-2">
								<button
									type="button"
									class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
									onclick={() => openAction('mark-paid', payment.id)}
									disabled={busy || payment.status === 'succeeded'}
								>
									Pažymėti apmokėtu
								</button>
								<button
									type="button"
									class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
									onclick={() => openAction('reconcile', payment.id)}
									disabled={busy}
								>
									Suderinti
								</button>
								<button
									type="button"
									class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
									onclick={() => openAction('refund', payment.id)}
									disabled={busy || payment.status === 'cancelled'}
								>
									Grąžinti
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Įvykiai -->
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Įvykių istorija</h2>
			</div>
			{#if order.events.length === 0}
				<EmptyState title="Įvykių dar nėra" />
			{:else}
				<ul class="max-h-96 divide-y divide-slate-100 overflow-y-auto">
					{#each order.events as event}
						<li class="px-5 py-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm font-medium text-slate-800">
									{eventNameLabel(event.name)}
								</span>
								<StatusBadge kind="eventKind" value={event.kind} />
							</div>
							<p class="mt-0.5 text-xs text-slate-400">
								{formatDateTime(event.created_at)}
								{#if event.actor_label}· {event.actor_label}{/if}
							</p>
							{#if event.payload && Object.keys(event.payload).length > 0}
								<p class="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs break-all text-slate-500">
									{JSON.stringify(event.payload)}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}

<!-- Veiksmo modalas -->
<Modal
	bind:open={
		() => actionKind !== '',
		(v) => {
			if (!v) actionKind = '';
		}
	}
	title={actionKind ? actionTitle[actionKind] : ''}
	subtitle={actionKind === 'mark-paid' || actionKind === 'refund' || actionKind === 'reconcile'
		? `Mokėjimas #${actionPaymentId ?? ''}`
		: `Užsakymas #${order?.id ?? ''}`}
>
	{#if actionKind === 'assign'}
		<label class="block text-sm font-medium text-slate-700" for="assignee">Vadybininkas</label>
		<input
			id="assignee"
			class={`${inputClass} mt-1`}
			placeholder="Pvz.: Vardas arba operatoriaus kodas"
			bind:value={assignee}
		/>
	{/if}
	{#if actionKind === 'refund'}
		<p class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
			Grąžinimas atšauks mokėjimą ir užsakymą bei atleis rezervuotas prekės.
		</p>
	{/if}
	<label class="block text-sm font-medium text-slate-700" for="action-note">Pastaba</label>
	<textarea
		id="action-note"
		class={`${inputClass} mt-1`}
		rows="3"
		placeholder="Trumpa pastaba (bus matoma įvykių istorijoje)"
		bind:value={note}
	></textarea>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (actionKind = '')}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void runAction()}
			disabled={busy}
		>
			{busy ? 'Vykdoma…' : 'Vykdyti'}
		</button>
	{/snippet}
</Modal>

<!-- Pristatymo keitimas -->
<Modal
	bind:open={
		() => shippingModalOpen,
		(v) => {
			if (!v) shippingModalOpen = false;
		}
	}
	title="Keisti vežėją / paštomatą"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<label class="block text-sm font-medium text-slate-700" for="ship-method">Pristatymo būdas</label>
	<select id="ship-method" class={`${inputClass} mt-1`} bind:value={shippingMethod}>
		{#each SHIPPING_METHODS as m}
			<option value={m.code}>{m.label}</option>
		{/each}
	</select>

	{#if shippingMethod === 'dpd_locker' || shippingMethod === 'unisend_pickup'}
		<div class="mt-3 flex gap-2">
			<select
				class={`${inputClass} w-24`}
				bind:value={lockerCountry}
				onchange={() => void loadLockers()}
			>
				<option value="LT">LT</option>
				<option value="LV">LV</option>
				<option value="EE">EE</option>
			</select>
			<input
				class={inputClass}
				placeholder="Ieškoti paštomato…"
				bind:value={lockerQuery}
				oninput={() => void loadLockers()}
			/>
		</div>
		<select class={`${inputClass} mt-2`} bind:value={shippingLockerId}>
			<option value={null}>— Pasirinkite paštomatą —</option>
			{#each lockers as l}
				<option value={l.id}>{l.name} — {l.city}, {l.address}</option>
			{/each}
		</select>
	{/if}
	<p class="mt-3 text-xs text-slate-400">
		Jei naujas būdas brangesnis — kainos skirtumas bus parodytas ir galėsite sukurti priemoką.
	</p>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (shippingModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitShippingChange()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>

<!-- Siuntos kūrimas / redagavimas -->
<Modal
	bind:open={
		() => shipmentModal !== '',
		(v) => {
			if (!v) shipmentModal = '';
		}
	}
	title={shipmentModal === 'edit' ? `Siunta S${editingShipment?.id ?? ''}` : 'Nauja siunta'}
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-slate-700" for="sh-kind">Tipas</label>
			<select id="sh-kind" class={`${inputClass} mt-1`} bind:value={shKind}>
				<option value="outbound">Siuntimas klientui</option>
				<option value="return">Grąžinimas siuntėjui</option>
			</select>
		</div>
		{#if shipmentModal === 'edit'}
			<div>
				<label class="block text-sm font-medium text-slate-700" for="sh-status">Būsena</label>
				<select id="sh-status" class={`${inputClass} mt-1`} bind:value={shStatus}>
					{#each SHIPMENT_STATUSES as s}
						<option value={s}>{s}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-method">Pristatymo būdas</label>
	<select id="sh-method" class={`${inputClass} mt-1`} bind:value={shMethod}>
		{#each SHIPPING_METHODS as m}
			<option value={m.code}>{m.label}</option>
		{/each}
	</select>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-tracking">
		Sekimo numeris
	</label>
	<input id="sh-tracking" class={`${inputClass} mt-1`} bind:value={shTracking} />
	{#if shMethod === 'dpd_locker' || shMethod === 'unisend_pickup'}
		<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-locker">Paštomatas</label>
		<select id="sh-locker" class={`${inputClass} mt-1`} bind:value={shLockerId}>
			<option value={null}>— Nepasirinkta —</option>
			{#each lockers as l}
				<option value={l.id}>{l.name} — {l.city}, {l.address}</option>
			{/each}
		</select>
	{/if}
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-notes">Pastabos</label>
	<textarea id="sh-notes" class={`${inputClass} mt-1`} rows="2" bind:value={shNotes}></textarea>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (shipmentModal = '')}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitShipment()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>

<!-- Priemoka -->
<Modal
	bind:open={
		() => surchargeOpen,
		(v) => {
			if (!v) surchargeOpen = false;
		}
	}
	title="Priemoka klientui"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<label class="block text-sm font-medium text-slate-700" for="sc-amount">Suma (su PVM)</label>
	<input id="sc-amount" class={`${inputClass} mt-1`} placeholder="Pvz.: 3.63" bind:value={surchargeAmount} />
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sc-reason">Priežastis</label>
	<input id="sc-reason" class={`${inputClass} mt-1`} bind:value={surchargeReason} />
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sc-method">Apmokėjimo būdas</label>
	<select id="sc-method" class={`${inputClass} mt-1`} bind:value={surchargeMethod}>
		<option value="montonio">Montonio mokėjimo nuoroda</option>
		<option value="bank_transfer">Paprastas pavedimas</option>
	</select>
	<label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
		<input type="checkbox" bind:checked={surchargeSendEmail} class="rounded border-slate-300" />
		Išsiųsti laišką klientui
	</label>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (surchargeOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitSurcharge()}
			disabled={busy || !surchargeAmount}
		>
			{busy ? 'Saugoma…' : 'Sukurti priemoką'}
		</button>
	{/snippet}
</Modal>
