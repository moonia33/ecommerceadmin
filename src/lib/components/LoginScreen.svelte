<script lang="ts">
	import { auth, signIn } from '#lib/stores/auth.svelte';
	import { ApiError } from '#lib/api/client';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let isLoading = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!email.trim() || !password.trim()) {
			error = 'Įveskite el. paštą ir slaptažodį.';
			return;
		}
		isLoading = true;
		error = '';
		try {
			await signIn(email.trim(), password);
		} catch (e) {
			if (auth.state === 'denied') {
				error = 'Ši paskyra neturi administravimo teisių.';
				return;
			}
			error =
				e instanceof ApiError && e.status === 401
					? 'Neteisingas el. paštas arba slaptažodis.'
					: e instanceof Error
						? e.message
						: 'Prisijungti nepavyko. Patikrinkite ar serveris veikia.';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
	<div
		class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60"
	>
		<div class="mb-6 flex items-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white"
			>
				BŽ
			</div>
			<div>
				<h1 class="text-xl font-semibold text-slate-900">Baltijos Žvynas</h1>
				<p class="text-sm text-slate-500">Administravimo panelė</p>
			</div>
		</div>

		{#if auth.state === 'denied'}
			<div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
				Ši paskyra neturi administravimo teisių. Kreipkitės į sistemos administratorių.
			</div>
		{/if}

		<form class="mt-5 space-y-4" onsubmit={handleSubmit}>
			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-slate-700">El. paštas</label>
				<input
					id="email"
					bind:value={email}
					type="email"
					autocomplete="email"
					class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
					placeholder="vadybininkas@parduotuve.lt"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-slate-700"
					>Slaptažodis</label
				>
				<input
					id="password"
					bind:value={password}
					type="password"
					autocomplete="current-password"
					class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
					placeholder="••••••••"
				/>
			</div>

			{#if error}
				<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
					{error}
				</div>
			{/if}

			<button
				type="submit"
				class="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isLoading}
			>
				{isLoading ? 'Jungiamasi…' : 'Prisijungti'}
			</button>
		</form>
	</div>
</div>
