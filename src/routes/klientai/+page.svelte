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
		fetchCustomers,
		type OpsCustomerListItem
	} from '#lib/api/client';
	import { formatDateTime, formatMoney } from '#lib/format';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let loading = $state(true);
	let customers = $state<OpsCustomerListItem[]>([]);
	let total = $state(0);
	let page = $state(1);

	let q = $state('');
	let isActive = $state('');
	let isStaff = $state('false');
	let hasOrders = $state('');

	async function load(pageNum = page) {
		loading = true;
		try {
			const res = await fetchCustomers({
				q: q.trim(),
				is_active: isActive,
				is_staff: isStaff,
				has_orders: hasOrders,
				page: pageNum,
				page_size: PAGE_SIZE
			});
			customers = res.results;
			total = res.total_count;
			page = res.page;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti klientų.');
		} finally {
			loading = false;
		}
	}

	onMount(() => void load(1));

	const selectClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<PageHeader title="Klientai" subtitle="Vartotojų paskyros, kontaktai ir užsakymų istorija">
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
			placeholder="Ieškoti: el. paštas, vardas, telefonas"
			bind:value={q}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
	</div>
	<select class={selectClass} bind:value={isActive} aria-label="Paskyros būsena">
		<option value="">Visos paskyros</option>
		<option value="true">Aktyvios</option>
		<option value="false">Deaktyvuotos</option>
	</select>
	<select class={selectClass} bind:value={isStaff} aria-label="Paskyros tipas">
		<option value="">Visi</option>
		<option value="false">Tik klientai</option>
		<option value="true">Tik darbuotojai</option>
	</select>
	<label class="inline-flex items-center gap-2 text-sm text-slate-600">
		<input
			type="checkbox"
			class="h-4 w-4 rounded border-slate-300"
			checked={hasOrders === 'true'}
			onchange={(e) => {
				hasOrders = e.currentTarget.checked ? 'true' : '';
				void load(1);
			}}
		/>
		Tik su užsakymais
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
			isActive = '';
			isStaff = 'false';
			hasOrders = '';
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunami klientai…" />
	{:else if customers.length === 0}
		<EmptyState title="Klientų nerasta" hint="Pakeiskite paieškos tekstą arba filtrus." />
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Klientas</th>
						<th class="px-4 py-3 font-medium">Telefonas</th>
						<th class="px-4 py-3 font-medium">Grupės</th>
						<th class="px-4 py-3 text-right font-medium">Užsakymai</th>
						<th class="px-4 py-3 text-right font-medium">Apmokėta</th>
						<th class="px-4 py-3 text-right font-medium">Iš viso</th>
						<th class="px-4 py-3 font-medium">Paskutinis</th>
						<th class="px-4 py-3 font-medium">Būsena</th>
					</tr>
				</thead>
				<tbody>
					{#each customers as customer (customer.id)}
						<tr class="border-t border-slate-100 hover:bg-slate-50">
							<td class="px-4 py-3">
								<a
									href={`/klientai/${customer.id}`}
									class="font-semibold text-sky-700 hover:underline"
								>
									{customer.full_name || customer.email}
								</a>
								<div class="text-xs text-slate-400">{customer.email}</div>
							</td>
							<td class="px-4 py-3 text-slate-600">{customer.phone || '—'}</td>
							<td class="px-4 py-3">
								{#if customer.groups.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each customer.groups as group}
											<Badge label={group} tone="violet" />
										{/each}
									</div>
								{:else}
									<span class="text-slate-400">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right text-slate-800">{customer.orders_count}</td>
							<td class="px-4 py-3 text-right text-slate-600">{customer.paid_orders_count}</td>
							<td class="px-4 py-3 text-right font-semibold text-slate-900">
								{formatMoney(customer.total_spent)}
							</td>
							<td class="px-4 py-3 text-slate-500">
								{customer.last_order_at ? formatDateTime(customer.last_order_at) : '—'}
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap gap-1">
									<Badge
										label={customer.is_active ? 'Aktyvus' : 'Deaktyvuotas'}
										tone={customer.is_active ? 'emerald' : 'rose'}
									/>
									{#if customer.is_staff}
										<Badge label="Darbuotojas" tone="sky" />
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
