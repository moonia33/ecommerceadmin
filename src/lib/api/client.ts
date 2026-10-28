export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type Paged<T> = {
	page: number;
	page_size: number;
	total_count: number;
	results: T[];
};

export type OpsShop = {
	id: number | null;
	code: string;
	name: string;
	primary_domain: string;
};

export type OpsCustomer = {
	user_id: number | null;
	email: string;
	full_name: string;
	phone: string;
	company: string;
	is_guest: boolean;
};

export type OpsOrderLine = {
	order_line_id: number;
	variant_id: number | null;
	variant_sku: string;
	barcode: string;
	sku: string;
	name: string;
	qty: number;
	product_id: number | null;
	product_name: string;
	product_slug: string;
	thumbnail_url: string;
	warehouse_code: string;
	warehouse_name: string;
	warehouse_country: string;
	warehouse_kind: string;
	allocated_qty: number;
	unallocated_qty: number;
	returnable: boolean;
	return_days: number;
	returned_qty: number;
	return_deadline: string;
	brand_name: string;
	unit_net: string;
	unit_vat: string;
	unit_gross: string;
	line_total_gross: string;
};

export type OpsOrderListItem = {
	id: number;
	shop: OpsShop;
	customer: OpsCustomer;
	status: string;
	payment_status: string;
	delivery_status: string;
	fulfillment_mode: string;
	supplier_reservation_status: string;
	supplier_reference: string;
	country_code: string;
	shipping_method: string;
	shipping_country_code: string;
	delivery_min_date: string;
	delivery_max_date: string;
	created_at: string;
	amount_gross: string;
	amount_currency: string;
	matched_items_count: number;
	matched_suppliers: string[];
	matched_lines: OpsOrderLine[];
};

export type OpsOrderAddress = {
	full_name: string;
	company: string;
	line1: string;
	city: string;
	postal_code: string;
	country_code: string;
	phone: string;
};

export type OpsPickupPoint = {
	pickup_point_id: string;
	pickup_point_name: string;
	country_code: string;
	raw: Record<string, unknown>;
};

export type OpsOrderTotals = {
	items_net: string;
	items_vat: string;
	items_gross: string;
	shipping_net: string;
	shipping_vat: string;
	shipping_gross: string;
	discounts_net: string;
	discounts_vat: string;
	discounts_gross: string;
	total_net: string;
	total_vat: string;
	total_gross: string;
	currency: string;
	paid_gross: string;
	balance_due: string;
};

export type OpsOrderDiscount = {
	id: number;
	order_id: number;
	kind: string;
	code: string;
	name: string;
	net: string;
	vat: string;
	gross: string;
};

export type OpsAuditEvent = {
	id: number;
	order_id: number;
	kind: string;
	name: string;
	actor_label: string;
	payload: Record<string, unknown>;
	created_at: string;
};

export type OpsPayment = {
	id: number;
	order_id: number;
	provider: string;
	status: string;
	amount_gross: string;
	currency: string;
	external_id: string;
	created_at: string;
	updated_at: string;
};

export type OpsCustomerStats = {
	orders_count: number;
	paid_orders_count: number;
	total_spent: string;
	last_order_at: string;
};

export type OpsOrderDetail = OpsOrderListItem & {
	totals: OpsOrderTotals;
	shipping_address: OpsOrderAddress;
	pickup_point: OpsPickupPoint | null;
	tracking_number: string;
	carrier_code: string;
	carrier_shipment_id: string;
	label_pdf_url: string;
	label_generated_at: string;
	delivered_at: string;
	updated_at: string;
	supplier_notes: string;
	events: OpsAuditEvent[];
	payments: OpsPayment[];
	customer_stats: OpsCustomerStats | null;
	shipments: OpsShipmentRow[];
	surcharges: OpsSurcharge[];
	discounts: OpsOrderDiscount[];
};

export type OpsShipment = {
	order_id: number;
	delivery_status: string;
	shipping_method: string;
	carrier_code: string;
	carrier_shipment_id: string;
	tracking_number: string;
	label_generated_at: string;
};

export type OpsShipmentRow = {
	id: number;
	order_id: number;
	kind: 'outbound' | 'return';
	status: string;
	shipping_method: string;
	carrier_code: string;
	carrier_shipment_id: string;
	tracking_number: string;
	pickup_locker_id: number | null;
	pickup_point_id: string;
	pickup_point_name: string;
	label_url: string;
	label_generated_at: string;
	notes: string;
	created_at: string;
	updated_at: string;
};

export type OpsSurcharge = {
	id: number;
	order_id: number;
	direction: 'charge' | 'refund';
	source: 'auto' | 'manual';
	amount_gross: string;
	currency: string;
	method: string;
	status: string;
	reason: string;
	payment_url: string;
	emailed_at: string;
	paid_at: string;
	created_at: string;
	refund_in_flight: boolean;
};

export type OpsLockerOption = {
	id: number;
	name: string;
	country_code: string;
	city: string;
	address: string;
};

export type OpsOrderShippingUpdateResult = {
	ok: boolean;
	message: string;
	order_id: number;
	shipping_method: string;
	shipping_gross: string;
	price_delta_gross: string;
	pickup_point_name: string;
	new_shipment_id: number | null;
	balance_due: string;
};

export type OpsInventoryItem = {
	id: number;
	sku: string;
	product_id: number | null;
	product_name: string;
	thumbnail_url: string;
	warehouse_code: string;
	warehouse_kind: string;
	qty_on_hand: number;
	qty_reserved: number;
	qty_available: number;
	offer_visibility: string;
};

export type OpsCatalogProduct = {
	id: number;
	sku: string;
	name: string;
	slug: string;
	is_active: boolean;
	brand_name: string;
	category_id: number | null;
	category_name: string;
	variants_count: number;
	thumbnail_url: string;
};

export type OpsVariantOption = {
	option_type_id: number;
	option_type_code: string;
	option_type_name: string;
	option_value_id: number | null;
	label: string;
};

export type OpsCatalogVariant = {
	id: number;
	sku: string;
	barcode: string;
	name: string;
	price_eur: string;
	cost_eur: string;
	is_active: boolean;
	weight_g: number;
	length_cm: number;
	width_cm: number;
	height_cm: number;
	options: OpsVariantOption[];
};

export type OpsCatalogOffer = {
	inventory_item_id: number;
	variant_id: number | null;
	variant_sku: string;
	warehouse_code: string;
	warehouse_name: string;
	qty_on_hand: number;
	qty_reserved: number;
	qty_available: number;
	offer_visibility: string;
	offer_price_override_eur: string;
};

export type OpsProductTranslation = {
	language_code: string;
	name: string;
	slug: string;
	description: string;
	seo_title: string;
	seo_description: string;
	seo_keywords: string;
};

export type OpsProductFeature = {
	id: number;
	feature_id: number;
	feature_code: string;
	feature_name: string;
	feature_value_id: number;
	value: string;
};

export type OpsProductImage = {
	id: number;
	url: string;
	alt_text: string;
	sort_order: number;
	variant_skus: string[];
};

export type OpsProductVideo = {
	id: number;
	url: string;
	video_type: string;
	language_code: string;
	sort_order: number;
};

export type OpsCatalogProductDetail = OpsCatalogProduct & {
	description: string;
	thumbnail_url: string;
	seo_title: string;
	seo_description: string;
	seo_keywords: string;
	additional_info: Record<string, unknown>;
	brand_id: number | null;
	category_id: number | null;
	group_id: number | null;
	tax_class_id: number | null;
	option_type_ids: number[];
	translations: OpsProductTranslation[];
	features: OpsProductFeature[];
	images: OpsProductImage[];
	videos: OpsProductVideo[];
	variants: OpsCatalogVariant[];
	offers: OpsCatalogOffer[];
};

export type OpsLanguage = { code: string; name: string };

export type OpsLookupOption = { id: number; name: string; code: string; depth: number };

export type OpsFeatureValueOption = { id: number; value: string };

export type OpsFeatureOption = {
	id: number;
	code: string;
	name: string;
	allows_multiple: boolean;
	is_filterable: boolean;
	translations: Record<string, string>;
	values: OpsFeatureValueOption[];
};

export type OpsOptionValueOption = {
	id: number;
	code: string;
	label: string;
	translations: Record<string, string>;
};

export type OpsOptionTypeOption = {
	id: number;
	code: string;
	name: string;
	translations: Record<string, string>;
	values: OpsOptionValueOption[];
};

export type OpsCatalogLookups = {
	default_language: string;
	languages: OpsLanguage[];
	brands: OpsLookupOption[];
	categories: OpsLookupOption[];
	groups: OpsLookupOption[];
	tax_classes: OpsLookupOption[];
	features: OpsFeatureOption[];
	option_types: OpsOptionTypeOption[];
};

export type OpsProductUpdatePayload = {
	name?: string;
	slug?: string;
	description?: string;
	seo_title?: string;
	seo_description?: string;
	seo_keywords?: string;
	is_active?: boolean;
	brand_id?: number | null;
	category_id?: number | null;
	group_id?: number | null;
	tax_class_id?: number | null;
	additional_info?: Record<string, unknown>;
	translations?: OpsProductTranslation[];
	feature_value_ids?: number[];
};

export type OpsVariantUpdatePayload = {
	name?: string;
	barcode?: string;
	price_eur?: string;
	cost_eur?: string | null;
	is_active?: boolean;
	weight_g?: number;
	length_cm?: number;
	width_cm?: number;
	height_cm?: number;
	options?: { option_type_id: number; option_value_id: number | null }[];
};

export type OpsJob = {
	id: number;
	job_type: string;
	status: string;
	shop_id: number | null;
	actor_user_id: number | null;
	request_payload: Record<string, unknown>;
	result_payload: Record<string, unknown>;
	error_message: string;
	started_at: string;
	completed_at: string;
	created_at: string;
	updated_at: string;
};

export type OpsCustomerListItem = {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	full_name: string;
	phone: string;
	is_active: boolean;
	is_staff: boolean;
	date_joined: string;
	last_login: string;
	orders_count: number;
	paid_orders_count: number;
	total_spent: string;
	last_order_at: string;
	groups: string[];
};

export type OpsCustomerPhone = {
	phone: string;
	label: string;
	is_primary: boolean;
	is_verified: boolean;
};

export type OpsCustomerAddress = {
	id: number;
	label: string;
	full_name: string;
	company: string;
	company_reg_no: string;
	company_vat_no: string;
	line1: string;
	city: string;
	postal_code: string;
	country_code: string;
	phone: string;
	is_default_shipping: boolean;
	is_default_billing: boolean;
};

export type OpsCustomerOrder = {
	id: number;
	status: string;
	payment_status: string;
	delivery_status: string;
	created_at: string;
	amount_gross: string;
	currency: string;
	items_count: number;
};

export type OpsCustomerDetail = OpsCustomerListItem & {
	phones: OpsCustomerPhone[];
	addresses: OpsCustomerAddress[];
	pickup_point: OpsPickupPoint | null;
	orders: OpsCustomerOrder[];
};

export type OpsActionResult = {
	ok: boolean;
	message: string;
	updated_ids: number[];
	failed_ids: number[];
};

export type MeOut = {
	email: string;
	first_name: string;
	last_name: string;
	is_staff?: boolean;
};

export class ApiError extends Error {
	status: number;
	response?: Response;

	constructor(message: string, status: number, response?: Response) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.response = response;
	}
}

export function getBaseUrl(): string {
	const configured =
		(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';
	return configured.replace(/\/$/, '');
}

export function mediaUrl(path: string): string {
	if (!path) return '';
	if (path.startsWith('http://') || path.startsWith('https://')) return path;
	return `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

function toQueryString(params: QueryParams): string {
	const entries = Object.entries(params)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => [key, String(value)] as const);

	if (!entries.length) return '';
	return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
	if (response.status === 204) return undefined;
	const text = await response.text();
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function request<T>(
	path: string,
	init: RequestInit = {},
	retryOnUnauthorized = true
): Promise<T> {
	const url = `${getBaseUrl()}${path}`;

	const response = await fetch(url, {
		credentials: 'include',
		...init,
		headers: {
			Accept: 'application/json',
			...(init.headers ?? {})
		}
	});

	if (response.status === 401 && retryOnUnauthorized) {
		const refreshResponse = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
			method: 'POST',
			credentials: 'include',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
		});
		if (refreshResponse.ok) {
			return request<T>(path, init, false);
		}
	}

	if (!response.ok) {
		const body = await parseJsonSafely(response);
		const detail =
			typeof body === 'object' && body !== null && 'detail' in body
				? String((body as { detail?: string }).detail ?? '')
				: undefined;
		throw new ApiError(
			detail || `Request failed: ${response.status} ${response.statusText}`,
			response.status,
			response
		);
	}

	return (await parseJsonSafely(response)) as T;
}

async function requestBlob(path: string, body?: unknown): Promise<{ blob: Blob; filename: string }> {
	const url = `${getBaseUrl()}${path}`;
	const response = await fetch(url, {
		method: 'POST',
		credentials: 'include',
		headers: { Accept: '*/*', 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!response.ok) {
		const text = await response.text();
		let detail = `Request failed: ${response.status} ${response.statusText}`;
		try {
			const parsed = JSON.parse(text) as { detail?: string };
			if (parsed.detail) detail = parsed.detail;
		} catch {
			/* non-JSON error body */
		}
		throw new ApiError(detail, response.status, response);
	}
	const disposition = response.headers.get('content-disposition') ?? '';
	const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
	const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : 'export';
	return { blob: await response.blob(), filename };
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function get<T>(path: string, params: QueryParams = {}): Promise<T> {
	return request<T>(`${path}${toQueryString(params)}`);
}

function post<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

function patch<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

// --- Auth ---

export async function loginWithCredentials(payload: {
	email: string;
	password: string;
}): Promise<{ status: string }> {
	const response = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
		method: 'POST',
		credentials: 'include',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const body = await parseJsonSafely(response);
	if (!response.ok) {
		const detail =
			typeof body === 'object' && body !== null && 'detail' in body
				? String((body as { detail?: string }).detail ?? '')
				: 'Login failed';
		throw new ApiError(detail, response.status, response);
	}
	return body as { status: string };
}

export function logout(): Promise<{ status: string }> {
	return post<{ status: string }>('/api/v1/auth/logout');
}

export function fetchMe(): Promise<MeOut> {
	return get<MeOut>('/api/v1/auth/me');
}

// --- Orders ---

export function fetchOrders(params: QueryParams = {}): Promise<Paged<OpsOrderListItem>> {
	return get<Paged<OpsOrderListItem>>('/api/v1/ops/orders', { page_size: 50, ...params });
}

export function fetchOrderDetail(orderId: number | string): Promise<OpsOrderDetail> {
	return get<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}`);
}

export function orderAction(
	orderId: number | string,
	action: 'confirm' | 'assign' | 'move-to-picking',
	payload: { assignee?: string; note?: string } = {}
): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/orders/${orderId}/actions/${action}`, payload);
}

export function ordersBulkAction(payload: {
	action: string;
	selected_ids: number[];
	assignee?: string;
	note?: string;
}): Promise<OpsJob> {
	return post<OpsJob>('/api/v1/ops/orders/actions/bulk', payload);
}

// --- Shipments ---

export function fetchShipments(params: QueryParams = {}): Promise<Paged<OpsShipment>> {
	return get<Paged<OpsShipment>>('/api/v1/ops/shipments', { page_size: 50, ...params });
}

export function generateShipmentLabel(orderId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/shipments/${orderId}/label`);
}

export function generateShipmentLabelsBulk(orderIds: number[]): Promise<OpsJob> {
	return post<OpsJob>('/api/v1/ops/shipments/labels/bulk', { order_ids: orderIds });
}

export function fetchShipmentLabelJob(jobId: number | string): Promise<OpsJob> {
	return get<OpsJob>(`/api/v1/ops/shipments/labels/${jobId}`);
}

export function markShipmentShipped(orderId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/shipments/${orderId}/mark-shipped`);
}

export function refreshShipmentTracking(orderId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/shipments/${orderId}/refresh-tracking`);
}

// --- Payments ---

export function fetchPayments(params: QueryParams = {}): Promise<Paged<OpsPayment>> {
	return get<Paged<OpsPayment>>('/api/v1/ops/payments', { page_size: 50, ...params });
}

export function fetchPayment(paymentId: number | string): Promise<OpsPayment> {
	return get<OpsPayment>(`/api/v1/ops/payments/${paymentId}`);
}

export function paymentAction(
	paymentId: number | string,
	action: 'reconcile' | 'mark-paid' | 'refund',
	payload: { note?: string } = {}
): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/payments/${paymentId}/${action}`, payload);
}

// --- Inventory ---

export function fetchInventoryAlerts(params: QueryParams = {}): Promise<Paged<OpsInventoryItem>> {
	return get<Paged<OpsInventoryItem>>('/api/v1/ops/inventory/alerts', {
		threshold: 0,
		...params
	});
}

export function fetchInventoryItems(params: QueryParams = {}): Promise<Paged<OpsInventoryItem>> {
	return get<Paged<OpsInventoryItem>>('/api/v1/ops/inventory/items', { page_size: 50, ...params });
}

export function adjustInventoryItem(
	itemId: number | string,
	payload: { delta: number; reason_code: string; comment?: string; confirm_remote?: boolean }
): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/inventory/items/${itemId}/adjust`, payload);
}

export type OpsInventoryAdjustment = {
	id: number;
	sku: string;
	product_id: number | null;
	product_name: string;
	warehouse_code: string;
	warehouse_kind: string;
	delta: number;
	qty_before: number;
	qty_after: number;
	reason_code: string;
	comment: string;
	user_email: string;
	created_at: string;
};

export function fetchInventoryAdjustments(
	params: QueryParams = {}
): Promise<Paged<OpsInventoryAdjustment>> {
	return get<Paged<OpsInventoryAdjustment>>('/api/v1/ops/inventory/adjustments', params);
}

// --- Catalog ---

export function fetchCatalogProducts(
	params: QueryParams = {}
): Promise<Paged<OpsCatalogProduct>> {
	return get<Paged<OpsCatalogProduct>>('/api/v1/ops/catalog/products', {
		page_size: 50,
		...params
	});
}

export function fetchCatalogProduct(productId: number | string): Promise<OpsCatalogProductDetail> {
	return get<OpsCatalogProductDetail>(`/api/v1/ops/catalog/products/${productId}`);
}

export function fetchCatalogLookups(): Promise<OpsCatalogLookups> {
	return get<OpsCatalogLookups>('/api/v1/ops/catalog/lookups');
}

export function updateCatalogProduct(
	productId: number | string,
	payload: OpsProductUpdatePayload
): Promise<OpsCatalogProductDetail> {
	return patch<OpsCatalogProductDetail>(`/api/v1/ops/catalog/products/${productId}`, payload);
}

export function updateCatalogVariant(
	variantId: number | string,
	payload: OpsVariantUpdatePayload
): Promise<OpsCatalogVariant> {
	return patch<OpsCatalogVariant>(`/api/v1/ops/catalog/variants/${variantId}`, payload);
}

export function createFeatureValue(
	featureId: number | string,
	value: string
): Promise<OpsFeatureValueOption> {
	return post<OpsFeatureValueOption>(`/api/v1/ops/catalog/features/${featureId}/values`, { value });
}

export function toggleCatalogProduct(productId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/catalog/products/${productId}/toggle-active`);
}

export function updateVariantPrice(
	variantId: number | string,
	priceEur: string
): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/catalog/variants/${variantId}/update-price`, {
		price_eur: priceEur
	});
}

export function setOfferVisibility(
	inventoryItemId: number | string,
	visibility: 'NORMAL' | 'OUTLET'
): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/catalog/offers/${inventoryItemId}/set-visibility`, {
		visibility
	});
}

export function catalogBulkAction(
	action: 'activate_products' | 'deactivate_products' | 'assign_category' | 'assign_group',
	productIds: number[],
	opts?: { categoryId?: number | null; groupId?: number | null }
): Promise<OpsActionResult> {
	return post<OpsActionResult>('/api/v1/ops/catalog/bulk-actions', {
		action,
		product_ids: productIds,
		...(action === 'assign_category' ? { category_id: opts?.categoryId ?? null } : {}),
		...(action === 'assign_group' ? { group_id: opts?.groupId ?? null } : {})
	});
}

// --- Customers ---

export function fetchCustomers(params: QueryParams = {}): Promise<Paged<OpsCustomerListItem>> {
	return get<Paged<OpsCustomerListItem>>('/api/v1/ops/customers', { page_size: 50, ...params });
}

export function fetchCustomer(userId: number | string): Promise<OpsCustomerDetail> {
	return get<OpsCustomerDetail>(`/api/v1/ops/customers/${userId}`);
}

export function toggleCustomerActive(userId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/customers/${userId}/toggle-active`);
}

// --- Audit & jobs ---

export function fetchAuditEvents(params: QueryParams = {}): Promise<Paged<OpsAuditEvent>> {
	return get<Paged<OpsAuditEvent>>('/api/v1/ops/audit/events', { page_size: 50, ...params });
}

export function fetchJobs(params: QueryParams = {}): Promise<Paged<OpsJob>> {
	return get<Paged<OpsJob>>('/api/v1/ops/jobs', { page_size: 50, ...params });
}

export function fetchJob(jobId: number | string): Promise<OpsJob> {
	return get<OpsJob>(`/api/v1/ops/jobs/${jobId}`);
}

export function retryJob(jobId: number | string): Promise<OpsJob> {
	return post<OpsJob>(`/api/v1/ops/jobs/${jobId}/retry`);
}

// --- Shipments registry / order management ---

export function fetchShipmentRegistry(params: QueryParams = {}): Promise<Paged<OpsShipmentRow>> {
	return get<Paged<OpsShipmentRow>>('/api/v1/ops/shipments/registry', {
		page_size: 50,
		...params
	});
}

export function fetchLockers(params: QueryParams = {}): Promise<OpsLockerOption[]> {
	return get<OpsLockerOption[]>('/api/v1/ops/lockers', params);
}

export function createShipment(
	orderId: number | string,
	payload: {
		kind?: 'outbound' | 'return';
		shipping_method?: string;
		carrier_code?: string;
		tracking_number?: string;
		pickup_locker_id?: number | null;
		notes?: string;
	}
): Promise<OpsShipmentRow> {
	return post<OpsShipmentRow>(`/api/v1/ops/orders/${orderId}/shipments`, payload);
}

export function updateShipment(
	shipmentId: number | string,
	payload: {
		kind?: 'outbound' | 'return';
		status?: string;
		shipping_method?: string;
		carrier_code?: string;
		tracking_number?: string;
		carrier_shipment_id?: string;
		pickup_locker_id?: number | null;
		notes?: string;
	}
): Promise<OpsShipmentRow> {
	return patch<OpsShipmentRow>(`/api/v1/ops/shipments/${shipmentId}`, payload);
}

export function generateLabelForShipment(shipmentId: number | string): Promise<OpsActionResult> {
	return post<OpsActionResult>(`/api/v1/ops/shipments/id/${shipmentId}/label`);
}

export function updateOrderShipping(
	orderId: number | string,
	payload: { shipping_method?: string; pickup_locker_id?: number | null }
): Promise<OpsOrderShippingUpdateResult> {
	return patch<OpsOrderShippingUpdateResult>(
		`/api/v1/ops/orders/${orderId}/shipping`,
		payload
	);
}

export function createSurcharge(
	orderId: number | string,
	payload: {
		amount_gross: string;
		reason?: string;
		method?: 'montonio' | 'bank_transfer';
		send_email?: boolean;
		language_code?: string;
	}
): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/orders/${orderId}/surcharges`, payload);
}

export function createOrder(payload: {
	user_email?: string;
	user_id?: number;
	shipping_method?: string;
	pickup_locker_id?: number | null;
	shipping_full_name?: string;
	shipping_phone?: string;
	shipping_line1?: string;
	shipping_city?: string;
	shipping_postal_code?: string;
	shipping_country_code?: string;
	shipping_net_manual?: string;
	status?: string;
	note?: string;
	lines: { variant_id: number; qty: number }[];
}): Promise<OpsOrderDetail> {
	return post<OpsOrderDetail>('/api/v1/ops/orders', payload);
}

export function mergeOrders(
	primaryOrderId: number,
	mergedOrderIds: number[]
): Promise<OpsActionResult> {
	return post<OpsActionResult>('/api/v1/ops/orders/actions/merge', {
		primary_order_id: primaryOrderId,
		merged_order_ids: mergedOrderIds
	});
}

export type OpsVariantPicker = {
	variant_id: number;
	sku: string;
	barcode: string;
	name: string;
	product_id: number | null;
	product_name: string;
	product_slug: string;
	thumbnail_url: string;
	is_active: boolean;
	unit_net: string;
	unit_gross: string;
	stock_available: number;
};

export function searchVariants(params: QueryParams = {}): Promise<OpsVariantPicker[]> {
	return get<OpsVariantPicker[]>('/api/v1/ops/catalog/variants/search', params);
}

export function fetchOrderAddresses(orderId: number | string): Promise<OpsCustomerAddress[]> {
	return get<OpsCustomerAddress[]>(`/api/v1/ops/orders/${orderId}/addresses`);
}

export function updateOrderAddress(
	orderId: number | string,
	payload: {
		user_address_id?: number;
		full_name?: string;
		company?: string;
		line1?: string;
		city?: string;
		postal_code?: string;
		country_code?: string;
		phone?: string;
		save_to_customer?: boolean;
		set_default_shipping?: boolean;
	}
): Promise<OpsOrderDetail> {
	return patch<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/address`, payload);
}

export function updateOrderSupplier(
	orderId: number | string,
	payload: {
		supplier_reservation_status?: string;
		supplier_reference?: string;
		supplier_notes?: string;
	}
): Promise<OpsOrderDetail> {
	return patch<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/supplier`, payload);
}

export function addOrderLine(
	orderId: number | string,
	payload: { variant_id: number; qty: number; offer_id?: number }
): Promise<OpsOrderDetail> {
	return post<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/lines`, payload);
}

export function updateOrderLine(
	orderId: number | string,
	lineId: number,
	payload: { qty?: number; unit_gross?: string; unit_net?: string; name?: string }
): Promise<OpsOrderDetail> {
	return patch<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/lines/${lineId}`, payload);
}

export type OpsInvoiceLine = {
	id: number;
	line_type: string;
	name: string;
	sku: string;
	qty: number;
	unit_net: string;
	vat_rate: string;
	total_gross: string;
	credited_qty: number;
};

export type OpsInvoice = {
	id: number;
	number: string;
	kind: string;
	status: string;
	order_id: number;
	issue_date: string;
	currency: string;
	total_gross: string;
	language_code: string;
	emailed_at: string;
	has_pdf: boolean;
	credit_of_number: string;
	buyer_name: string;
	buyer_email: string;
};

export type OpsInvoiceDetail = OpsInvoice & {
	lines: OpsInvoiceLine[];
};

export function fetchInvoices(
	params: QueryParams = {}
): Promise<Paged<OpsInvoice>> {
	return get<Paged<OpsInvoice>>('/api/v1/ops/invoices/registry', {
		page_size: 50,
		...params
	});
}

export function fetchOrderInvoices(orderId: number | string): Promise<OpsInvoice[]> {
	return get<OpsInvoice[]>('/api/v1/ops/invoices', { order_id: orderId });
}

export function fetchInvoiceDetail(invoiceId: number): Promise<OpsInvoiceDetail> {
	return get<OpsInvoiceDetail>(`/api/v1/ops/invoices/${invoiceId}`);
}

export function issueOrderInvoice(orderId: number | string): Promise<OpsInvoice> {
	return post<OpsInvoice>(`/api/v1/ops/orders/${orderId}/invoice`);
}

export function createCreditInvoice(
	invoiceId: number,
	payload: {
		lines?: { invoice_line_id: number; qty: number }[];
		discount_gross?: string;
		send_email?: boolean;
	}
): Promise<OpsInvoice> {
	return post<OpsInvoice>(`/api/v1/ops/invoices/${invoiceId}/credit`, payload);
}

export function cancelInvoice(invoiceId: number): Promise<OpsInvoice> {
	return post<OpsInvoice>(`/api/v1/ops/invoices/${invoiceId}/cancel`);
}

export function resendInvoice(invoiceId: number): Promise<unknown> {
	return post(`/api/v1/ops/invoices/${invoiceId}/resend`);
}

export function invoicePdfUrl(invoiceId: number): string {
	return `${getBaseUrl()}/api/v1/ops/invoices/${invoiceId}/pdf`;
}

export async function exportInvoices(
	format: 'pdf_zip' | 'csv',
	payload: {
		invoice_ids?: number[];
		q?: string;
		kind?: string;
		status?: string;
		order_id?: number;
		date_from?: string;
		date_to?: string;
	}
): Promise<{ blob: Blob; filename: string }> {
	return requestBlob('/api/v1/ops/invoices/export', { format, ...payload });
}

// --- Returns (RMA) ---

export type OpsReturnLine = {
	id: number;
	order_line_id: number;
	sku: string;
	name: string;
	qty: number;
	received_qty: number;
	credited_qty: number;
	reason: string;
	returnable: boolean;
	return_days: number;
};

export type OpsReturn = {
	id: number;
	number: string;
	status: string;
	order_id: number;
	note: string;
	shipment_id: number | null;
	tracking_number: string;
	credit_invoice_id: number | null;
	credit_invoice_number: string;
	decided_at: string;
	received_at: string;
	completed_at: string;
	created_at: string;
	lines: OpsReturnLine[];
};

export type OpsWarehouse = {
	id: number;
	code: string;
	name: string;
	kind: string;
	country_code: string;
};

export function fetchWarehouses(): Promise<OpsWarehouse[]> {
	return get<OpsWarehouse[]>('/api/v1/ops/warehouses');
}

export function fetchOrderReturns(orderId: number | string): Promise<OpsReturn[]> {
	return get<OpsReturn[]>('/api/v1/ops/returns', { order_id: orderId });
}

export function createOrderReturn(
	orderId: number | string,
	payload: {
		lines: { order_line_id: number; qty: number; reason?: string }[];
		note?: string;
		approve?: boolean;
		allow_expired?: boolean;
	}
): Promise<OpsReturn> {
	return post<OpsReturn>(`/api/v1/ops/orders/${orderId}/returns`, payload);
}

export function setReturnStatus(returnId: number, status: string): Promise<OpsReturn> {
	return post<OpsReturn>(`/api/v1/ops/returns/${returnId}/status/${status}`);
}

export function addReturnShipment(
	returnId: number,
	payload: { carrier_code?: string; tracking_number?: string; notes?: string }
): Promise<OpsReturn> {
	return post<OpsReturn>(`/api/v1/ops/returns/${returnId}/shipment`, payload);
}

export function receiveReturn(
	returnId: number,
	payload: { lines: { return_line_id: number; qty: number }[]; restock_warehouse_id?: number }
): Promise<OpsReturn> {
	return post<OpsReturn>(`/api/v1/ops/returns/${returnId}/receive`, payload);
}

export function creditReturn(
	returnId: number,
	payload: { discount_gross?: string; send_email?: boolean }
): Promise<OpsReturn> {
	return post<OpsReturn>(`/api/v1/ops/returns/${returnId}/credit`, payload);
}

export function addOrderDiscount(
	orderId: number | string,
	payload: { kind: 'percent' | 'amount' | 'coupon'; value?: string; code?: string; name?: string }
): Promise<OpsOrderDetail> {
	return post<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/discount`, payload);
}

export function removeOrderDiscount(
	orderId: number | string,
	discountId: number
): Promise<OpsOrderDetail> {
	return post<OpsOrderDetail>(`/api/v1/ops/orders/${orderId}/discounts/${discountId}/remove`);
}

export function collectSurcharge(
	surchargeId: number,
	payload: { method: 'montonio' | 'bank_transfer'; send_email?: boolean }
): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/surcharges/${surchargeId}/collect`, payload);
}

export function markSurchargePaid(surchargeId: number): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/surcharges/${surchargeId}/mark-paid`);
}

export function resolveSurcharge(surchargeId: number): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/surcharges/${surchargeId}/resolve`);
}

export function refundSurcharge(surchargeId: number): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/surcharges/${surchargeId}/refund`);
}

export function cancelSurcharge(surchargeId: number): Promise<OpsSurcharge> {
	return post<OpsSurcharge>(`/api/v1/ops/surcharges/${surchargeId}/cancel`);
}
