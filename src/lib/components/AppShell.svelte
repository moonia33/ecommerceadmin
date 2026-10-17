<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import {
		Boxes,
		CreditCard,
		LayoutDashboard,
		LogOut,
		Package,
		ScrollText,
		Truck,
		Users,
		Warehouse
	} from '@lucide/svelte';
	import { auth, signOut } from '#lib/stores/auth.svelte';
	import { pushToast } from '#lib/stores/toasts.svelte';

	let { children }: { children: Snippet } = $props();

	const navItems = [
		{ href: '/', label: 'Apžvalga', icon: LayoutDashboard },
		{ href: '/uzsakymai', label: 'Užsakymai', icon: Package },
		{ href: '/siuntos', label: 'Siuntos', icon: Truck },
		{ href: '/mokejimai', label: 'Mokėjimai', icon: CreditCard },
		{ href: '/atsargos', label: 'Atsargos', icon: Warehouse },
		{ href: '/prekes', label: 'Prekės', icon: Boxes },
		{ href: '/klientai', label: 'Klientai', icon: Users },
		{ href: '/auditas', label: 'Auditas', icon: ScrollText }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	async function handleLogout() {
		await signOut();
		pushToast('info', 'Sesija baigta');
	}
</script>

<div class="min-h-screen bg-slate-100 text-slate-900">
	<div class="mx-auto flex max-w-[1700px]">
		<!-- Sidebar (desktop) -->
		<aside
			class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex"
		>
			<a href="/" class="mb-6 flex items-center gap-3 px-1">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white"
				>
					BŽ
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-900">Baltijos Žvynas</p>
					<p class="text-xs text-slate-500">Administravimas</p>
				</div>
			</a>

			<nav class="flex-1 space-y-1">
				{#each navItems as item}
					{@const active = isActive(item.href, page.url.pathname)}
					<a
						href={item.href}
						class={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
							active
								? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
								: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<item.icon size={18} class={active ? 'text-sky-600' : 'text-slate-400'} />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="mt-4 border-t border-slate-200 pt-4">
				<p class="truncate px-1 text-sm font-medium text-slate-700">{auth.user?.email ?? ''}</p>
				<button
					type="button"
					class="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
					onclick={handleLogout}
				>
					<LogOut size={16} />
					Atsijungti
				</button>
			</div>
		</aside>

		<div class="min-w-0 flex-1">
			<!-- Mobile nav -->
			<div class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
				<div class="flex items-center justify-between px-4 py-3">
					<a href="/" class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-sm font-bold text-white"
						>
							BŽ
						</div>
						<span class="text-sm font-semibold">Administravimas</span>
					</a>
					<button
						type="button"
						class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
						onclick={handleLogout}
						aria-label="Atsijungti"
					>
						<LogOut size={18} />
					</button>
				</div>
				<nav class="flex gap-1 overflow-x-auto px-3 pb-2">
					{#each navItems as item}
						{@const active = isActive(item.href, page.url.pathname)}
						<a
							href={item.href}
							class={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
								active ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100'
							}`}
						>
							<item.icon size={15} />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>

			<main class="p-4 lg:p-6">
				{@render children()}
			</main>
		</div>
	</div>
</div>
