<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';

	let { text, class: cls = '', mono = false, iconOnly = false } = $props<{
		text: string;
		class?: string;
		mono?: boolean;
		iconOnly?: boolean;
	}>();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function copy(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1200);
		} catch {
			// clipboard API gali būti neprieinama (http) — ignoruojam
		}
	}
</script>

<span class={`group/ct inline-flex max-w-full items-center gap-1 ${cls}`}>
	{#if !iconOnly}
		<span class={`truncate ${mono ? 'font-mono' : ''}`}>{text}</span>
	{/if}
	<button
		type="button"
		class={`shrink-0 rounded p-0.5 transition-colors ${
			copied ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-600'
		}`}
		title={copied ? 'Nukopijuota' : 'Kopijuoti'}
		aria-label="Kopijuoti"
		onclick={copy}
	>
		{#if copied}
			<Check size={12} />
		{:else}
			<Copy size={12} />
		{/if}
	</button>
</span>
