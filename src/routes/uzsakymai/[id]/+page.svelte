<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		CheckSquare,
		ExternalLink,
		MapPin,
		PackageOpen,
		Printer,
		RefreshCw,
		Truck,
		UserCheck
	} from '@lucide/svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import {
		ApiError,
		addOrderDiscount,
		addOrderLine,
		cancelSurcharge,
		collectSurcharge,
		createShipment,
		fetchLockers,
		fetchOrderAddresses,
		fetchOrderDetail,
		generateLabelForShipment,
		generateShipmentLabel,
		markShipmentShipped,
		markSurchargePaid,
		mediaUrl,
		orderAction,
		paymentAction,
		refreshShipmentTracking,
		removeOrderDiscount,
		cancelInvoice,
		createCreditInvoice,
		fetchInvoiceDetail,
		fetchOrderInvoices,
		invoicePdfUrl,
		issueOrderInvoice,
		resendInvoice,
		addReturnShipment,
		createOrderReturn,
		creditReturn,
		fetchOrderReturns,
		fetchWarehouses,
		receiveReturn,
		setReturnStatus,
		resolveSurcharge,
		searchVariants,
		updateOrderAddress,
		updateOrderLine,
		updateOrderShipping,
		updateOrderSupplier,
		updateShipment,
		type OpsCustomerAddress,
		type OpsInvoice,
		type OpsLockerOption,
		type OpsReturn,
		type OpsWarehouse,
		type OpsOrderDetail,
		type OpsOrderLine,
		type OpsShipmentRow,
		type OpsSurcharge,
		type OpsVariantPicker
	} from '#lib/api/client';
	import { formatDate, formatDateTime, formatMoney } from '#lib/format';
	import { eventKindLabel, eventNameLabel, shippingMethodLabel } from '#lib/labels';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const orderId = $derived(page.params.id ?? '');

	let loading = $state(true);
	let order = $state<OpsOrderDetail | null>(null);
	let busy = $state(false);

	type ActionKind =
		| 'confirm'
		| 'assign'
		| 'move-to-picking'
		| 'mark-paid'
		| 'refund'
		| 'reconcile';

	let actionKind = $state<ActionKind | ''>('');
	let actionPaymentId = $state<number | null>(null);
	let note = $state('');
	let assignee = $state('');

	// --- Shipments / carrier / surcharge ---
	let shippingModalOpen = $state(false);
	let shippingMethod = $state('');
	let shippingLockerId = $state<number | null>(null);
	let lockers = $state<OpsLockerOption[]>([]);
	let lockerCountry = $state('');
	let lockerQuery = $state('');

	let shipmentModal = $state<'create' | 'edit' | ''>('');
	let editingShipment = $state<OpsShipmentRow | null>(null);
	let shKind = $state<'outbound' | 'return'>('outbound');
	let shMethod = $state('');
	let shTracking = $state('');
	let shLockerId = $state<number | null>(null);
	let shNotes = $state('');
	let shStatus = $state('');

	let lineModalOpen = $state(false);
	let lineQuery = $state('');
	let lineResults = $state<OpsVariantPicker[]>([]);
	let lineSearching = $state(false);
	let lineSelected = $state<OpsVariantPicker | null>(null);
	let lineQty = $state(1);
	let lineOnlyActive = $state(true);
	let lineSearchTimer: ReturnType<typeof setTimeout> | null = null;

	let collectModal = $state<OpsSurcharge | null>(null);
	let collectMethod = $state<'montonio' | 'bank_transfer'>('montonio');
	let collectSendEmail = $state(true);

	let supplierModalOpen = $state(false);
	let supStatus = $state('');
	let supRef = $state('');
	let supNotes = $state('');

	let addressModalOpen = $state(false);
	let savedAddresses = $state<OpsCustomerAddress[]>([]);
	let addressMode = $state<'saved' | 'manual'>('manual');
	let selectedAddressId = $state<number | null>(null);
	let addrFullName = $state('');
	let addrCompany = $state('');
	let addrLine1 = $state('');
	let addrCity = $state('');
	let addrPostal = $state('');
	let addrCountry = $state('LT');
	let addrPhone = $state('');
	let addrSaveToCustomer = $state(false);
	let addrSetDefault = $state(false);

	const SHIPPING_METHODS = [
		{ code: 'dpd_locker', label: 'DPD paštomatas' },
		{ code: 'dpd_courier', label: 'DPD kurjeris' },
		{ code: 'unisend_pickup', label: 'Unisend paštomatas' },
		{ code: 'unisend_courier', label: 'Unisend kurjeris' }
	];
	const SHIPMENT_STATUSES = [
		'pending', 'packed', 'picked_up', 'in_transit', 'at_pickup_point',
		'delivered', 'returning', 'returned', 'cancelled', 'error'
	];

	async function loadLockers() {
		try {
			lockers = await fetchLockers({
				country_code: lockerCountry || order?.shipping_country_code || 'LT',
				q: lockerQuery
			});
		} catch {
			lockers = [];
		}
	}

	function openShippingModal() {
		if (!order) return;
		shippingMethod = order.shipping_method;
		shippingLockerId = (order.pickup_point?.raw?.id as number | undefined) ?? null;
		lockerCountry = order.shipping_country_code || 'LT';
		shippingModalOpen = true;
		void loadLockers();
	}

	async function submitShippingChange() {
		if (!order || busy) return;
		busy = true;
		try {
			const res = await updateOrderShipping(order.id, {
				shipping_method: shippingMethod,
				pickup_locker_id: shippingLockerId
			});
			const delta = Number(res.price_delta_gross);
			const balance = Number(res.balance_due);
			let msg = 'Pristatymas pakeistas.';
			if (res.new_shipment_id) msg += ` Sukurta nauja siunta #${res.new_shipment_id}.`;
			if (delta !== 0) msg += ` Kainos skirtumas ${delta > 0 ? '+' : ''}${res.price_delta_gross} ${order.totals.currency}.`;
			if (balance > 0) msg += ' Priemoka įtraukta į suvestinę.';
			else if (balance < 0) msg += ' Permoka įtraukta į suvestinę.';
			pushToast('success', msg);
			shippingModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko pakeisti pristatymo.');
		} finally {
			busy = false;
		}
	}

	function openShipmentCreate() {
		editingShipment = null;
		shKind = 'outbound';
		shMethod = order?.shipping_method ?? '';
		shTracking = '';
		shLockerId = null;
		shNotes = '';
		shStatus = 'pending';
		shipmentModal = 'create';
		void loadLockers();
	}

	function openShipmentEdit(s: OpsShipmentRow) {
		editingShipment = s;
		shKind = s.kind;
		shMethod = s.shipping_method;
		shTracking = s.tracking_number;
		shLockerId = s.pickup_locker_id;
		shNotes = s.notes;
		shStatus = s.status;
		shipmentModal = 'edit';
		void loadLockers();
	}

	async function submitShipment() {
		if (!order || busy) return;
		busy = true;
		try {
			if (shipmentModal === 'create') {
				await createShipment(order.id, {
					kind: shKind,
					shipping_method: shMethod,
					tracking_number: shTracking,
					pickup_locker_id: shLockerId,
					notes: shNotes
				});
			} else if (editingShipment) {
				await updateShipment(editingShipment.id, {
					kind: shKind,
					status: shStatus,
					shipping_method: shMethod,
					tracking_number: shTracking,
					pickup_locker_id: shLockerId,
					notes: shNotes
				});
			}
			pushToast('success', 'Siunta išsaugota.');
			shipmentModal = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Siuntos išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	function openLineModal() {
		lineQuery = '';
		lineResults = [];
		lineSelected = null;
		lineQty = 1;
		lineModalOpen = true;
		void searchLines();
	}

	function onLineQueryInput() {
		if (lineSearchTimer) clearTimeout(lineSearchTimer);
		lineSearchTimer = setTimeout(() => void searchLines(), 300);
	}

	async function searchLines() {
		lineSearching = true;
		try {
			lineResults = await searchVariants({
				q: lineQuery,
				is_active: lineOnlyActive ? 'true' : '',
				limit: 20
			});
		} catch {
			lineResults = [];
		} finally {
			lineSearching = false;
		}
	}

	async function submitAddLine() {
		if (!order || busy) return;
		if (!lineSelected) {
			pushToast('error', 'Pasirinkite prekę.');
			return;
		}
		if (lineQty < 1) {
			pushToast('error', 'Kiekis turi būti bent 1.');
			return;
		}
		busy = true;
		try {
			await addOrderLine(order.id, { variant_id: lineSelected.variant_id, qty: lineQty });
			pushToast('success', 'Prekė pridėta.');
			lineModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Prekės pridėti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function saveLine(
		line: OpsOrderLine,
		payload: { qty?: number; unit_gross?: string; name?: string },
		successMsg: string
	) {
		if (!order || busy) return;
		busy = true;
		try {
			await updateOrderLine(order.id, line.order_line_id, payload);
			pushToast('success', successMsg);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Eilutės pakeisti nepavyko.');
			await load();
		} finally {
			busy = false;
		}
	}

	function saveLineQty(line: OpsOrderLine, raw: string) {
		const qty = Math.max(0, Math.floor(Number(raw)));
		if (Number.isNaN(qty) || qty === line.qty) return;
		void saveLine(line, { qty }, 'Kiekis pakeistas.');
	}

	function saveLinePrice(line: OpsOrderLine, raw: string) {
		const val = raw.trim().replace(',', '.');
		if (!val || Number.isNaN(Number(val)) || val === line.unit_gross) return;
		void saveLine(line, { unit_gross: val }, 'Kaina pakeista.');
	}

	async function removeLine(line: OpsOrderLine) {
		if (!order || busy) return;
		const label = line.name || line.sku;
		if (!window.confirm(`Pašalinti „${label}“ iš užsakymo?`)) return;
		await saveLine(line, { qty: 0 }, 'Eilutė pašalinta.');
	}

	// --- Discounts ---
	let discountModalOpen = $state(false);
	let discountKind = $state<'percent' | 'amount' | 'coupon'>('percent');
	let discountValue = $state('');
	let discountCode = $state('');
	let discountName = $state('');

	async function saveDiscount() {
		if (!order || busy) return;
		const payload: { kind: 'percent' | 'amount' | 'coupon'; value?: string; code?: string; name?: string } = {
			kind: discountKind,
			name: discountName.trim() || undefined
		};
		if (discountKind === 'coupon') {
			if (!discountCode.trim()) return;
			payload.code = discountCode.trim();
		} else {
			const v = discountValue.trim().replace(',', '.');
			if (!v || Number.isNaN(Number(v))) return;
			payload.value = v;
		}
		busy = true;
		try {
			await addOrderDiscount(order.id, payload);
			pushToast('success', 'Nuolaida pritaikyta.');
			discountModalOpen = false;
			discountValue = '';
			discountCode = '';
			discountName = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nuolaidos pritaikyti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function deleteDiscount(id: number) {
		if (!order || busy) return;
		if (!window.confirm('Pašalinti nuolaidą?')) return;
		busy = true;
		try {
			await removeOrderDiscount(order.id, id);
			pushToast('success', 'Nuolaida pašalinta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nuolaidos pašalinti nepavyko.');
		} finally {
			busy = false;
		}
	}

	// --- Invoices / documents ---
	let invoices = $state<OpsInvoice[]>([]);
	let creditModalOpen = $state(false);
	let creditInvoiceId = $state<number | null>(null);
	let creditLines = $state<{ invoice_line_id: number; name: string; qty: number; max: number }[]>([]);
	let creditSendEmail = $state(false);
	let creditDiscount = $state('');

	async function doIssueInvoice() {
		if (!order || busy) return;
		busy = true;
		try {
			await issueOrderInvoice(order.id);
			pushToast('success', 'Sąskaita išrašyta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Sąskaitos išrašyti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function doCancelInvoice(inv: OpsInvoice) {
		if (busy || !window.confirm(`Atšaukti ${inv.number}? Dokumentas liks auditui.`)) return;
		busy = true;
		try {
			await cancelInvoice(inv.id);
			pushToast('success', 'Sąskaita atšaukta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Atšaukti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function doResendInvoice(inv: OpsInvoice) {
		if (busy) return;
		busy = true;
		try {
			await resendInvoice(inv.id);
			pushToast('success', `Sąskaita ${inv.number} išsiųsta el. paštu.`);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Išsiųsti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function openCreditModal(inv: OpsInvoice) {
		creditInvoiceId = inv.id;
		creditSendEmail = false;
		creditDiscount = '';
		creditLines = [];
		try {
			const detail = await fetchInvoiceDetail(inv.id);
			creditLines = detail.lines
				.filter((l) => l.line_type !== 'discount')
				.map((l) => ({
					invoice_line_id: l.id,
					name: l.name,
					qty: l.qty - l.credited_qty,
					max: l.qty - l.credited_qty
				}));
			creditModalOpen = true;
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Sąskaitos įkelti nepavyko.');
		}
	}

	// --- Returns (RMA) ---
	let returns = $state<OpsReturn[]>([]);
	let warehouses = $state<OpsWarehouse[]>([]);
	let returnModalOpen = $state(false);
	let returnLines = $state<{ order_line_id: number; name: string; qty: number; max: number; reason: string }[]>([]);
	let returnNote = $state('');
	let returnApprove = $state(true);
	let returnAllowExpired = $state(false);
	let receiveModalOpen = $state(false);
	let receiveTarget = $state<OpsReturn | null>(null);
	let receiveLines = $state<{ return_line_id: number; name: string; qty: number; max: number }[]>([]);
	let restockWarehouseId = $state<number | null>(null);

	function openReturnModal() {
		if (!order) return;
		returnLines = order.matched_lines
			.filter((l) => l.returnable && l.qty - l.returned_qty > 0)
			.map((l) => ({
				order_line_id: l.order_line_id,
				name: l.name || l.sku,
				qty: l.qty - l.returned_qty,
				max: l.qty - l.returned_qty,
				reason: ''
			}));
		returnNote = '';
		returnApprove = true;
		returnAllowExpired = false;
		returnModalOpen = true;
	}

	async function saveReturn() {
		if (!order || busy) return;
		const selected = returnLines.filter((l) => l.qty > 0);
		if (selected.length === 0) {
			pushToast('error', 'Pasirinkite bent vieną eilutę.');
			return;
		}
		busy = true;
		try {
			await createOrderReturn(order.id, {
				lines: selected.map((l) => ({
					order_line_id: l.order_line_id,
					qty: l.qty,
					reason: l.reason || undefined
				})),
				note: returnNote,
				approve: returnApprove,
				allow_expired: returnAllowExpired
			});
			pushToast('success', 'Grąžinimas sukurtas.');
			returnModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Grąžinimo sukurti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function retStatus(ret: OpsReturn, status: string, label: string) {
		if (busy || !window.confirm(`${label} — ${ret.number}?`)) return;
		busy = true;
		try {
			await setReturnStatus(ret.id, status);
			pushToast('success', `${ret.number}: ${label.toLowerCase()}.`);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Būsenos pakeisti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function retTracking(ret: OpsReturn) {
		const tn = window.prompt('Grąžinimo siuntos tracking numeris:', ret.tracking_number || '');
		if (tn === null || busy) return;
		busy = true;
		try {
			await addReturnShipment(ret.id, { tracking_number: tn.trim() });
			pushToast('success', 'Sekimo numeris išsaugotas.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function openReceiveModal(ret: OpsReturn) {
		receiveTarget = ret;
		receiveLines = ret.lines
			.filter((l) => l.qty - l.received_qty > 0)
			.map((l) => ({
				return_line_id: l.id,
				name: l.name || l.sku,
				qty: l.qty - l.received_qty,
				max: l.qty - l.received_qty
			}));
		if (warehouses.length === 0) {
			warehouses = await fetchWarehouses().catch(() => [] as OpsWarehouse[]);
		}
		const local = warehouses.find((w) => w.kind === 'local');
		restockWarehouseId = local ? local.id : null;
		receiveModalOpen = true;
	}

	async function saveReceive() {
		if (!receiveTarget || busy) return;
		const selected = receiveLines.filter((l) => l.qty > 0);
		if (selected.length === 0) {
			pushToast('error', 'Pasirinkite gautas prekes.');
			return;
		}
		busy = true;
		try {
			await receiveReturn(receiveTarget.id, {
				lines: selected.map((l) => ({ return_line_id: l.return_line_id, qty: l.qty })),
				restock_warehouse_id: restockWarehouseId ?? undefined
			});
			pushToast('success', 'Prekės priimtos.');
			receiveModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Priimti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function doCreditReturn(ret: OpsReturn) {
		if (busy || !window.confirm(`Išrašyti kreditinę sąskaitą už ${ret.number} ir išsiųsti klientui?`)) return;
		busy = true;
		try {
			await creditReturn(ret.id, { send_email: true });
			pushToast('success', 'Kreditinė išrašyta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Kreditinės išrašyti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function saveCredit() {
		if (busy || creditInvoiceId == null) return;
		const selected = creditLines.filter((l) => l.qty > 0);
		const allFull =
			creditLines.length > 0 && creditLines.every((l) => l.qty === l.max);
		if (selected.length === 0 && !allFull) {
			pushToast('error', 'Pasirinkite kredituojamas eilutes.');
			return;
		}
		busy = true;
		try {
			const dg = creditDiscount.trim().replace(',', '.');
			const inv = await createCreditInvoice(creditInvoiceId, {
				lines: allFull ? undefined : selected.map((l) => ({
					invoice_line_id: l.invoice_line_id,
					qty: l.qty
				})),
				discount_gross: dg && !Number.isNaN(Number(dg)) ? dg : undefined,
				send_email: creditSendEmail
			});
			pushToast('success', `Kreditinė ${inv.number} išrašyta.`);
			creditModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Kreditinės išrašyti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function openAddressModal() {
		if (!order) return;
		addrFullName = order.shipping_address.full_name;
		addrCompany = order.shipping_address.company;
		addrLine1 = order.shipping_address.line1;
		addrCity = order.shipping_address.city;
		addrPostal = order.shipping_address.postal_code;
		addrCountry = order.shipping_address.country_code || order.shipping_country_code || 'LT';
		addrPhone = order.shipping_address.phone || order.customer.phone;
		addrSaveToCustomer = false;
		addrSetDefault = false;
		selectedAddressId = null;
		try {
			savedAddresses = await fetchOrderAddresses(order.id);
		} catch {
			savedAddresses = [];
		}
		if (savedAddresses.length) {
			addressMode = 'saved';
			const def = savedAddresses.find((a) => a.is_default_shipping);
			selectedAddressId = def?.id ?? savedAddresses[0].id;
		} else {
			addressMode = 'manual';
		}
		addressModalOpen = true;
	}

	async function submitAddress() {
		if (!order || busy) return;
		busy = true;
		try {
			if (addressMode === 'saved') {
				if (!selectedAddressId) {
					pushToast('error', 'Pasirinkite adresą.');
					return;
				}
				await updateOrderAddress(order.id, { user_address_id: selectedAddressId });
			} else {
				await updateOrderAddress(order.id, {
					full_name: addrFullName,
					company: addrCompany,
					line1: addrLine1,
					city: addrCity,
					postal_code: addrPostal,
					country_code: addrCountry,
					phone: addrPhone,
					save_to_customer: addrSaveToCustomer,
					set_default_shipping: addrSetDefault
				});
			}
			pushToast('success', 'Pristatymo adresas atnaujintas.');
			addressModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Adreso atnaujinti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function submitCollect() {
		if (!collectModal || busy) return;
		busy = true;
		try {
			await collectSurcharge(collectModal.id, {
				method: collectMethod,
				send_email: collectSendEmail
			});
			pushToast('success', 'Priemoka išsiųsta klientui.');
			collectModal = null;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Priemokos išsiųsti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function surchargeAction(s: OpsSurcharge, action: 'paid' | 'resolve' | 'cancel') {
		if (busy) return;
		busy = true;
		try {
			if (action === 'paid') await markSurchargePaid(s.id);
			else if (action === 'resolve') await resolveSurcharge(s.id);
			else await cancelSurcharge(s.id);
			pushToast('success', 'Atnaujinta.');
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	const actionTitle: Record<ActionKind, string> = {
		confirm: 'Patvirtinti užsakymą',
		assign: 'Priskirti vadybininką',
		'move-to-picking': 'Perkelti į komplektavimą',
		'mark-paid': 'Pažymėti mokėjimą apmokėtu',
		refund: 'Inicijuoti pinigų grąžinimą',
		reconcile: 'Suderinti mokėjimą'
	};

	function openSupplier() {
		if (!order) return;
		supStatus = order.supplier_reservation_status || 'not_needed';
		supRef = order.supplier_reference || '';
		supNotes = order.supplier_notes || '';
		supplierModalOpen = true;
	}

	async function saveSupplier() {
		if (!order || busy) return;
		busy = true;
		try {
			await updateOrderSupplier(order.id, {
				supplier_reservation_status: supStatus,
				supplier_reference: supRef.trim(),
				supplier_notes: supNotes
			});
			pushToast('success', 'Tiekėjo rezervacija atnaujinta.');
			supplierModalOpen = false;
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko išsaugoti.');
		} finally {
			busy = false;
		}
	}

	async function load() {
		loading = true;
		try {
			order = await fetchOrderDetail(orderId);
			invoices = await fetchOrderInvoices(order.id).catch(() => [] as OpsInvoice[]);
			returns = await fetchOrderReturns(order.id).catch(() => [] as OpsReturn[]);
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti užsakymo.');
		} finally {
			loading = false;
		}
	}

	function openAction(kind: ActionKind, paymentId: number | null = null) {
		actionKind = kind;
		actionPaymentId = paymentId;
		note = '';
		assignee = '';
	}

	async function runAction() {
		if (!order || !actionKind || busy) return;
		busy = true;
		try {
			if (actionKind === 'mark-paid' || actionKind === 'refund' || actionKind === 'reconcile') {
				await paymentAction(actionPaymentId!, actionKind, { note: note.trim() });
			} else {
				await orderAction(order.id, actionKind, {
					note: note.trim(),
					assignee: assignee.trim()
				});
			}
			pushToast('success', 'Veiksmas atliktas.');
			actionKind = '';
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function runSimple(fn: () => Promise<{ message?: string }>, fallback: string) {
		if (busy) return;
		busy = true;
		try {
			const res = await fn();
			pushToast('success', res.message || fallback);
			await load();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load());

	const inputClass =
		'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const btnSm =
		'rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50';
	const btnSmDanger =
		'rounded-md border border-rose-200 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50';
</script>

<div class="mb-4">
	<a
		href="/uzsakymai"
		class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
	>
		<ArrowLeft size={15} />
		Atgal į užsakymus
	</a>
</div>

{#if loading}
	<Spinner label="Kraunamas užsakymas…" />
{:else if !order}
	<EmptyState title="Užsakymas nerastas" hint="Patikrinkite užsakymo numerį." />
{:else}
	<!-- Antraštė -->
	<div
		class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
	>
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-2xl font-semibold text-slate-900">Užsakymas #{order.id}</h1>
					<StatusBadge kind="order" value={order.status} />
					<StatusBadge kind="payment" value={order.payment_status} />
					<StatusBadge kind="delivery" value={order.delivery_status} />
				</div>
				<p class="mt-1.5 text-sm text-slate-500">
					Sukurtas {formatDateTime(order.created_at)} · Parduotuvė: {order.shop.name ||
						order.shop.code ||
						'—'}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<StatusBadge kind="fulfillment" value={order.fulfillment_mode} />
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-300 ring-inset hover:bg-slate-200"
						onclick={openSupplier}
						title="Keisti tiekėjo rezervaciją"
					>
						Tiekėjo rezervacija: {order.supplier_reservation_status || '—'}
					</button>
					{#if order.supplier_reference}
						<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-300 ring-inset">
							Tiekėjo ref.: {order.supplier_reference}
						</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('confirm')}
					disabled={busy}
				>
					<CheckSquare size={15} /> Patvirtinti
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('assign')}
					disabled={busy}
				>
					<UserCheck size={15} /> Priskirti
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openAction('move-to-picking')}
					disabled={busy}
				>
					<PackageOpen size={15} /> Į komplektavimą
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					onclick={() => void runSimple(() => generateShipmentLabel(order!.id), 'Lipdukas sugeneruotas')}
					disabled={busy}
				>
					<Printer size={15} /> Generuoti lipduką
				</button>
			</div>
		</div>
	</div>

	<div class="mt-5 grid gap-5 xl:grid-cols-3">
		<!-- Klientas -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Klientas</h2>
			<p class="mt-3 text-lg font-semibold text-slate-900">
				{order.customer.full_name || '—'}
			</p>
			<div class="mt-2 space-y-1 text-sm text-slate-600">
				<p>{order.customer.email || '—'}</p>
				<p>{order.customer.phone || order.shipping_address.phone || '—'}</p>
				{#if order.customer.company}
					<p>Įmonė: {order.customer.company}</p>
				{/if}
			</div>
			{#if order.customer.user_id}
				<a
					href={`/klientai/${order.customer.user_id}`}
					class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
				>
					Kliento kortelė <ExternalLink size={13} />
				</a>
			{:else}
				<p class="mt-3 text-xs text-slate-400">Svečio užsakymas</p>
			{/if}
			{#if order.customer_stats}
				<div class="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
					<div>
						<p class="text-lg font-semibold text-slate-900">{order.customer_stats.orders_count}</p>
						<p class="text-xs text-slate-400">Užsakymai</p>
					</div>
					<div>
						<p class="text-lg font-semibold text-slate-900">{order.customer_stats.paid_orders_count}</p>
						<p class="text-xs text-slate-400">Apmokėti</p>
					</div>
					<div>
						<p class="text-lg font-semibold text-slate-900">
							{formatMoney(order.customer_stats.total_spent)}
						</p>
						<p class="text-xs text-slate-400">Iš viso</p>
					</div>
				</div>
			{/if}
		</section>

		<!-- Pristatymas -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Pristatymas</h2>
			<p class="mt-3 flex items-center gap-2 text-sm font-medium text-slate-900">
				<Truck size={15} class="text-slate-400" />
				{shippingMethodLabel(order.shipping_method)}
				{#if order.carrier_code}
					<span class="text-slate-400">({order.carrier_code})</span>
				{/if}
			</p>

			{#if order.pickup_point}
				<div class="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
					<p class="flex items-center gap-1.5 font-medium text-slate-800">
						<MapPin size={14} class="text-sky-600" /> Atsiėmimo taškas
					</p>
					<p class="mt-1 text-slate-700">{order.pickup_point.pickup_point_name || '—'}</p>
					<p class="text-xs text-slate-500">ID: {order.pickup_point.pickup_point_id || '—'}</p>
				</div>
			{/if}

			<div class="mt-3 flex items-start justify-between gap-2">
				<div class="space-y-1 text-sm text-slate-600">
					<p class="font-medium text-slate-800">{order.shipping_address.full_name || '—'}</p>
				{#if order.shipping_address.company}<p>{order.shipping_address.company}</p>{/if}
				<p>{order.shipping_address.line1 || '—'}</p>
				<p>
					{order.shipping_address.city || '—'}
					{order.shipping_address.postal_code || ''}, {order.shipping_address.country_code ||
						order.shipping_country_code}
				</p>
					{#if order.shipping_address.phone}<p>Tel.: {order.shipping_address.phone}</p>{/if}
				</div>
				<button
					type="button"
					class="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => void openAddressModal()}
					disabled={busy}
				>
					Keisti
				</button>
			</div>

			<div class="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
				{#if order.tracking_number}
					<p class="text-slate-600">
						Sekimo nr.: <span class="font-semibold text-slate-900">{order.tracking_number}</span>
					</p>
				{/if}
				{#if order.delivery_min_date || order.delivery_max_date}
					<p class="text-slate-600">
						Numatoma: {formatDate(order.delivery_min_date)} – {formatDate(order.delivery_max_date)}
					</p>
				{/if}
				{#if order.label_pdf_url}
					<a
						href={mediaUrl(order.label_pdf_url)}
						target="_blank"
						rel="noreferrer noopener"
						class="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline"
					>
						<Printer size={14} /> Atsisiųsti lipduką (PDF)
					</a>
				{/if}
			</div>

			<div class="mt-4 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => void runSimple(() => markShipmentShipped(order!.id), 'Pažymėta išsiųsta')}
					disabled={busy}
				>
					Pažymėti išsiųsta
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => void runSimple(() => refreshShipmentTracking(order!.id), 'Sekimo informacija atnaujinta')}
					disabled={busy}
				>
					<RefreshCw size={12} /> Atnauinti sekimą
				</button>
				<button
					type="button"
					class="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
					onclick={openShippingModal}
					disabled={busy}
				>
					Keisti vežėją / paštomatą
				</button>
				{#if order.surcharges?.some((s) => s.status === 'pending')}
					<span
						class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
					>
						Yra laukiančių atsiskaitymų
					</span>
				{/if}
			</div>
		</section>

		<!-- Sumos -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Sumos</h2>
			<dl class="mt-3 space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-slate-500">Prekės (be PVM)</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.items_net, order.totals.currency)}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-500">Pristatymas (be PVM)</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.shipping_net, order.totals.currency)}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-500">PVM</dt>
					<dd class="font-medium text-slate-800">
						{formatMoney(order.totals.total_vat, order.totals.currency)}
					</dd>
				</div>
				{#if Number(order.totals.discounts_gross) > 0}
					<div class="flex justify-between">
						<dt class="text-slate-500">Nuolaida</dt>
						<dd class="font-medium text-emerald-700">
							−{formatMoney(order.totals.discounts_gross, order.totals.currency)}
						</dd>
					</div>
				{/if}
				<div
					class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"
				>
					<dt>Iš viso</dt>
					<dd>{formatMoney(order.totals.total_gross, order.totals.currency)}</dd>
				</div>
				{#if Number(order.totals.paid_gross) > 0}
					<div class="flex justify-between">
						<dt class="text-slate-500">Sumokėta</dt>
						<dd class="font-medium text-slate-800">
							{formatMoney(order.totals.paid_gross, order.totals.currency)}
						</dd>
					</div>
					{#if Number(order.totals.balance_due) !== 0}
						<div class="flex justify-between">
							<dt class="text-slate-500">
								{Number(order.totals.balance_due) > 0 ? 'Priemoka' : 'Permoka'}
							</dt>
							<dd
								class="font-semibold {Number(order.totals.balance_due) > 0
									? 'text-amber-700'
									: 'text-emerald-700'}"
							>
								{formatMoney(order.totals.balance_due, order.totals.currency)}
							</dd>
						</div>
					{/if}
				{/if}
			</dl>
			<div class="mt-4 border-t border-slate-100 pt-3">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Nuolaidos</h3>
					<button
						type="button"
						class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
						onclick={() => (discountModalOpen = true)}
						disabled={busy}
					>
						+ Pridėti nuolaidą
					</button>
				</div>
				{#if order.discounts.length === 0}
					<p class="mt-2 text-xs text-slate-400">Nuolaidų nėra.</p>
				{:else}
					<ul class="mt-2 space-y-1.5">
						{#each order.discounts as d}
							<li class="flex items-center justify-between gap-2 text-sm">
								<span class="text-slate-700">
									{d.kind === 'coupon' ? `Kuponas ${d.code}` : d.name || 'Nuolaida'}
								</span>
								<span class="flex items-center gap-2">
									<span class="font-medium text-emerald-700">
										−{formatMoney(d.gross, order.totals.currency)}
									</span>
									<button
										type="button"
										class="rounded-md border border-rose-200 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
										onclick={() => void deleteDiscount(d.id)}
										disabled={busy}
										aria-label="Pašalinti nuolaidą"
									>
										✕
									</button>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#if order.supplier_notes}
				<div class="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
					<p class="font-medium">Tiekėjo pastabos</p>
					<p class="mt-1">{order.supplier_notes}</p>
				</div>
			{/if}
		</section>

		<!-- Grąžinimai -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Grąžinimai</h2>
				<button
					type="button"
					class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
					onclick={() => openReturnModal()}
					disabled={busy}
				>
					+ Naujas grąžinimas
				</button>
			</div>
			{#if returns.length === 0}
				<p class="mt-3 text-xs text-slate-400">Grąžinimų nėra.</p>
			{:else}
				<ul class="mt-3 divide-y divide-slate-100">
					{#each returns as ret}
						<li class="py-2.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<span class="font-medium text-slate-900">{ret.number}</span>
									<span
										class="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium {{
											pending: 'bg-slate-100 text-slate-600',
											approved: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
											rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
											received: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
											completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
											cancelled: 'bg-slate-100 text-slate-400'
										}[ret.status] || 'bg-slate-100 text-slate-600'}"
									>
										{{
											pending: 'Laukia patvirtinimo',
											approved: 'Patvirtintas',
											rejected: 'Atmestas',
											received: 'Prekės gautos',
											completed: 'Užbaigtas',
											cancelled: 'Atšauktas'
										}[ret.status] || ret.status}
									</span>
								</div>
								<span class="text-xs text-slate-400">{formatDate(ret.created_at)}</span>
							</div>
							<ul class="mt-1.5 space-y-0.5 text-xs text-slate-500">
								{#each ret.lines as rl}
									<li>
										{rl.name || rl.sku} — {rl.qty} vnt.
										{#if rl.received_qty > 0}
											<span class="text-violet-600">· gauta {rl.received_qty}</span>
										{/if}
										{#if rl.credited_qty > 0}
											<span class="text-emerald-600">· kredituota {rl.credited_qty}</span>
										{/if}
									</li>
								{/each}
							</ul>
							<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
								{#if ret.tracking_number}<span>Sekimas: {ret.tracking_number}</span>{/if}
								{#if ret.credit_invoice_number}
									<span>→ Kreditinė {ret.credit_invoice_number}</span>
								{/if}
								<span class="flex-1"></span>
								{#if ret.status === 'pending'}
									<button class={btnSm} onclick={() => void retStatus(ret, 'approved', 'Patvirtinti')} disabled={busy}>Patvirtinti</button>
									<button class={btnSmDanger} onclick={() => void retStatus(ret, 'rejected', 'Atmesti')} disabled={busy}>Atmesti</button>
								{:else if ret.status === 'approved'}
									<button class={btnSm} onclick={() => void retTracking(ret)} disabled={busy}>Sekimas</button>
									<button class={btnSm} onclick={() => void openReceiveModal(ret)} disabled={busy}>Priimti prekes</button>
									<button class={btnSmDanger} onclick={() => void retStatus(ret, 'cancelled', 'Atšaukti')} disabled={busy}>Atšaukti</button>
								{:else if ret.status === 'received'}
									<button class={btnSm} onclick={() => void doCreditReturn(ret)} disabled={busy}>Kreditinė</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Dokumentai -->
		<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Dokumentai</h2>
				{#if !invoices.some((i) => i.kind === 'sales' && i.status === 'issued')}
					<button
						type="button"
						class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
						onclick={() => void doIssueInvoice()}
						disabled={busy}
					>
						Išrašyti sąskaitą
					</button>
				{/if}
			</div>
			{#if invoices.length === 0}
				<p class="mt-3 text-xs text-slate-400">
					Sąskaitų nėra. Sąskaita išrašoma automatiškai, kai užsakymas pristatomas,
					arba rankiniu būdu — mygtuku aukščiau.
				</p>
			{:else}
				<ul class="mt-3 divide-y divide-slate-100">
					{#each invoices as inv}
						<li class="py-2.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<span class="font-medium text-slate-900">{inv.number}</span>
									<span
										class="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium {inv.kind ===
										'credit'
											? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
											: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'}"
									>
										{inv.kind === 'credit' ? 'Kreditinė' : 'Sąskaita'}
									</span>
									{#if inv.status === 'cancelled'}
										<span
											class="ml-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-200"
											>Atšaukta</span
										>
									{/if}
								</div>
								<span class="text-sm font-semibold text-slate-800">
									{formatMoney(inv.total_gross, inv.currency)}
								</span>
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
								<span>{formatDate(inv.issue_date)}</span>
								{#if inv.credit_of_number}<span>→ {inv.credit_of_number}</span>{/if}
								{#if inv.emailed_at}<span>· išsiųsta {formatDateTime(inv.emailed_at)}</span>{/if}
								<span class="flex-1"></span>
								<a
									href={invoicePdfUrl(inv.id)}
									target="_blank"
									class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
									>PDF</a
								>
								<button
									type="button"
									class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
									onclick={() => void doResendInvoice(inv)}
									disabled={busy}>El. paštu</button
								>
								{#if inv.kind === 'sales' && inv.status === 'issued'}
									<button
										type="button"
										class="rounded-md border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50 disabled:opacity-50"
										onclick={() => void openCreditModal(inv)}
										disabled={busy}>Kredituoti</button
									>
								{/if}
								{#if inv.status === 'issued'}
									<button
										type="button"
										class="rounded-md border border-rose-200 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
										onclick={() => void doCancelInvoice(inv)}
										disabled={busy}>Atšaukti</button
									>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- Siuntos -->
	<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
			<h2 class="text-base font-semibold text-slate-900">
				Siuntos <span class="text-slate-400">({order.shipments?.length ?? 0})</span>
			</h2>
			<button
				type="button"
				class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
				onclick={openShipmentCreate}
				disabled={busy}
			>
				+ Pridėti siuntą
			</button>
		</div>
		{#if !order.shipments || order.shipments.length === 0}
			<EmptyState title="Siuntų nėra" hint="Lipduko generavimas sukurs siuntą automatiškai." />
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-5 py-2.5 font-medium">#</th>
							<th class="px-4 py-2.5 font-medium">Tipas</th>
							<th class="px-4 py-2.5 font-medium">Būsena</th>
							<th class="px-4 py-2.5 font-medium">Vežėjas / būdas</th>
							<th class="px-4 py-2.5 font-medium">Sekimo nr.</th>
							<th class="px-4 py-2.5 font-medium">Paštomatas</th>
							<th class="px-5 py-2.5 text-right font-medium">Veiksmai</th>
						</tr>
					</thead>
					<tbody>
						{#each order.shipments as s}
							<tr class="border-t border-slate-100">
								<td class="px-5 py-3 font-medium text-slate-800">S{s.id}</td>
								<td class="px-4 py-3">
									<span
										class={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
											s.kind === 'return'
												? 'bg-amber-50 text-amber-700 ring-amber-200'
												: 'bg-slate-50 text-slate-600 ring-slate-200'
										}`}
									>
										{s.kind === 'return' ? 'Grąžinimas' : 'Siuntimas'}
									</span>
								</td>
								<td class="px-4 py-3"><StatusBadge kind="delivery" value={s.status} /></td>
								<td class="px-4 py-3 text-slate-600">
									{s.carrier_code || '—'} / {shippingMethodLabel(s.shipping_method)}
								</td>
								<td class="px-4 py-3 font-mono text-xs text-slate-700">{s.tracking_number || '—'}</td>
								<td class="px-4 py-3 text-xs text-slate-600">{s.pickup_point_name || '—'}</td>
								<td class="px-5 py-3">
									<div class="flex justify-end gap-2">
										{#if s.label_url}
											<a
												href={s.label_url}
												target="_blank"
												rel="noreferrer noopener"
												class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
											>
												PDF
											</a>
										{/if}
										<button
											type="button"
											class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
											onclick={() =>
												void runSimple(
													() => generateLabelForShipment(s.id),
													'Lipdukas sugeneruotas'
												)}
											disabled={busy || s.kind === 'return'}
										>
											Lipdukas
										</button>
										<button
											type="button"
											class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
											onclick={() => openShipmentEdit(s)}
											disabled={busy}
										>
											Redaguoti
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Priemokos -->
	{#if order.surcharges && order.surcharges.length > 0}
		<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Atsiskaitymai</h2>
			</div>
			<div class="divide-y divide-slate-100">
				{#each order.surcharges as s}
					<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
						<div>
							<span class="font-medium text-slate-900">
								{formatMoney(s.amount_gross, s.currency)}
							</span>
							<span
								class="ml-2 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {s.direction ===
								'refund'
									? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
									: 'bg-amber-50 text-amber-700 ring-amber-200'}"
							>
								{s.direction === 'refund' ? 'Permoka' : 'Priemoka'}
							</span>
							{#if s.method}
								<span class="ml-2 text-sm text-slate-500">
									{s.method === 'montonio' ? 'Montonio nuoroda' : 'Bankinis pavedimas'}
								</span>
							{:else}
								<span class="ml-2 text-sm text-slate-400">nepasirinktas būdas</span>
							{/if}
							{#if s.source === 'auto'}
								<span class="ml-1 text-xs text-slate-400">(auto)</span>
							{/if}
							{#if s.reason}<p class="text-xs text-slate-400">{s.reason}</p>{/if}
						</div>
						<div class="flex items-center gap-2">
							<StatusBadge kind="payment" value={s.status} />
							{#if s.payment_url}
								<a
									href={s.payment_url}
									target="_blank"
									rel="noreferrer noopener"
									class="text-xs font-medium text-sky-600 hover:underline"
								>
									Mokėjimo nuoroda
								</a>
							{/if}
							{#if s.status === 'pending'}
								{#if s.direction === 'charge'}
									<button
										type="button"
										class="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
										onclick={() => {
											collectModal = s;
											collectMethod = 'montonio';
											collectSendEmail = true;
										}}
										disabled={busy}
									>
										Išsiųsti klientui
									</button>
									<button
										type="button"
										class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
										onclick={() => void surchargeAction(s, 'paid')}
										disabled={busy}
									>
										Sumokėta
									</button>
								{:else}
									<button
										type="button"
										class="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
										onclick={() => void surchargeAction(s, 'resolve')}
										disabled={busy}
									>
										Grąžinta
									</button>
								{/if}
								<button
									type="button"
									class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
									onclick={() => void surchargeAction(s, 'cancel')}
									disabled={busy}
								>
									Atšaukti
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Prekės -->
	<section class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
			<h2 class="text-base font-semibold text-slate-900">
				Prekės <span class="text-slate-400">({order.matched_lines.length})</span>
			</h2>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
					onclick={openLineModal}
					disabled={busy}
				>
					+ Pridėti prekę
				</button>
			</div>
		</div>
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-5 py-2.5 font-medium">Prekė</th>
						<th class="px-4 py-2.5 font-medium">SKU</th>
						<th class="px-4 py-2.5 font-medium">Gamintojas</th>
						<th class="px-4 py-2.5 font-medium">Sandėlis</th>
						<th class="px-4 py-2.5 text-right font-medium">Kiekis</th>
						<th class="px-4 py-2.5 text-right font-medium">Vnt. kaina</th>
						<th class="px-5 py-2.5 text-right font-medium">Suma</th>
						<th class="px-4 py-2.5 text-right font-medium"></th>
					</tr>
				</thead>
				<tbody>
					{#each order.matched_lines as line}
						<tr class="border-t border-slate-100">
							<td class="px-5 py-3">
								<div class="flex items-center gap-3">
									{#if line.thumbnail_url}
										<img
											src={mediaUrl(line.thumbnail_url)}
											alt={line.product_name || line.name}
											class="h-10 w-10 rounded-lg border border-slate-200 object-cover"
										/>
									{/if}
									<span class="font-medium text-slate-800">{line.product_name || line.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 font-mono text-xs text-slate-600">{line.sku || '—'}</td>
							<td class="px-4 py-3 text-slate-600">{line.brand_name || '—'}</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-slate-800">{line.warehouse_code || '—'}</span>
									{#if line.warehouse_kind === 'remote'}
										<span class="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 ring-inset">
											Nuotolinis
										</span>
									{/if}
								</div>
								<div class="text-xs text-slate-400">{line.warehouse_name}</div>
							</td>
							<td class="px-4 py-3 text-right">
								<input
									type="number"
									min="0"
									step="1"
									value={line.qty}
									disabled={busy}
									onchange={(e) => saveLineQty(line, e.currentTarget.value)}
									class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none disabled:opacity-50"
								/>
							</td>
							<td class="px-4 py-3 text-right">
								<input
									type="text"
									inputmode="decimal"
									value={line.unit_gross}
									disabled={busy}
									onchange={(e) => saveLinePrice(line, e.currentTarget.value)}
									class="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none disabled:opacity-50"
								/>
							</td>
							<td class="px-5 py-3 text-right font-semibold text-slate-900">
								{formatMoney(line.line_total_gross, order.amount_currency)}
							</td>
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
									onclick={() => void removeLine(line)}
									disabled={busy}
								>
									Šalinti
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="mt-5 grid gap-5 xl:grid-cols-2">
		<!-- Mokėjimai -->
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Mokėjimai</h2>
			</div>
			{#if order.payments.length === 0}
				<EmptyState title="Mokėjimų nėra" />
			{:else}
				<div class="divide-y divide-slate-100">
					{#each order.payments as payment}
						<div class="px-5 py-3.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<span class="font-medium text-slate-900">#{payment.id}</span>
									<span class="ml-2 text-sm text-slate-500">{payment.provider}</span>
								</div>
								<StatusBadge kind="payment" value={payment.status} />
							</div>
							<p class="mt-1 text-sm text-slate-600">
								{formatMoney(payment.amount_gross, payment.currency)} ·
								{formatDateTime(payment.created_at)}
								{#if payment.external_id}
									· <span class="text-xs text-slate-400">ext: {payment.external_id}</span>
								{/if}
							</p>
							<div class="mt-2 flex flex-wrap gap-2">
								<button
									type="button"
									class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
									onclick={() => openAction('mark-paid', payment.id)}
									disabled={busy || payment.status === 'succeeded'}
								>
									Pažymėti apmokėtu
								</button>
								<button
									type="button"
									class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
									onclick={() => openAction('reconcile', payment.id)}
									disabled={busy}
								>
									Suderinti
								</button>
								<button
									type="button"
									class="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
									onclick={() => openAction('refund', payment.id)}
									disabled={busy || payment.status === 'cancelled'}
								>
									Grąžinti
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Įvykiai -->
		<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Įvykių istorija</h2>
			</div>
			{#if order.events.length === 0}
				<EmptyState title="Įvykių dar nėra" />
			{:else}
				<ul class="max-h-96 divide-y divide-slate-100 overflow-y-auto">
					{#each order.events as event}
						<li class="px-5 py-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm font-medium text-slate-800">
									{eventNameLabel(event.name)}
								</span>
								<StatusBadge kind="eventKind" value={event.kind} />
							</div>
							<p class="mt-0.5 text-xs text-slate-400">
								{formatDateTime(event.created_at)}
								{#if event.actor_label}· {event.actor_label}{/if}
							</p>
							{#if event.payload && Object.keys(event.payload).length > 0}
								<p class="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs break-all text-slate-500">
									{JSON.stringify(event.payload)}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}

<!-- Veiksmo modalas -->
<Modal
	bind:open={
		() => actionKind !== '',
		(v) => {
			if (!v) actionKind = '';
		}
	}
	title={actionKind ? actionTitle[actionKind] : ''}
	subtitle={actionKind === 'mark-paid' || actionKind === 'refund' || actionKind === 'reconcile'
		? `Mokėjimas #${actionPaymentId ?? ''}`
		: `Užsakymas #${order?.id ?? ''}`}
>
	{#if actionKind === 'assign'}
		<label class="block text-sm font-medium text-slate-700" for="assignee">Vadybininkas</label>
		<input
			id="assignee"
			class={`${inputClass} mt-1`}
			placeholder="Pvz.: Vardas arba operatoriaus kodas"
			bind:value={assignee}
		/>
	{/if}
	{#if actionKind === 'refund'}
		<p class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
			Grąžinimas atšauks mokėjimą ir užsakymą bei atleis rezervuotas prekės.
		</p>
	{/if}
	<label class="block text-sm font-medium text-slate-700" for="action-note">Pastaba</label>
	<textarea
		id="action-note"
		class={`${inputClass} mt-1`}
		rows="3"
		placeholder="Trumpa pastaba (bus matoma įvykių istorijoje)"
		bind:value={note}
	></textarea>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (actionKind = '')}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void runAction()}
			disabled={busy}
		>
			{busy ? 'Vykdoma…' : 'Vykdyti'}
		</button>
	{/snippet}
</Modal>

<!-- Pristatymo keitimas -->
<Modal
	bind:open={
		() => shippingModalOpen,
		(v) => {
			if (!v) shippingModalOpen = false;
		}
	}
	title="Keisti vežėją / paštomatą"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<label class="block text-sm font-medium text-slate-700" for="ship-method">Pristatymo būdas</label>
	<select id="ship-method" class={`${inputClass} mt-1`} bind:value={shippingMethod}>
		{#each SHIPPING_METHODS as m}
			<option value={m.code}>{m.label}</option>
		{/each}
	</select>

	{#if shippingMethod === 'dpd_locker' || shippingMethod === 'unisend_pickup'}
		<div class="mt-3 flex gap-2">
			<select
				class={`${inputClass} w-24`}
				bind:value={lockerCountry}
				onchange={() => void loadLockers()}
			>
				<option value="LT">LT</option>
				<option value="LV">LV</option>
				<option value="EE">EE</option>
			</select>
			<input
				class={inputClass}
				placeholder="Ieškoti paštomato…"
				bind:value={lockerQuery}
				oninput={() => void loadLockers()}
			/>
		</div>
		<select class={`${inputClass} mt-2`} bind:value={shippingLockerId}>
			<option value={null}>— Pasirinkite paštomatą —</option>
			{#each lockers as l}
				<option value={l.id}>{l.name} — {l.city}, {l.address}</option>
			{/each}
		</select>
	{/if}
	<p class="mt-3 text-xs text-slate-400">
		Jei naujas būdas brangesnis — kainos skirtumas bus parodytas ir galėsite sukurti priemoką.
	</p>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (shippingModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitShippingChange()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>

<!-- Siuntos kūrimas / redagavimas -->
<Modal
	bind:open={
		() => shipmentModal !== '',
		(v) => {
			if (!v) shipmentModal = '';
		}
	}
	title={shipmentModal === 'edit' ? `Siunta S${editingShipment?.id ?? ''}` : 'Nauja siunta'}
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-slate-700" for="sh-kind">Tipas</label>
			<select id="sh-kind" class={`${inputClass} mt-1`} bind:value={shKind}>
				<option value="outbound">Siuntimas klientui</option>
				<option value="return">Grąžinimas siuntėjui</option>
			</select>
		</div>
		{#if shipmentModal === 'edit'}
			<div>
				<label class="block text-sm font-medium text-slate-700" for="sh-status">Būsena</label>
				<select id="sh-status" class={`${inputClass} mt-1`} bind:value={shStatus}>
					{#each SHIPMENT_STATUSES as s}
						<option value={s}>{s}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-method">Pristatymo būdas</label>
	<select id="sh-method" class={`${inputClass} mt-1`} bind:value={shMethod}>
		{#each SHIPPING_METHODS as m}
			<option value={m.code}>{m.label}</option>
		{/each}
	</select>
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-tracking">
		Sekimo numeris
	</label>
	<input id="sh-tracking" class={`${inputClass} mt-1`} bind:value={shTracking} />
	{#if shMethod === 'dpd_locker' || shMethod === 'unisend_pickup'}
		<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-locker">Paštomatas</label>
		<select id="sh-locker" class={`${inputClass} mt-1`} bind:value={shLockerId}>
			<option value={null}>— Nepasirinkta —</option>
			{#each lockers as l}
				<option value={l.id}>{l.name} — {l.city}, {l.address}</option>
			{/each}
		</select>
	{/if}
	<label class="mt-3 block text-sm font-medium text-slate-700" for="sh-notes">Pastabos</label>
	<textarea id="sh-notes" class={`${inputClass} mt-1`} rows="2" bind:value={shNotes}></textarea>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (shipmentModal = '')}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitShipment()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>

<!-- Pridėti prekę -->
<Modal
	bind:open={
		() => lineModalOpen,
		(v) => {
			if (!v) lineModalOpen = false;
		}
	}
	title="Pridėti prekę"
	subtitle={`Užsakymas #${order?.id ?? ''} — suma perskaičiuojama automatiškai`}
>
	<div class="flex items-center gap-3">
		<input
			class={`${inputClass} flex-1`}
			placeholder="Ieškoti pagal pavadinimą, SKU arba barkodą…"
			bind:value={lineQuery}
			oninput={onLineQueryInput}
		/>
		<label class="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
			<input
				type="checkbox"
				class="rounded border-slate-300"
				bind:checked={lineOnlyActive}
				onchange={() => void searchLines()}
			/>
			Aktyvios
		</label>
	</div>

	<div class="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
		{#if lineSearching}
			<div class="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-400">
				<Spinner /> Ieškoma…
			</div>
		{:else if lineResults.length === 0}
			<p class="px-4 py-6 text-center text-sm text-slate-400">
				{lineQuery.trim() ? 'Nieko nerasta' : 'Įveskite paieškos frazę'}
			</p>
		{:else}
			<div class="divide-y divide-slate-100">
				{#each lineResults as v}
					<button
						type="button"
						class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 {lineSelected?.variant_id ===
						v.variant_id
							? 'bg-sky-50 ring-1 ring-sky-300 ring-inset'
							: ''}"
						onclick={() => (lineSelected = v)}
					>
						{#if v.thumbnail_url}
							<img
								src={mediaUrl(v.thumbnail_url)}
								alt={v.product_name}
								class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-slate-800">
								{v.product_name || v.name}
								{#if v.name && v.name !== v.product_name}
									<span class="text-slate-500">— {v.name}</span>
								{/if}
							</p>
							<p class="truncate text-xs text-slate-500">
								{v.sku}{#if v.barcode} · {v.barcode}{/if} · likutis: {v.stock_available}
								{#if !v.is_active}<span class="text-rose-500"> · neaktyvus</span>{/if}
							</p>
						</div>
						<span class="shrink-0 text-sm font-semibold text-slate-900">
							{formatMoney(v.unit_gross, order?.amount_currency ?? 'EUR')}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-3 flex items-center gap-3">
		<label class="block text-sm font-medium text-slate-700" for="al-qty">Kiekis</label>
		<input
			id="al-qty"
			type="number"
			min="1"
			class={`${inputClass} w-24`}
			bind:value={lineQty}
		/>
		{#if lineSelected}
			<p class="text-sm text-slate-600">
				Pasirinkta: <span class="font-medium">{lineSelected.sku}</span>
			</p>
		{/if}
	</div>
	<p class="mt-2 text-xs text-slate-500">
		Jei užsakymas apmokėtas — skirtumas automatiškai atsiras suvestinėje kaip priemoka.
	</p>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (lineModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitAddLine()}
			disabled={busy || !lineSelected}
		>
			{busy ? 'Saugoma…' : 'Pridėti'}
		</button>
	{/snippet}
</Modal>

<!-- Priemokos išsiuntimas -->
<Modal
	bind:open={
		() => collectModal !== null,
		(v) => {
			if (!v) collectModal = null;
		}
	}
	title="Priemokos išsiuntimas"
	subtitle={`Užsakymas #${order?.id ?? ''} — ${collectModal ? formatMoney(collectModal.amount_gross, collectModal.currency) : ''}`}
>
	{#if collectModal}
		{#if collectModal.reason}
			<p class="mb-3 text-sm text-slate-600">{collectModal.reason}</p>
		{/if}
		<label class="block text-sm font-medium text-slate-700" for="cl-method">
			Apmokėjimo būdas
		</label>
		<select id="cl-method" class={`${inputClass} mt-1`} bind:value={collectMethod}>
			<option value="montonio">Montonio mokėjimo nuoroda</option>
			<option value="bank_transfer">Paprastas pavedimas</option>
		</select>
		<label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
			<input type="checkbox" bind:checked={collectSendEmail} class="rounded border-slate-300" />
			Išsiųsti laišką klientui
		</label>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (collectModal = null)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitCollect()}
			disabled={busy}
		>
			{busy ? 'Siunčiama…' : 'Išsiųsti'}
		</button>
	{/snippet}
</Modal>

<!-- Pristatymo adresas -->
<Modal
	bind:open={
		() => addressModalOpen,
		(v) => {
			if (!v) addressModalOpen = false;
		}
	}
	title="Pristatymo adresas"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	{#if savedAddresses.length}
		<div class="mb-4 flex gap-2">
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 text-xs font-medium {addressMode === 'saved'
					? 'bg-sky-600 text-white'
					: 'border border-slate-300 text-slate-600 hover:bg-slate-50'}"
				onclick={() => (addressMode = 'saved')}
			>
				Iš kliento adresų ({savedAddresses.length})
			</button>
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 text-xs font-medium {addressMode === 'manual'
					? 'bg-sky-600 text-white'
					: 'border border-slate-300 text-slate-600 hover:bg-slate-50'}"
				onclick={() => (addressMode = 'manual')}
			>
				Įvesti naują
			</button>
		</div>
	{/if}

	{#if addressMode === 'saved' && savedAddresses.length}
		<div class="max-h-72 space-y-2 overflow-y-auto">
			{#each savedAddresses as a}
				<label
					class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 {selectedAddressId ===
					a.id
						? 'border-sky-400 bg-sky-50 ring-1 ring-sky-300'
						: 'border-slate-200 hover:bg-slate-50'}"
				>
					<input
						type="radio"
						name="saved-addr"
						class="mt-1"
						checked={selectedAddressId === a.id}
						onchange={() => (selectedAddressId = a.id)}
					/>
					<div class="text-sm">
						<p class="font-medium text-slate-800">
							{a.full_name || '—'}
							{#if a.is_default_shipping}
								<span class="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200 ring-inset">
									numatytasis
								</span>
							{/if}
							{#if a.label}<span class="ml-1 text-xs text-slate-400">({a.label})</span>{/if}
						</p>
						{#if a.company}<p class="text-slate-600">{a.company}</p>{/if}
						<p class="text-slate-600">
							{a.line1}, {a.city}, {a.postal_code}, {a.country_code}
						</p>
						{#if a.phone}<p class="text-xs text-slate-500">Tel.: {a.phone}</p>{/if}
					</div>
				</label>
			{/each}
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3">
			<label class="col-span-2 block text-sm font-medium text-slate-700">
				Vardas, pavardė
				<input class={`${inputClass} mt-1`} bind:value={addrFullName} />
			</label>
			<label class="col-span-2 block text-sm font-medium text-slate-700">
				Įmonė (nebūtina)
				<input class={`${inputClass} mt-1`} bind:value={addrCompany} />
			</label>
			<label class="col-span-2 block text-sm font-medium text-slate-700">
				Gatvė, namas, butas
				<input class={`${inputClass} mt-1`} bind:value={addrLine1} />
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Miestas
				<input class={`${inputClass} mt-1`} bind:value={addrCity} />
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Pašto kodas
				<input class={`${inputClass} mt-1`} bind:value={addrPostal} />
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Šalis
				<input class={`${inputClass} mt-1`} bind:value={addrCountry} maxlength="2" />
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Telefonas
				<input class={`${inputClass} mt-1`} bind:value={addrPhone} />
			</label>
		</div>
		{#if order?.customer.user_id}
			<label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
				<input type="checkbox" bind:checked={addrSaveToCustomer} class="rounded border-slate-300" />
				Išsaugoti kaip kliento adresą
			</label>
			{#if addrSaveToCustomer}
				<label class="mt-2 flex items-center gap-2 text-sm text-slate-700">
					<input
						type="checkbox"
						bind:checked={addrSetDefault}
						class="rounded border-slate-300"
					/>
					Pažymėti kaip numatytąjį pristatymo adresą
				</label>
			{/if}
		{/if}
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (addressModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void submitAddress()}
			disabled={busy || (addressMode === 'saved' && !selectedAddressId)}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={
		() => supplierModalOpen,
		(v) => {
			if (!v) supplierModalOpen = false;
		}
	}
	title="Tiekėjo rezervacija"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<label class="block text-sm font-medium text-slate-700">
		Būsena
		<select class={`${inputClass} mt-1`} bind:value={supStatus}>
			<option value="not_needed">Nereikalinga</option>
			<option value="pending">Laukiama tiekėjo patvirtinimo</option>
			<option value="reserved">Rezervuota pas tiekėją</option>
			<option value="failed">Nepavyko rezervuoti</option>
			<option value="cancelled">Atšaukta</option>
		</select>
	</label>
	<label class="mt-3 block text-sm font-medium text-slate-700">
		Tiekėjo nuoroda / PO nr.
		<input class={`${inputClass} mt-1`} bind:value={supRef} placeholder="Pvz.: SUP-2024-1234" />
	</label>
	<label class="mt-3 block text-sm font-medium text-slate-700">
		Pastabos
		<textarea
			class={`${inputClass} mt-1 min-h-[80px]`}
			bind:value={supNotes}
			placeholder="Pvz.: tiekėjas patvirtino atvykimą po 5 d.d."
		></textarea>
	</label>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (supplierModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void saveSupplier()}
			disabled={busy}
		>
			{busy ? 'Saugoma…' : 'Išsaugoti'}
		</button>
	{/snippet}
</Modal>


<Modal
	bind:open={
		() => discountModalOpen,
		(v) => {
			if (!v) discountModalOpen = false;
		}
	}
	title="Pridėti nuolaidą"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	<div class="flex gap-2">
		{#each [
			['percent', 'Procentais'],
			['amount', 'Suma €'],
			['coupon', 'Kuponas']
		] as [kind, label]}
			<button
				type="button"
				class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium {discountKind === kind
					? 'border-sky-500 bg-sky-50 text-sky-700'
					: 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
				onclick={() => (discountKind = kind as 'percent' | 'amount' | 'coupon')}
			>
				{label}
			</button>
		{/each}
	</div>
	{#if discountKind === 'coupon'}
		<label class="mt-4 block text-sm font-medium text-slate-700">
			Kupono kodas
			<input
				class={`${inputClass} mt-1`}
				bind:value={discountCode}
				placeholder="Pvz.: sale10"
			/>
		</label>
	{:else}
		<label class="mt-4 block text-sm font-medium text-slate-700">
			{discountKind === 'percent' ? 'Nuolaida %' : 'Nuolaida € (su PVM)'}
			<input
				class={`${inputClass} mt-1`}
				bind:value={discountValue}
				inputmode="decimal"
				placeholder={discountKind === 'percent' ? 'Pvz.: 10' : 'Pvz.: 5.00'}
			/>
		</label>
	{/if}
	<label class="mt-3 block text-sm font-medium text-slate-700">
		Pavadinimas (nebūtina)
		<input class={`${inputClass} mt-1`} bind:value={discountName} placeholder="Pvz.: lojalumo nuolaida" />
	</label>
	<p class="mt-3 text-xs text-slate-400">
		Nuolaida taikoma prekėms (kaip kuponai). Jei užsakymas apmokėtas — sumos skirtumas
		automatiškai atsiras „Atsiskaitymų“ bloke kaip permoka.
	</p>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (discountModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void saveDiscount()}
			disabled={busy || (discountKind === 'coupon' ? !discountCode.trim() : !discountValue.trim())}
		>
			{busy ? 'Saugoma…' : 'Pritaikyti'}
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={
		() => creditModalOpen,
		(v) => {
			if (!v) creditModalOpen = false;
		}
	}
	title="Kreditinė sąskaita"
	subtitle="Pasirinkite kredituojamas eilutes (viskas = pilnas kreditas)"
>
	{#if creditLines.length === 0}
		<p class="text-sm text-slate-500">Sąskaita neturi eilučių.</p>
	{:else}
		<ul class="space-y-2">
			{#each creditLines as l, i}
				<li class="flex items-center justify-between gap-3 text-sm">
					<span class="flex-1 text-slate-700">{l.name}</span>
					{#if l.max <= 0}
						<span class="text-xs text-slate-400">Jau kredituota</span>
					{:else}
						<span class="text-xs text-slate-400">iš {l.max}</span>
						<input
							type="number"
							min="0"
							max={l.max}
							step="1"
							bind:value={creditLines[i].qty}
							class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none"
						/>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<label class="mt-4 block text-sm font-medium text-slate-700">
		Nuolaidos grąžinimas € (su PVM)
		<input
			class={`${inputClass} mt-1`}
			bind:value={creditDiscount}
			inputmode="decimal"
			placeholder="Tuščia = proporcingai automatiškai"
		/>
	</label>
	<p class="mt-1.5 text-xs text-slate-400">
		Tuščia — nuolaida kredituojama proporcingai kredituojamų prekių sumai.
		Įveskite sumą, jei grąžinate visą arba kitokią nuolaidos dalį.
	</p>
	<label class="mt-4 flex items-center gap-2 text-sm text-slate-700">
		<input type="checkbox" bind:checked={creditSendEmail} class="rounded border-slate-300" />
		Išsiųsti klientui el. paštu
	</label>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (creditModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void saveCredit()}
			disabled={busy || creditLines.length === 0}
		>
			{busy ? 'Išrašoma…' : 'Išrašyti kreditinę'}
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={
		() => returnModalOpen,
		(v) => {
			if (!v) returnModalOpen = false;
		}
	}
	title="Naujas grąžinimas"
	subtitle={`Užsakymas #${order?.id ?? ''}`}
>
	{#if returnLines.length === 0}
		<p class="text-sm text-slate-500">
			Nėra eilučių, kurias būtų galima grąžinti (negrąžinamos prekės arba jau grąžinta).
		</p>
	{:else}
		<ul class="max-h-72 space-y-2 overflow-y-auto">
			{#each returnLines as l, i}
				<li class="text-sm">
					<div class="flex items-center justify-between gap-3">
						<span class="flex-1 text-slate-700">{l.name}</span>
						<span class="text-xs text-slate-400">iš {l.max}</span>
						<input
							type="number"
							min="0"
							max={l.max}
							step="1"
							bind:value={returnLines[i].qty}
							class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none"
						/>
					</div>
					<input
						class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none"
						bind:value={returnLines[i].reason}
						placeholder="Priežastis (nebūtina)"
					/>
				</li>
			{/each}
		</ul>
	{/if}
	<label class="mt-3 block text-sm font-medium text-slate-700">
		Pastaba
		<textarea class={`${inputClass} mt-1 min-h-[60px]`} bind:value={returnNote}></textarea>
	</label>
	<label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
		<input type="checkbox" bind:checked={returnApprove} class="rounded border-slate-300" />
		Patvirtinti iš karto
	</label>
	<label class="mt-2 flex items-center gap-2 text-sm text-slate-700">
		<input type="checkbox" bind:checked={returnAllowExpired} class="rounded border-slate-300" />
		Leisti pasibaigus grąžinimo terminui
	</label>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (returnModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void saveReturn()}
			disabled={busy || returnLines.length === 0}
		>
			{busy ? 'Kuriama…' : 'Sukurti'}
		</button>
	{/snippet}
</Modal>

<Modal
	bind:open={
		() => receiveModalOpen,
		(v) => {
			if (!v) receiveModalOpen = false;
		}
	}
	title="Priimti grąžinamas prekes"
	subtitle={receiveTarget?.number ?? ''}
>
	{#if receiveLines.length === 0}
		<p class="text-sm text-slate-500">Visos prekės jau priimtos.</p>
	{:else}
		<ul class="space-y-2">
			{#each receiveLines as l, i}
				<li class="flex items-center justify-between gap-3 text-sm">
					<span class="flex-1 text-slate-700">{l.name}</span>
					<span class="text-xs text-slate-400">iš {l.max}</span>
					<input
						type="number"
						min="0"
						max={l.max}
						step="1"
						bind:value={receiveLines[i].qty}
						class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-sky-400 focus:ring-1 focus:ring-sky-200 focus:outline-none"
					/>
				</li>
			{/each}
		</ul>
	{/if}
	<label class="mt-4 block text-sm font-medium text-slate-700">
		Grąžinti į sandėlį
		<select class={`${inputClass} mt-1`} bind:value={restockWarehouseId}>
			<option value={null}>Ne (prekės negrąžinamos į likutį)</option>
			{#each warehouses as w}
				<option value={w.id}>{w.code} — {w.name}{w.kind === 'remote' ? ' (nuotolinis)' : ''}</option>
			{/each}
		</select>
	</label>
	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
			onclick={() => (receiveModalOpen = false)}
			disabled={busy}
		>
			Atšaukti
		</button>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
			onclick={() => void saveReceive()}
			disabled={busy || receiveLines.length === 0}
		>
			{busy ? 'Priimama…' : 'Priimti'}
		</button>
	{/snippet}
</Modal>
