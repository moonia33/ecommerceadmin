<script lang="ts">
	import { Inbox } from '@lucide/svelte';

	let {
		title = 'Nieko nerasta',
		hint = ''
	}: { title?: string; hint?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
	<Inbox size={28} class="text-slate-300" />
	<p class="text-sm font-medium text-slate-600">{title}</p>
	{#if hint}
		<p class="text-sm text-slate-400">{hint}</p>
	{/if}
</div>
