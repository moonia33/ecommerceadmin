<script lang="ts">
	import { onMount } from 'svelte';
	import { RotateCcw, Search } from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		fetchPayments,
		paymentAction,
		type OpsPayment
	} from '#lib/api/client';
	import { formatDateTime, formatMoney } from '#lib/format';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let payments = $state<OpsPayment[]>([]);
	let total = $state(0);
	let page = $state(1);

	let status = $state('');
	let provider = $state('');
	let orderId = $state('');

	let actionKind = $state<'' | 'mark-paid' | 'refund' | 'reconcile'>('');
	let actionPayment = $state<OpsPayment | null>(null);
	let note = $state('');
	let busy = $state(false);

	const titles = {
		'mark-paid': 'Pažymėti mokėjimą apmokėtu',
		refund: 'Inicijuoti pinigų grąžinimą',
		reconcile: 'Suderinti mokėjimą'
	} as const;

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchPayments({
				status,
				provider: provider.trim(),
				order_id: orderId.trim(),
				page: pageNum,
				page_size: PAGE_SIZE
			});
			payments = res.results;
			total = res.total_count;
			page = res.page;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti mokėjimų.');
		} finally {
			loading = false;
		}
	}

	function openAction(kind: 'mark-paid' | 'refund' | 'reconcile', payment: OpsPayment) {
		actionKind = kind;
		actionPayment = payment;
		note = '';
	}

	async function runAction() {
		if (!actionKind || !actionPayment || busy) return;
		busy = true;
		try {
			await paymentAction(actionPayment.id, actionKind, { note: note.trim() });
			pushToast('success', 'Veiksmas atliktas.');
			actionKind = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load(1));

	const selectClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<PageHeader title="Mokėjimai" subtitle="Mokėjimų būsenos, suderinimas ir grąžinimai">
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
	<select class={selectClass} bind:value={status} aria-label="Mokėjimo būsena">
		<option value="">Visos būsenos</option>
		<option value="pending">Laukiama</option>
		<option value="succeeded">Apmokėta</option>
		<option value="failed">Nepavyko</option>
		<option value="cancelled">Atšaukta</option>
	</select>
	<input
		class={inputClass}
		placeholder="Tiekėjas (pvz. stripe, paysera)"
		bind:value={provider}
		onkeydown={(e) => e.key === 'Enter' && load(1)}
	/>
	<input
		class={`${inputClass} w-36`}
		placeholder="Užsakymo nr."
		bind:value={orderId}
		onkeydown={(e) => e.key === 'Enter' && load(1)}
	/>
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
			status = '';
			provider = '';
			orderId = '';
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunami mokėjimai…" />
	{:else if payments.length === 0}
		<EmptyState title="Mokėjimų nerasta" hint="Pakeiskite filtrus." />
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Mokėjimas</th>
						<th class="px-4 py-3 font-medium">Užsakymas</th>
						<th class="px-4 py-3 font-medium">Tiekėjas</th>
						<th class="px-4 py-3 font-medium">Būsena</th>
						<th class="px-4 py-3 font-medium">Suma</th>
						<th class="px-4 py-3 font-medium">Sukurta</th>
						<th class="px-4 py-3 text-right font-medium">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each payments as p (p.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-4 py-3">
								<span class="font-semibold text-slate-900">#{p.id}</span>
								{#if p.external_id}
									<div class="text-xs text-slate-400">{p.external_id}</div>
								{/if}
							</td>
							<td class="px-4 py-3">
								<a
									href={`/uzsakymai/${p.order_id}`}
									class="font-medium text-sky-700 hover:underline">#{p.order_id}</a
								>
							</td>
							<td class="px-4 py-3 text-slate-700">{p.provider || '—'}</td>
							<td class="px-4 py-3"><StatusBadge kind="payment" value={p.status} /></td>
							<td class="px-4 py-3 font-semibold text-slate-900">
								{formatMoney(p.amount_gross, p.currency)}
							</td>
							<td class="px-4 py-3 text-slate-500">{formatDateTime(p.created_at)}</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-1.5">
									<button
										type="button"
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
										disabled={busy || p.status === 'succeeded'}
										onclick={() => openAction('mark-paid', p)}
									>
										Apmokėta
									</button>
									<button
										type="button"
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
										disabled={busy}
										onclick={() => openAction('reconcile', p)}
									>
										Suderinti
									</button>
									<button
										type="button"
										class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
										disabled={busy || p.status === 'cancelled'}
										onclick={() => openAction('refund', p)}
									>
										Grąžinti
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
		() => actionKind !== '',
		(v) => {
			if (!v) actionKind = '';
		}
	}
	title={actionKind ? titles[actionKind] : ''}
	subtitle={actionPayment
		? `Mokėjimas #${actionPayment.id} · ${formatMoney(actionPayment.amount_gross, actionPayment.currency)} · užsakymas #${actionPayment.order_id}`
		: ''}
>
	{#if actionKind === 'refund'}
		<p class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
			Grąžinimas atšauks mokėjimą ir susijusį užsakymą bei atleis rezervuotas prekės.
		</p>
	{/if}
	<label class="block text-sm font-medium text-slate-700" for="payment-note">Pastaba</label>
	<textarea
		id="payment-note"
		class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
		rows="3"
		placeholder="Pvz.: pavedimas sutapdintas rankiniu būdu"
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
