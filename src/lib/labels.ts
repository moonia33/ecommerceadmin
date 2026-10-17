// Lietuviški statusų ir reikšmių pavadinimai + spalvų tonai Badge komponentui.

export type BadgeTone =
	| 'slate'
	| 'sky'
	| 'amber'
	| 'emerald'
	| 'violet'
	| 'indigo'
	| 'cyan'
	| 'rose'
	| 'orange';

type LabelDef = { label: string; tone: BadgeTone };

const unknown = (value: string): LabelDef => ({ label: value || '—', tone: 'slate' });

export const ORDER_STATUS: Record<string, LabelDef> = {
	pending_payment: { label: 'Laukia apmokėjimo', tone: 'amber' },
	paid: { label: 'Apmokėtas', tone: 'emerald' },
	cancelled: { label: 'Atšauktas', tone: 'rose' },
	new: { label: 'Naujas', tone: 'sky' },
	pending: { label: 'Laukiama', tone: 'amber' },
	reserved: { label: 'Rezervuota', tone: 'violet' },
	packed: { label: 'Supakuota', tone: 'indigo' },
	shipped: { label: 'Išsiųsta', tone: 'cyan' },
	issue: { label: 'Problema', tone: 'rose' }
};

export const PAYMENT_STATUS: Record<string, LabelDef> = {
	pending: { label: 'Laukiama', tone: 'amber' },
	requires_action: { label: 'Reikia veiksmo', tone: 'orange' },
	processing: { label: 'Vykdoma', tone: 'sky' },
	succeeded: { label: 'Apmokėta', tone: 'emerald' },
	paid: { label: 'Apmokėta', tone: 'emerald' },
	captured: { label: 'Apmokėta', tone: 'emerald' },
	partial: { label: 'Dalinai apmokėta', tone: 'orange' },
	failed: { label: 'Nepavyko', tone: 'rose' },
	cancelled: { label: 'Atšaukta', tone: 'rose' },
	disputed: { label: 'Ginčijama', tone: 'rose' }
};

export const DELIVERY_STATUS: Record<string, LabelDef> = {
	pending: { label: 'Nepraruošta', tone: 'slate' },
	awaiting_stock: { label: 'Laukia prekės', tone: 'amber' },
	packing: { label: 'Komplektuojama', tone: 'violet' },
	packed: { label: 'Supakuota', tone: 'indigo' },
	picked_up: { label: 'Perduota vežėjui', tone: 'cyan' },
	in_transit: { label: 'Kelyje', tone: 'cyan' },
	at_pickup_point: { label: 'Atvyko į tašką', tone: 'emerald' },
	delivered: { label: 'Pristatyta', tone: 'emerald' },
	returning: { label: 'Grąžinama', tone: 'orange' },
	returned: { label: 'Grąžinta', tone: 'rose' },
	cancelled: { label: 'Atšaukta', tone: 'rose' },
	error: { label: 'Klaida', tone: 'rose' }
};

export const FULFILLMENT_MODE: Record<string, LabelDef> = {
	stock: { label: 'Sandėlys', tone: 'sky' },
	dropship: { label: 'Dropship', tone: 'violet' },
	mixed: { label: 'Mišrus', tone: 'indigo' }
};

export const RESERVATION_STATUS: Record<string, LabelDef> = {
	not_needed: { label: 'Nereikalinga', tone: 'slate' },
	pending: { label: 'Laukiama', tone: 'amber' },
	reserved: { label: 'Rezervuota', tone: 'emerald' },
	failed: { label: 'Nepavyko', tone: 'rose' },
	cancelled: { label: 'Atšaukta', tone: 'rose' }
};

export const JOB_STATUS: Record<string, LabelDef> = {
	queued: { label: 'Eilėje', tone: 'slate' },
	running: { label: 'Vykdoma', tone: 'sky' },
	success: { label: 'Sėkminga', tone: 'emerald' },
	failed: { label: 'Nepavyko', tone: 'rose' }
};

export const JOB_TYPE: Record<string, string> = {
	orders_bulk_action: 'Masinis užsakymų veiksmas',
	shipment_labels_bulk: 'Masinė lipdukų generacija'
};

export const EVENT_KIND: Record<string, LabelDef> = {
	fulfillment: { label: 'Įvykdymas', tone: 'violet' },
	delivery: { label: 'Pristatymas', tone: 'cyan' },
	payment: { label: 'Mokėjimas', tone: 'amber' },
	note: { label: 'Pastaba', tone: 'slate' }
};

export const EVENT_NAME: Record<string, string> = {
	ops_confirmed: 'Užsakymas patvirtintas',
	ops_assigned: 'Užsakymas priskirtas',
	ops_moved_to_picking: 'Perkelta į komplektavimą',
	ops_label_generated: 'Lipdukas sugeneruotas',
	ops_mark_shipped: 'Pažymėta kaip išsiųsta',
	ops_refresh_tracking: 'Sekimo informacija atnaujinta',
	ops_payment_reconciled: 'Mokėjimas suderintas',
	ops_payment_mark_paid: 'Pažymėta kaip apmokėta',
	ops_payment_refund: 'Inicijuotas grąžinimas'
};

export const SHIPPING_METHOD: Record<string, string> = {
	dpd_locker: 'DPD paštomatas',
	dpd_courier: 'DPD kurjeris',
	unisend_pickup: 'Unisend paštomatas',
	unisend_courier: 'Unisend kurjeris',
	lpexpress: 'LP Express paštomatas',
	lpexpress_courier: 'LP Express kurjeris'
};

export function orderStatusLabel(value: string): LabelDef {
	return ORDER_STATUS[value] ?? unknown(value);
}

export function paymentStatusLabel(value: string): LabelDef {
	return PAYMENT_STATUS[value] ?? unknown(value);
}

export function deliveryStatusLabel(value: string): LabelDef {
	return DELIVERY_STATUS[value] ?? unknown(value);
}

export function fulfillmentModeLabel(value: string): LabelDef {
	return FULFILLMENT_MODE[value] ?? unknown(value);
}

export function reservationStatusLabel(value: string): LabelDef {
	return RESERVATION_STATUS[value] ?? unknown(value);
}

export function jobStatusLabel(value: string): LabelDef {
	return JOB_STATUS[value] ?? unknown(value);
}

export function jobTypeLabel(value: string): string {
	return JOB_TYPE[value] ?? value;
}

export function eventKindLabel(value: string): LabelDef {
	return EVENT_KIND[value] ?? unknown(value);
}

export function eventNameLabel(value: string): string {
	return EVENT_NAME[value] ?? value;
}

export function shippingMethodLabel(value: string): string {
	return SHIPPING_METHOD[value] ?? (value || '—');
}
