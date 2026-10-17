<script lang="ts">
	import type { BadgeTone } from '#lib/labels';

	let { label, tone = 'slate' }: { label: string; tone?: BadgeTone } = $props();

	const tones: Record<BadgeTone, string> = {
		slate: 'bg-slate-100 text-slate-700 ring-slate-300',
		sky: 'bg-sky-100 text-sky-800 ring-sky-300',
		amber: 'bg-amber-100 text-amber-800 ring-amber-300',
		emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
		violet: 'bg-violet-100 text-violet-800 ring-violet-300',
		indigo: 'bg-indigo-100 text-indigo-800 ring-indigo-300',
		cyan: 'bg-cyan-100 text-cyan-800 ring-cyan-300',
		rose: 'bg-rose-100 text-rose-800 ring-rose-300',
		orange: 'bg-orange-100 text-orange-800 ring-orange-300'
	};
</script>

<span
	class={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
>
	{label}
</span>
