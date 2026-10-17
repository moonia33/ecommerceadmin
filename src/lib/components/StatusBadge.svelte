<script lang="ts">
	import Badge from './Badge.svelte';
	import {
		deliveryStatusLabel,
		eventKindLabel,
		fulfillmentModeLabel,
		jobStatusLabel,
		orderStatusLabel,
		paymentStatusLabel,
		reservationStatusLabel,
		type BadgeTone
	} from '#lib/labels';

	type Kind =
		| 'order'
		| 'payment'
		| 'delivery'
		| 'fulfillment'
		| 'reservation'
		| 'job'
		| 'eventKind';

	let { kind, value }: { kind: Kind; value: string } = $props();

	const maps: Record<Kind, (v: string) => { label: string; tone: BadgeTone }> = {
		order: orderStatusLabel,
		payment: paymentStatusLabel,
		delivery: deliveryStatusLabel,
		fulfillment: fulfillmentModeLabel,
		reservation: reservationStatusLabel,
		job: jobStatusLabel,
		eventKind: eventKindLabel
	};

	const def = $derived(maps[kind](value));
</script>

<Badge label={def.label} tone={def.tone} />
