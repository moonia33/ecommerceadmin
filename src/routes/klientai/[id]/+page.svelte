<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft, Mail, MapPin, Phone, ShieldOff, ShieldCheck } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		fetchCustomer,
		toggleCustomerActive,
		type OpsCustomerDetail
	} from '#lib/api/client';
	import { formatDate, formatDateTime, formatMoney } from '#lib/format';
	import { shippingMethodLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const customerId = $derived(page.params.id ?? '');

	let loading = $state(true);
	let customer = $state<OpsCustomerDetail | null>(null);
	let confirmOpen = $state(false);
	let busy = $state(false);

	async function load() {
		loading = true;
		try {
			customer = await fetchCustomer(customerId);
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti kliento.');
		} finally {
			loading = false;
		}
	}

	async function toggleActive() {
		if (!customer || busy) return;
		busy = true;
		try {
			await toggleCustomerActive(customer.id);
			pushToast(
				'success',
				customer.is_active ? 'Paskyra deaktyvuota.' : 'Paskyra aktyvuota.'
			);
			confirmOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load());
</script>

<div class="mb-4">
	<a href="/klientai" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
		<ArrowLeft size={15} />
		Atgal į klientus
	</a>
</div>

{#if loading}
	<Spinner label="Kraunamas klientas…" />
{:else if !customer}
	<EmptyState title="Klientas nerastas" />
{:else}
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-2xl font-semibold text-slate-900">
						{customer.full_name || customer.email}
					</h1>
					<Badge
						label={customer.is_active ? 'Aktyvus' : 'Deaktyvuotas'}
						tone={customer.is_active ? 'emerald' : 'rose'}
					/>
					{#if customer.is_staff}
						<Badge label="Darbuotojas" tone="sky" />
					{/if}
					{#each customer.groups as group}
						<Badge label={group} tone="violet" />
					{/each}
				</div>
				<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
					<span class="inline-flex items-center gap-1.5">
						<Mail size={14} class="text-slate-400" /> {customer.email}
					</span>
					{#if customer.phone}
						<span class="inline-flex items-center gap-1.5">
							<Phone size={14} class="text-slate-400" /> {customer.phone}
						</span>
					{/if}
				</div>
				<p class="mt-1.5 text-xs text-slate-400">
					Registruota: {formatDate(customer.date_joined)}
					{#if customer.last_login}· Paskutinis prisijungimas: {formatDateTime(customer.last_login)}{/if}
				</p>
			</div>
			<button
				type="button"
				class={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium ${
					customer.is_active
						? 'border-rose-200 text-rose-600 hover:bg-rose-50'
						: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
				}`}
				onclick={() => (confirmOpen = true)}
			>
				{#if customer.is_active}
					<ShieldOff size={15} /> Deaktyvuoti paskyrą
				{:else}
					<ShieldCheck size={15} /> Aktyvuoti paskyrą
				{/if}
			</button>
		</div>

		<div class="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
			<div class="rounded-xl bg-slate-50 px-4 py-3 text-center">
				<p class="text-xl font-semibold text-slate-900">{customer.orders_count}</p>
				<p class="text-xs text-slate-500">Užsakymai</p>
			</div>
			<div class="rounded-xl bg-slate-50 px-4 py-3 text-center">
				<p class="text-xl font-semibold text-slate-900">{customer.paid_orders_count}</p>
				<p class="text-xs text-slate-500">Apmokėti</p>
			</div>
			<div class="rounded-xl bg-slate-50 px-4 py-3 text-center">
				<p class="text-xl font-semibold text-slate-900">{formatMoney(customer.total_spent)}</p>
				<p class="text-xs text-slate-500">Išleista iš viso</p>
			</div>
			<div class="rounded-xl bg-slate-50 px-4 py-3 text-center">
				<p class="text-xl font-semibold text-slate-900">
					{customer.last_order_at ? formatDate(customer.last_order_at) : '—'}
				</p>
				<p class="text-xs text-slate-500">Paskutinis užsakymas</p>
			</div>
		</div>
	</div>

	<div class="mt-5 grid gap-5 xl:grid-cols-3">
		<!-- Telefonai -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Telefonai</h2>
			{#if customer.phones.length === 0}
				<p class="mt-3 text-sm text-slate-400">Telefonų nėra.</p>
			{:else}
				<ul class="mt-3 space-y-2">
					{#each customer.phones as phone}
						<li class="flex items-center justify-between text-sm">
							<span class="text-slate-800">{phone.phone}</span>
							<span class="flex gap-1">
								{#if phone.is_primary}<Badge label="Pagrindinis" tone="sky" />{/if}
								{#if phone.is_verified}<Badge label="Patvirtintas" tone="emerald" />{/if}
								{#if phone.label}<Badge label={phone.label} tone="slate" />{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if customer.pickup_point}
				<h2 class="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">
					Mėgstamas atsiėmimo taškas
				</h2>
				<div class="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
					<p class="flex items-center gap-1.5 font-medium text-slate-800">
						<MapPin size={14} class="text-sky-600" />
						{customer.pickup_point.pickup_point_name || '—'}
					</p>
					<p class="mt-1 text-xs text-slate-500">
						{shippingMethodLabel(
							String(customer.pickup_point.raw?.shipping_method_code ?? '')
						)}
						· ID: {customer.pickup_point.pickup_point_id}
					</p>
				</div>
			{/if}
		</section>

		<!-- Adresai -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Adresai</h2>
			{#if customer.addresses.length === 0}
				<p class="mt-3 text-sm text-slate-400">Adresų nėra.</p>
			{:else}
				<ul class="mt-3 space-y-3">
					{#each customer.addresses as address}
						<li class="rounded-xl bg-slate-50 p-3 text-sm">
							<div class="flex flex-wrap items-center gap-1.5">
								{#if address.label}<Badge label={address.label} tone="slate" />{/if}
								{#if address.is_default_shipping}<Badge label="Pristatymo" tone="cyan" />{/if}
								{#if address.is_default_billing}<Badge label="Sąskaitų" tone="amber" />{/if}
							</div>
							<p class="mt-1.5 font-medium text-slate-800">{address.full_name || '—'}</p>
							{#if address.company}
								<p class="text-slate-600">
									{address.company}
									{#if address.company_vat_no}(PVM: {address.company_vat_no}){/if}
								</p>
							{/if}
							<p class="text-slate-600">
								{address.line1}, {address.city} {address.postal_code}, {address.country_code}
							</p>
							{#if address.phone}<p class="text-slate-500">Tel.: {address.phone}</p>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Užsakymai -->
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-1">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
					Užsakymai <span class="text-slate-400">({customer.orders.length})</span>
				</h2>
			</div>
			{#if customer.orders.length === 0}
				<p class="px-5 py-6 text-sm text-slate-400">Užsakymų nėra.</p>
			{:else}
				<ul class="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
					{#each customer.orders as order}
						<li class="px-5 py-3">
							<div class="flex items-center justify-between gap-2">
								<a
									href={`/uzsakymai/${order.id}`}
									class="font-semibold text-sky-700 hover:underline">#{order.id}</a
								>
								<span class="font-medium text-slate-900">
									{formatMoney(order.amount_gross, order.currency)}
								</span>
							</div>
							<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
								<StatusBadge kind="order" value={order.status} />
								<StatusBadge kind="delivery" value={order.delivery_status} />
								<span class="text-xs text-slate-400">{formatDateTime(order.created_at)}</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}

<Modal
	bind:open={confirmOpen}
	title={customer?.is_active ? 'Deaktyvuoti paskyrą' : 'Aktyvuoti paskyrą'}
	subtitle={customer ? customer.email : ''}
>
	{#if customer?.is_active}
		<p class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
			Deaktyvuotas klientas nebegalės prisijungti prie parduotuvės.
		</p>
	{:else}
		<p class="text-sm text-slate-600">Paskyra vėl taps aktyvi ir klientas galės prisijungti.</p>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (confirmOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
				customer?.is_active ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
			}`}
			onclick={() => void toggleActive()}
			disabled={busy}
		>
			{busy ? 'Vykdoma…' : customer?.is_active ? 'Deaktyvuoti' : 'Aktyvuoti'}
		</button>
	{/snippet}
</Modal>
