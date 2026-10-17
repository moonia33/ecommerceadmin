<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, ChevronUp, RotateCcw, Search } from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		fetchAuditEvents,
		fetchJobs,
		retryJob,
		type OpsAuditEvent,
		type OpsJob
	} from '#lib/api/client';
	import { formatDateTime } from '#lib/format';
	import { eventNameLabel, jobTypeLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const PAGE_SIZE = 25;

	let tab = $state<'events' | 'jobs'>('events');
	let loading = $state(true);
	let page = $state(1);
	let total = $state(0);

	let events = $state<OpsAuditEvent[]>([]);
	let jobs = $state<OpsJob[]>([]);

	// Įvykių filtrai
	let eventOrderId = $state('');
	let eventKind = $state('');
	let eventName = $state('');

	// Užduočių filtrai
	let jobStatus = $state('');
	let jobType = $state('');

	let expandedJobs = $state<Set<number>>(new Set());
	let busyJobId = $state<number | null>(null);

	async function load(pageNum = page) {
		loading = true;
		try {
			if (tab === 'events') {
				const res = await fetchAuditEvents({
					order_id: eventOrderId.trim(),
					kind: eventKind,
					name: eventName.trim(),
					page: pageNum,
					page_size: PAGE_SIZE
				});
				events = res.results;
				total = res.total_count;
			} else {
				const res = await fetchJobs({
					status: jobStatus,
					job_type: jobType,
					page: pageNum,
					page_size: PAGE_SIZE
				});
				jobs = res.results;
				total = res.total_count;
			}
			page = pageNum;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti duomenų.');
		} finally {
			loading = false;
		}
	}

	function switchTab(next: 'events' | 'jobs') {
		if (tab === next) return;
		tab = next;
		page = 1;
		total = 0;
		events = [];
		jobs = [];
		void load(1);
	}

	function toggleJob(id: number) {
		const next = new Set(expandedJobs);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedJobs = next;
	}

	async function runRetry(job: OpsJob) {
		if (busyJobId !== null) return;
		busyJobId = job.id;
		try {
			const updated = await retryJob(job.id);
			pushToast(
				updated.status === 'success' ? 'success' : 'error',
				updated.status === 'success'
					? 'Užduotis pakartota sėkmingai.'
					: `Užduotis vėl nepavyko: ${updated.error_message || ''}`
			);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Pakartoti nepavyko.');
		} finally {
			busyJobId = null;
		}
	}

	onMount(() => void load(1));

	const selectClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const inputClass =
		'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
</script>

<PageHeader title="Auditas" subtitle="Užsakymų įvykių istorija ir masinių užduočių būsenos">
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

<div class="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
	<button
		type="button"
		class={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'events' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
		onclick={() => switchTab('events')}
	>
		Įvykiai
	</button>
	<button
		type="button"
		class={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'jobs' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
		onclick={() => switchTab('jobs')}
	>
		Masinės užduotys
	</button>
</div>

<section class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
	{#if tab === 'events'}
		<input
			class={`${inputClass} w-36`}
			placeholder="Užsakymo nr."
			bind:value={eventOrderId}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
		<select class={selectClass} bind:value={eventKind} aria-label="Įvykio tipas">
			<option value="">Visi tipai</option>
			<option value="fulfillment">Įvykdymas</option>
			<option value="delivery">Pristatymas</option>
			<option value="payment">Mokėjimas</option>
			<option value="note">Pastaba</option>
		</select>
		<input
			class={inputClass}
			placeholder="Įvykio pavadinimas"
			bind:value={eventName}
			onkeydown={(e) => e.key === 'Enter' && load(1)}
		/>
	{:else}
		<select class={selectClass} bind:value={jobStatus} aria-label="Užduoties būsena">
			<option value="">Visos būsenos</option>
			<option value="queued">Eilėje</option>
			<option value="running">Vykdoma</option>
			<option value="success">Sėkminga</option>
			<option value="failed">Nepavyko</option>
		</select>
		<select class={selectClass} bind:value={jobType} aria-label="Užduoties tipas">
			<option value="">Visi tipai</option>
			<option value="orders_bulk_action">Masinis užsakymų veiksmas</option>
			<option value="shipment_labels_bulk">Masinė lipdukų generacija</option>
		</select>
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
			eventOrderId = '';
			eventKind = '';
			eventName = '';
			jobStatus = '';
			jobType = '';
			void load(1);
		}}
	>
		<RotateCcw size={15} /> Išvalyti
	</button>
</section>

<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<Spinner label="Kraunama…" />
	{:else if tab === 'events'}
		{#if events.length === 0}
			<EmptyState title="Įvykių nerasta" />
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-3 font-medium">Data</th>
							<th class="px-4 py-3 font-medium">Užsakymas</th>
							<th class="px-4 py-3 font-medium">Tipas</th>
							<th class="px-4 py-3 font-medium">Įvykis</th>
							<th class="px-4 py-3 font-medium">Atliko</th>
							<th class="px-4 py-3 font-medium">Detalės</th>
						</tr>
					</thead>
					<tbody>
						{#each events as event (event.id)}
							<tr class="border-t border-slate-100">
								<td class="px-4 py-3 whitespace-nowrap text-slate-500">
									{formatDateTime(event.created_at)}
								</td>
								<td class="px-4 py-3">
									<a href={`/uzsakymai/${event.order_id}`} class="font-medium text-sky-700 hover:underline">
										#{event.order_id}
									</a>
								</td>
								<td class="px-4 py-3"><StatusBadge kind="eventKind" value={event.kind} /></td>
								<td class="px-4 py-3 text-slate-800">{eventNameLabel(event.name)}</td>
								<td class="px-4 py-3 text-slate-600">{event.actor_label || '—'}</td>
								<td class="max-w-64 px-4 py-3">
									{#if event.payload && Object.keys(event.payload).length > 0}
										<span class="font-mono text-xs break-all text-slate-500">
											{JSON.stringify(event.payload)}
										</span>
									{:else}
										<span class="text-slate-300">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else}
		{#if jobs.length === 0}
			<EmptyState title="Užduočių nerasta" />
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-3 font-medium">ID</th>
							<th class="px-4 py-3 font-medium">Tipas</th>
							<th class="px-4 py-3 font-medium">Būsena</th>
							<th class="px-4 py-3 font-medium">Sukurta</th>
							<th class="px-4 py-3 font-medium">Baigta</th>
							<th class="px-4 py-3 font-medium">Rezultatas</th>
							<th class="px-4 py-3 text-right font-medium">Veiksmai</th>
						</tr>
					</thead>
					<tbody>
						{#each jobs as job (job.id)}
							{@const expanded = expandedJobs.has(job.id)}
							<tr class="border-t border-slate-100">
								<td class="px-4 py-3 font-semibold text-slate-900">#{job.id}</td>
								<td class="px-4 py-3 text-slate-700">{jobTypeLabel(job.job_type)}</td>
								<td class="px-4 py-3"><StatusBadge kind="job" value={job.status} /></td>
								<td class="px-4 py-3 whitespace-nowrap text-slate-500">
									{formatDateTime(job.created_at)}
								</td>
								<td class="px-4 py-3 whitespace-nowrap text-slate-500">
									{job.completed_at ? formatDateTime(job.completed_at) : '—'}
								</td>
								<td class="px-4 py-3">
									{#if job.error_message}
										<span class="text-xs text-rose-600">{job.error_message}</span>
									{:else}
										{@const updated = (job.result_payload?.updated_ids as unknown[] | undefined)?.length}
										{#if updated !== undefined}
											<span class="text-xs text-slate-500">Atnaujinta: {updated}</span>
										{:else}
											<span class="text-slate-300">—</span>
										{/if}
									{/if}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<button
											type="button"
											class="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
											onclick={() => toggleJob(job.id)}
											aria-label={expanded ? 'Suskleisti' : 'Išskleisti'}
										>
											{#if expanded}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
										</button>
										{#if job.status === 'failed'}
											<button
												type="button"
												class="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
												disabled={busyJobId !== null}
												onclick={() => void runRetry(job)}
											>
												<RotateCcw size={12} /> Pakartoti
											</button>
										{/if}
									</div>
								</td>
							</tr>
							{#if expanded}
								<tr class="border-t border-slate-100 bg-slate-50/60">
									<td colspan="7" class="px-4 py-3">
										<div class="grid gap-3 md:grid-cols-2">
											<div>
												<p class="mb-1 text-xs font-medium text-slate-500">Užklausa</p>
												<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(job.request_payload, null, 2)}</pre>
											</div>
											<div>
												<p class="mb-1 text-xs font-medium text-slate-500">Rezultatas</p>
												<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(job.result_payload, null, 2)}</pre>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
	{#if !loading && (events.length > 0 || jobs.length > 0)}
		<div class="border-t border-slate-200 px-4 py-3">
			<Pagination {page} pageSize={PAGE_SIZE} {total} onchange={(p) => void load(p)} />
		</div>
	{/if}
</section>
