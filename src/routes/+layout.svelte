<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import AppShell from '#lib/components/AppShell.svelte';
	import LoginScreen from '#lib/components/LoginScreen.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import { auth, initAuth } from '#lib/stores/auth.svelte';

	let { children }: LayoutProps = $props();

	onMount(() => {
		initAuth().catch(() => {});
	});
</script>

<svelte:head>
	<title>Baltijos Žvynas — Administravimas</title>
	<meta
		name="description"
		content="Užsakymų, siuntų, mokėjimų, atsargų, prekių ir klientų administravimo panelė."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if auth.state === 'loading'}
	<div class="flex min-h-screen items-center justify-center bg-slate-100">
		<Spinner label="Kraunama…" />
	</div>
{:else if auth.state !== 'authenticated'}
	<LoginScreen />
{:else}
	<AppShell>
		{@render children()}
	</AppShell>
{/if}

<Toasts />
