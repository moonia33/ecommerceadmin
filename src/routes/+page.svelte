<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, ArrowRight, CreditCard, Package, Truck, Warehouse } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		fetchInventoryAlerts,
		fetchJobs,
		fetchOrders,
		fetchPayments,
		ApiError,
		type OpsInventoryItem,
		type OpsOrderListItem
	} from '#lib/api/client';
	import { formatDateTime, formatMoney } from '#lib/format';
	import { pushToast } from '#lib/stores/toasts.svelte';

	let loading = $state(true);
	let recentOrders = $state<OpsOrderListItem[]>([]);
	let alerts = $state<OpsInventoryItem[]>([]);
	let counts = $state({
		pendingPayment: 0,
		paid: 0,
		pendingPayments: 0,
		stockAlerts: 0,
		failedJobs: 0
	});

	async function load() {
		loading = true;
		try {
			const [orders, awaitingPayment, paid, payments, stock, failedJobs] = await Promise.all([
				fetchOrders({ page: 1, page_size: 8 }),
				fetchOrders({ status: 'pending_payment', page_size: 1 }),
				fetchOrders({ status: 'paid', page_size: 1 }),
				fetchPayments({ status: 'pending', page_size: 1 }),
				fetchInventoryAlerts({ threshold: 3, page_size: 5 }),
				fetchJobs({ status: 'failed', page_size: 1 })
			]);
			recentOrders = orders.results;
			alerts = stock.results;
			counts = {
				pendingPayment: awaitingPayment.total_count,
				paid: paid.total_count,
				pendingPayments: payments.total_count,
				stockAlerts: stock.total_count,
				failedJobs: failedJobs.total_count
			};
		} catch (e) {
			pushToast(
				'error',
				e instanceof ApiError ? e.message : 'Nepavyko įkelti apžvalgos duomenų.'
			);
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());

	const cards = $derived([
		{
			label: 'Laukia apmokėjimo',
			value: counts.pendingPayment,
			hint: 'Užsakymai be apmokėjimo',
			href: '/uzsakymai',
			icon: Package,
			tone: 'text-amber-600 bg-amber-100'
		},
		{
			label: 'Apmokėti užsakymai',
			value: counts.paid,
			hint: 'Galima ruošti siuntas',
			href: '/siuntos',
			icon: Truck,
			tone: 'text-sky-600 bg-sky-100'
		},
		{
			label: 'Laukiantys mokėjimai',
			value: counts.pendingPayments,
			hint: 'Reikia peržiūrėti',
			href: '/mokejimai',
			icon: CreditCard,
			tone: 'text-violet-600 bg-violet-100'
		},
		{
			label: 'Mažos atsargos',
			value: counts.stockAlerts,
			hint: 'Likutis ≤ 3 vnt.',
			href: '/atsargos',
			icon: Warehouse,
			tone: 'text-rose-600 bg-rose-100'
		}
	]);
</script>

<PageHeader title="Apžvalga" subtitle="Kasdienės operacijos vienoje vietoje">
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

{#if loading}
	<Spinner label="Kraunama apžvalga…" />
{:else}
	<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		{#each cards as card}
			<a
				href={card.href}
				class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow"
			>
				<div class="flex items-center justify-between">
					<p class="text-sm text-slate-500">{card.label}</p>
					<span class={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
						<card.icon size={18} />
					</span>
				</div>
				<p class="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
				<p class="mt-1 text-xs text-slate-400">{card.hint}</p>
			</a>
		{/each}
	</div>

	{#if counts.failedJobs > 0}
		<a
			href="/auditas"
			class="mt-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
		>
			<AlertTriangle size={18} class="shrink-0" />
			<span
				>Yra <strong>{counts.failedJobs}</strong> nepavykusių masinių užduočių — peržiūrėkite
				audito puslapyje.</span
			>
		</a>
	{/if}

	<div class="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
				<h2 class="text-base font-semibold text-slate-900">Naujausi užsakymai</h2>
				<a
					href="/uzsakymai"
					class="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-500"
				>
					Visi užsakymai
					<ArrowRight size={15} />
				</a>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-2.5 font-medium">Užsakymas</th>
							<th class="px-4 py-2.5 font-medium">Klientas</th>
							<th class="px-4 py-2.5 font-medium">Būsena</th>
							<th class="px-4 py-2.5 font-medium">Mokėjimas</th>
							<th class="px-4 py-2.5 font-medium">Suma</th>
							<th class="px-4 py-2.5 font-medium">Sukurta</th>
						</tr>
					</thead>
					<tbody>
						{#each recentOrders as order}
							<tr class="border-t border-slate-100 hover:bg-slate-50">
								<td class="px-4 py-2.5">
									<a
										href={`/uzsakymai/${order.id}`}
										class="font-semibold text-sky-700 hover:underline">#{order.id}</a
									>
								</td>
								<td class="px-4 py-2.5">
									<div class="font-medium text-slate-800">{order.customer.full_name || '—'}</div>
									<div class="text-xs text-slate-400">{order.customer.email}</div>
								</td>
								<td class="px-4 py-2.5"><StatusBadge kind="order" value={order.status} /></td>
								<td class="px-4 py-2.5"
									><StatusBadge kind="payment" value={order.payment_status} /></td
								>
								<td class="px-4 py-2.5 font-medium text-slate-900"
									>{formatMoney(order.amount_gross, order.amount_currency)}</td
								>
								<td class="px-4 py-2.5 text-slate-500">{formatDateTime(order.created_at)}</td>
							</tr>
						{:else}
							<tr>
								<td colspan="6" class="px-4 py-8 text-center text-slate-400"
									>Užsakymų dar nėra.</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
				<h2 class="text-base font-semibold text-slate-900">Mažos atsargos</h2>
				<a
					href="/atsargos"
					class="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-500"
				>
					Sandėlis
					<ArrowRight size={15} />
				</a>
			</div>
			<div class="divide-y divide-slate-100">
				{#each alerts as item}
					<div class="px-4 py-3">
						<p class="text-sm font-medium text-slate-800">{item.product_name || item.sku}</p>
						<p class="mt-0.5 text-xs text-slate-500">
							SKU: {item.sku} · Sandėlis: {item.warehouse_code}
						</p>
						<p class="mt-1 text-xs">
							<span class="font-semibold text-rose-600">Liko: {item.qty_on_hand}</span>
							<span class="text-slate-400"> · rezervuota {item.qty_reserved}</span>
						</p>
					</div>
				{:else}
					<p class="px-4 py-8 text-center text-sm text-slate-400">
						Mažų atsargų perspėjimų nėra.
					</p>
				{/each}
			</div>
		</section>
	</div>
{/if}
