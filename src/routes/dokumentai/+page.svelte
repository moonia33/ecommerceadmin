<script lang="ts">
	import { onMount } from 'svelte';
	import { RotateCcw, Search } from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		ApiError,
		cancelInvoice,
		fetchInvoices,
		invoicePdfUrl,
		resendInvoice,
		type OpsInvoice
	} from '#lib/api/client';
	import { formatDate, formatDateTime, formatMoney } from '#lib/format';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let invoices = $state<OpsInvoice[]>([]);
	let total = $state(0);
	let page = $state(1);
	let busyId = $state<number | null>(null);

	let q = $state('');
	let kind = $state('');
	let status = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchInvoices({
				q: q.trim(),
				kind,
				status,
				date_from: dateFrom,
				date_to: dateTo,
				page: pageNum,
				page_size: PAGE_SIZE
			});
			invoices = res.results;
			total = res.total_count;
			page = res.page;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti dokumentų.');
		} finally {
			loading = false;
		}
	}

	async function resend(inv: OpsInvoice) {
		if (busyId !== null) return;
		busyId = inv.id;
		try {
			await resendInvoice(inv.id);
			pushToast('success', `Dokumentas ${inv.number} išsiųstas el. paštu.`);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Siuntimas nepavyko.');
		} finally {
			busyId = null;
		}
	}

	async function cancel(inv: OpsInvoice) {
		if (busyId !== null) return;
		if (!confirm(`Atšaukti dokumentą ${inv.number}? Dokumentas liks auditui.`)) return;
		busyId = inv.id;
		try {
			await cancelInvoice(inv.id);
			pushToast('success', `Dokumentas ${inv.number} atšauktas.`);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Atšaukimas nepavyko.');
		} finally {
			busyId = null;
		}
	}

	function openPdf(inv: OpsInvoice) {
		window.open(invoicePdfUrl(inv.id), '_blank', 'noopener');
	}

	onMount(() => void load(1));

	const selectClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const btnSm =
		'rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50';
</script>

<PageHeader title="Dokumentai" subtitle="Sąskaitos faktūros ir kreditinės sąskaitos">
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
			placeholder="Ieškoti: numeris, užsakymas, pirkėjas, el. paštas"
			bind:value={q}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
	</div>
	<select class={selectClass} bind:value={kind} aria-label="Dokumento tipas">
		<option value="">Visi tipai</option>
		<option value="sales">Sąskaitos</option>
		<option value="credit">Kreditinės</option>
	</select>
	<select class={selectClass} bind:value={status} aria-label="Būsena">
		<option value="">Visos būsenos</option>
		<option value="issued">Išrašytos</option>
		<option value="cancelled">Atšauktos</option>
	</select>
	<label class="flex items-center gap-2 text-sm text-slate-600">
		Nuo
		<input type="date" class={inputClass} bind:value={dateFrom} />
	</label>
	<label class="flex items-center gap-2 text-sm text-slate-600">
		Iki
		<input type="date" class={inputClass} bind:value={dateTo} />
	</label>
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
			kind = '';
			status = '';
			dateFrom = '';
			dateTo = '';
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunami dokumentai…" />
	{:else if invoices.length === 0}
		<EmptyState title="Dokumentų nerasta" hint="Pakeiskite paieškos tekstą arba filtrus." />
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Numeris</th>
						<th class="px-4 py-3 font-medium">Tipas</th>
						<th class="px-4 py-3 font-medium">Užsakymas</th>
						<th class="px-4 py-3 font-medium">Pirkėjas</th>
						<th class="px-4 py-3 font-medium">Išrašyta</th>
						<th class="px-4 py-3 text-right font-medium">Suma</th>
						<th class="px-4 py-3 font-medium">El. paštas</th>
						<th class="px-4 py-3 font-medium">Būsena</th>
						<th class="px-4 py-3 text-right font-medium">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each invoices as inv (inv.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-4 py-3">
								<span class="font-semibold text-slate-900">{inv.number}</span>
								{#if inv.credit_of_number}
									<div class="text-xs text-slate-400">→ {inv.credit_of_number}</div>
								{/if}
							</td>
							<td class="px-4 py-3">
								<Badge
									label={inv.kind === 'credit' ? 'Kreditinė' : 'Sąskaita'}
									tone={inv.kind === 'credit' ? 'violet' : 'sky'}
								/>
							</td>
							<td class="px-4 py-3">
								<a
									href={`/uzsakymai/${inv.order_id}`}
									class="font-medium text-sky-700 hover:underline">#{inv.order_id}</a
								>
							</td>
							<td class="px-4 py-3">
								<span class="text-slate-800">{inv.buyer_name || '—'}</span>
								{#if inv.buyer_email}
									<div class="text-xs text-slate-400">{inv.buyer_email}</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-slate-600">{formatDate(inv.issue_date)}</td>
							<td class="px-4 py-3 text-right font-semibold text-slate-900">
								{formatMoney(inv.total_gross, inv.currency)}
							</td>
							<td class="px-4 py-3 text-slate-500">
								{inv.emailed_at ? formatDateTime(inv.emailed_at) : '—'}
							</td>
							<td class="px-4 py-3">
								<Badge
									label={inv.status === 'cancelled' ? 'Atšaukta' : 'Išrašyta'}
									tone={inv.status === 'cancelled' ? 'rose' : 'emerald'}
								/>
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-1.5">
									<button type="button" class={btnSm} onclick={() => openPdf(inv)}>PDF</button>
									{#if inv.status !== 'cancelled'}
										<button
											type="button"
											class={btnSm}
											disabled={busyId !== null}
											onclick={() => void resend(inv)}>El. paštu</button
										>
										<button
											type="button"
											class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
											disabled={busyId !== null}
											onclick={() => void cancel(inv)}>Atšaukti</button
										>
									{/if}
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
