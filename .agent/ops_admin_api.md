# Ops Admin API (v1)

Pilnas OPS endpointų sluoksnis kasdienėms operacijoms.

Base path: `/api/v1/ops`

## Bendros taisyklės

- Auth: HttpOnly `access_token` cookie.
- Access: tik `is_staff` arba `is_superuser`.
- Shop kontekstas:
  - jei `SHOP_CONTEXT_ENABLED=true`, visi duomenys filtruojami per `request.shop`;
  - jei `SHOP_CONTEXT_STRICT=true` ir host neatitinka shop, grąžinamas `404`.
- Klaidos:
  - `401 Unauthorized`
  - `403 Ops access requires staff permissions`
  - `404 ... not found`
  - `400` validacijos / netinkamo veiksmo klaidos

---

## 1) Orders

## GET `/api/v1/ops/orders`

Puslapiuotas užsakymų sąrašas su kritine paieška pagal:

- prekę (`product_q`),
- tiekėją/sandėlį (`supplier_code`),
- gamintoją (`manufacturer_q`),
- bei jų AND kombinacijomis.

### Query

- baziniai: `status`, `payment_status`, `shipping_type`, `assignee`, `date_from`, `date_to`, `q`, `page`, `page_size`
- tiekimo paieška: `product_q`, `supplier_code`, `manufacturer_q`, `remote_only`, `eta_from`, `eta_to`

### Response

- `page`, `page_size`, `total_count`
- `results[]` su:
  - bazinė order būsena (`status`, `delivery_status`, `fulfillment_mode`, ...)
  - `matched_items_count`
  - `matched_suppliers`
  - `matched_lines[]` (kokios eilutės atitiko filtrą)

## GET `/api/v1/ops/orders/{order_id}`

Vieno užsakymo pilna detalė. Be `results[]` laukų papildomai grąžina:

- `totals` — `items_net/vat/gross`, `shipping_net/vat/gross`, `total_net/vat/gross`, `currency`
- `shipping_address` — `full_name`, `company`, `line1`, `city`, `postal_code`, `country_code`, `phone`
- `pickup_point` — `pickup_point_id`, `pickup_point_name`, `country_code`, `raw` (arba `null`)
- `tracking_number`, `carrier_code`, `carrier_shipment_id`
- `label_pdf_url`, `label_generated_at`, `delivered_at`, `updated_at`, `supplier_notes`
- `events[]` — order įvykių timeline (`id`, `kind`, `name`, `actor_label`, `payload`, `created_at`)
- `payments[]` — visi `PaymentIntent` įrašai to order
- `customer_stats` — `orders_count`, `paid_orders_count`, `total_spent`, `last_order_at`

## POST `/api/v1/ops/orders/{order_id}/actions/confirm`

Request:

```json
{ "note": "..." }
```

Veiksmas:

- jei `supplier_reservation_status=not_needed` -> `pending`
- įrašo `OrderEvent(name="ops_confirmed")`

## POST `/api/v1/ops/orders/{order_id}/actions/assign`

Request:

```json
{ "assignee": "operator-1", "note": "..." }
```

Veiksmas:

- įrašo `OrderEvent(name="ops_assigned", payload={assignee,...})`

## POST `/api/v1/ops/orders/{order_id}/actions/move-to-picking`

Request:

```json
{ "note": "..." }
```

Veiksmas:

- `supplier_reservation_status=reserved`
- `supplier_reserved_at=now` (jei buvo tuščias)
- `OrderEvent(name="ops_moved_to_picking")`

## POST `/api/v1/ops/orders/actions/bulk`

Request:

```json
{
  "action": "move_to_picking",
  "selected_ids": [1452, 1453],
  "assignee": "",
  "note": "bulk update"
}
```

Veiksmas:

- sukuria `OpsJob(job_type="orders_bulk_action")`
- vykdo sinchroniškai ir grąžina job būseną

---

## 2) Shipments / labels

## GET `/api/v1/ops/shipments`

Query: `status`, `shipping_method`, `page`, `page_size`.

Grąžina order-level siuntų būsenas:

- `delivery_status`, `shipping_method`
- `carrier_code`, `carrier_shipment_id`, `tracking_number`
- `label_generated_at`

## POST `/api/v1/ops/shipments/{order_id}/label`

Generuoja vieno užsakymo lipduką:

- DPD (`dpd_locker`, `dpd_courier`) -> DPD A6 generatorius
- Unisend/LPExpress (`unisend_*`, `lpexpress*`) -> Unisend 10x15 generatorius

Po sėkmės:

- atnaujina order carrier/label/tracking laukus (per esamas integracijas)
- įrašo `OrderEvent(name="ops_label_generated")`

## POST `/api/v1/ops/shipments/labels/bulk`

Request:

```json
{ "order_ids": [1452, 1453, 1454] }
```

Veiksmas:

- sukuria `OpsJob(job_type="shipment_labels_bulk")`
- vykdo sinchroniškai (sėkmės/klaidos įrašomos `result_payload`)

## GET `/api/v1/ops/shipments/labels/{job_id}`

Grąžina bulk lipdukų job būseną.

## POST `/api/v1/ops/shipments/{shipment_id}/mark-shipped`

Veiksmas:

- nustato `order.delivery_status = shipped`
- `OrderEvent(name="ops_mark_shipped")`

## POST `/api/v1/ops/shipments/{shipment_id}/refresh-tracking`

Veiksmas:

- įrašo `OrderEvent(name="ops_refresh_tracking")` su esamais tracking duomenimis.

---

## 3) Payments

## GET `/api/v1/ops/payments`

Query: `status`, `provider`, `order_id`, `page`, `page_size`.

Grąžina `PaymentIntent` sąrašą.

## GET `/api/v1/ops/payments/{payment_id}`

Vieno `PaymentIntent` detalė.

## POST `/api/v1/ops/payments/{payment_id}/reconcile`

Request:

```json
{ "note": "manual reconciliation note" }
```

Veiksmas:

- įrašo reconcile informaciją į `raw_response.ops_reconcile`
- `OrderEvent(name="ops_payment_reconciled")`

## POST `/api/v1/ops/payments/{payment_id}/mark-paid`

Request:

```json
{ "note": "manual paid" }
```

Veiksmas:

- `PaymentIntent.status = succeeded`
- `Order.status = paid`
- kviečia `capture_inventory_for_order` ir `redeem_coupon_for_paid_order`
- `OrderEvent(name="ops_payment_mark_paid")`

## POST `/api/v1/ops/payments/{payment_id}/refund`

Request:

```json
{ "note": "customer return" }
```

Veiksmas:

- `PaymentIntent.status = cancelled`
- `Order.status = cancelled`
- kviečia `release_coupon_for_order` ir `release_inventory_for_order`
- `OrderEvent(name="ops_payment_refund")`

---

## 4) Inventory

## GET `/api/v1/ops/inventory/alerts`

Query: `threshold`, `page`, `page_size`.

Grąžina `InventoryItem` su `qty_on_hand <= threshold`.

## GET `/api/v1/ops/inventory/items`

Query: `sku`, `product_q`, `warehouse_code`, `page`, `page_size`.

## POST `/api/v1/ops/inventory/items/{item_id}/adjust`

Request:

```json
{
  "delta": -2,
  "reason_code": "damage",
  "comment": "package damaged"
}
```

Taisyklės:

- negalima padaryti `qty_on_hand < 0`
- negalima padaryti `qty_on_hand < qty_reserved`

---

## 5) Catalog ops

## GET `/api/v1/ops/catalog/products`

Query: `q`, `is_active`, `page`, `page_size`.

Grąžina produktų sąrašą su `variants_count`, `brand_name`, `category_name`.

## GET `/api/v1/ops/catalog/lookups`

Dropdown'ams ir redaktoriams:

- `languages[]` + `default_language` (iš `settings.LANGUAGES`)
- `brands[]`, `categories[]` (su `depth` medžio atitraukimui), `groups[]`, `tax_classes[]` — `{id, name, code}`
- `features[]` — `{id, code, name, allows_multiple, is_filterable, translations{lang:name}, values[{id, value}]}`
- `option_types[]` — `{id, code, name, translations, values[{id, code, label, translations}]}`

## GET `/api/v1/ops/catalog/products/{product_id}`

Produkto detalė administravimui:

- produkto bazė (`id`, `sku`, `name`, `slug`, `is_active`, `brand_name`, `category_name`, `description`, `thumbnail_url`)
- SEO laukai (`seo_title`, `seo_description`, `seo_keywords`), `additional_info` (JSON)
- priskyrimai: `brand_id`, `category_id`, `group_id`, `tax_class_id`, `option_type_ids[]`
- `translations[]` — `{language_code, name, slug, description, seo_title, seo_description, seo_keywords}`
- `features[]` — `{id, feature_id, feature_code, feature_name, feature_value_id, value}`
- `images[]` — `{id, url, alt_text, sort_order, variant_skus[]}`
- `videos[]` — `{id, url, video_type, language_code, sort_order}`
- `variants[]` — `id`, `sku`, `barcode`, `name`, `price_eur`, `cost_eur`, `is_active`, `weight_g`, `length_cm`, `width_cm`, `height_cm`, `options[]` (`{option_type_id, option_type_code, option_type_name, option_value_id, label}` — kombinacijos, pvz. „Size: L“)
- `offers[]` — `inventory_item_id`, `variant_id`, `variant_sku`, `warehouse_code/name`, `qty_on_hand/reserved/available`, `offer_visibility`, `offer_price_override_eur`

## PATCH `/api/v1/ops/catalog/products/{product_id}`

Pilnas produkto redagavimas (partial update — siunčiami tik keičiami laukai):

```json
{
  "name": "...",
  "slug": "...",
  "description": "...",
  "seo_title": "...",
  "seo_description": "...",
  "seo_keywords": "...",
  "is_active": true,
  "brand_id": 9,
  "category_id": 12,
  "group_id": null,
  "tax_class_id": 1,
  "translations": [
    { "language_code": "en", "name": "...", "slug": "...", "description": "...",
      "seo_title": "...", "seo_description": "...", "seo_keywords": "..." }
  ],
  "feature_value_ids": [101, 205]
}
```

- `null` FK reikšmė (`brand_id` ir t.t.) nuima priskyrimą.
- `translations` upsert'inami pagal `(product, language_code)`; slug unikalumas tikrinamas per kalbą.
- `feature_value_ids` — pilnai pakeičia produkto savybių rinkinį; `allows_multiple=false` savybei leidžiama viena reikšmė (400 priešingu atveju).
- Grąžina atnaujintą `OpsCatalogProductDetailOut`.

## PATCH `/api/v1/ops/catalog/variants/{variant_id}`

Varianto redagavimas (partial):

```json
{
  "name": "...",
  "barcode": "5056...",
  "price_eur": "12.50",
  "cost_eur": "8.00",
  "is_active": true,
  "weight_g": 210,
  "length_cm": 30, "width_cm": 20, "height_cm": 5,
  "options": [
    { "option_type_id": 15, "option_value_id": 746 },
    { "option_type_id": 16, "option_value_id": null }
  ]
}
```

- `options`: `option_value_id: null` nuima priskyrimą; jei opcijos tipas nėra `product.option_types`, jis automatiškai susiejamas su produktu.
- Barkodo unikalumas tikrinamas (400 jei užimtas).
- Grąžina atnaujintą `OpsCatalogVariantOut`.

## POST `/api/v1/ops/catalog/features/{feature_id}/values`

Sukuria naują `FeatureValue` (arba grąžina esamą, jei toks value jau yra, case-insensitive).

```json
{ "value": "Medvilnė" }
```

Grąžina `{id, value}`.

## POST `/api/v1/ops/catalog/products/{product_id}/toggle-active`

Perjungia `is_active`.

## POST `/api/v1/ops/catalog/variants/{variant_id}/update-price`

Request:

```json
{ "price_eur": "12.50" }
```

Atnaujina `Variant.price_eur`.

## POST `/api/v1/ops/catalog/offers/{inventory_item_id}/set-visibility`

Request:

```json
{ "visibility": "OUTLET" }
```

Leidžiamos reikšmės: `NORMAL`, `OUTLET`.

## POST `/api/v1/ops/catalog/bulk-actions`

Request:

```json
{
  "action": "deactivate_products",
  "product_ids": [501, 502]
}
```

Leidžiami action:

- `activate_products`
- `deactivate_products`

---

## 5b) Customers (vartotojai / klientai)

## GET `/api/v1/ops/customers`

Puslapiuotas vartotojų sąrašas.

Query: `q` (email/vardas/pavardė/tel./gavėjo vardas), `is_active` (`true/false`), `is_staff` (`true/false`), `has_orders` (`true`), `page`, `page_size`.

`results[]` laukai:

- `id`, `email`, `first_name`, `last_name`, `full_name`, `phone` (primary)
- `is_active`, `is_staff`, `date_joined`, `last_login`
- `orders_count`, `paid_orders_count`, `total_spent`, `last_order_at` (shop-scope)
- `groups` — aktyvių customer grupių pavadinimai

## GET `/api/v1/ops/customers/{user_id}`

Vartotojo detalė: list laukai +

- `phones[]` — `phone`, `label`, `is_primary`, `is_verified`
- `addresses[]` — pilni `UserAddress` laukai + `is_default_shipping/billing`
- `pickup_point` — `pickup_point_id`, `pickup_point_name`, `country_code`, `raw`
- `orders[]` — paskutiniai 50 užsakymų (`id`, `status`, `payment_status`, `delivery_status`, `created_at`, `amount_gross`, `currency`, `items_count`)

## POST `/api/v1/ops/customers/{user_id}/toggle-active`

Perjungia `user.is_active`. Ribojimai: negalima deaktyvuoti superuser arba savęs.

---

## 6) Audit

## GET `/api/v1/ops/audit/events`

Query: `order_id`, `kind`, `name`, `page`, `page_size`.

Duomenų šaltinis: `OrderEvent`.

---

## 7) Jobs

Duomenų šaltinis: `checkout.OpsJob`.

## GET `/api/v1/ops/jobs`

Query: `status`, `job_type`, `page`, `page_size`.

## GET `/api/v1/ops/jobs/{job_id}`

Vieno job detalė.

## POST `/api/v1/ops/jobs/{job_id}/retry`

Paleidžia job vykdymą iš naujo su tuo pačiu `request_payload`.

Palaikomi job tipai:

- `orders_bulk_action`
- `shipment_labels_bulk`

---

## OpenAPI

- Swagger UI: `/api/v1/docs`
- OpenAPI JSON: `/api/v1/openapi.json`
- Tag: `ops`

---

## Frontend integracijos pavyzdžiai (ready-to-use)

## Orders paieška pagal prekę + tiekėją + gamintoją

Request:

```http
GET /api/v1/ops/orders?status=paid&product_q=ABC-123&supplier_code=remote_wh_1&manufacturer_q=bosch&remote_only=true&page=1&page_size=20
```

Response (sutrumpintas):

```json
{
  "page": 1,
  "page_size": 20,
  "total_count": 1,
  "results": [
    {
      "id": 1452,
      "status": "paid",
      "payment_status": "succeeded",
      "delivery_status": "pending",
      "fulfillment_mode": "dropship",
      "matched_items_count": 1,
      "matched_suppliers": ["remote_wh_1"],
      "matched_lines": [
        {
          "order_line_id": 9801,
          "sku": "ABC-123",
          "name": "Bosch grąžtas 13mm",
          "qty": 2,
          "warehouse_code": "remote_wh_1",
          "brand_name": "Bosch"
        }
      ]
    }
  ]
}
```

## Bulk order action

Request:

```http
POST /api/v1/ops/orders/actions/bulk
Content-Type: application/json
```

```json
{
  "action": "move_to_picking",
  "selected_ids": [1452, 1453],
  "note": "remote shipment arrived"
}
```

Response (`OpsJob`):

```json
{
  "id": 31,
  "job_type": "orders_bulk_action",
  "status": "success",
  "request_payload": {
    "action": "move_to_picking",
    "selected_ids": [1452, 1453],
    "assignee": "",
    "note": "remote shipment arrived"
  },
  "result_payload": {
    "action": "move_to_picking",
    "updated_ids": [1452, 1453],
    "failed_ids": []
  }
}
```

## Vieno order lipduko generavimas

Request:

```http
POST /api/v1/ops/shipments/1452/label
```

Response:

```json
{
  "ok": true,
  "message": "Label generated",
  "updated_ids": [1452],
  "failed_ids": []
}
```

## Bulk lipdukų generavimas

Request:

```http
POST /api/v1/ops/shipments/labels/bulk
Content-Type: application/json
```

```json
{
  "order_ids": [1452, 1453, 1454]
}
```

Response (`OpsJob`):

```json
{
  "id": 32,
  "job_type": "shipment_labels_bulk",
  "status": "success",
  "result_payload": {
    "updated_ids": [1452, 1453],
    "failed": [
      {
        "order_id": 1454,
        "error": "Shipping method 'xyz' is not supported for label generation"
      }
    ]
  },
  "error_message": "Failed for 1 order(s)"
}
```

## Mark payment paid (manual)

Request:

```http
POST /api/v1/ops/payments/887/mark-paid
Content-Type: application/json
```

```json
{
  "note": "bank transfer matched manually"
}
```

Response:

```json
{
  "ok": true,
  "message": "Payment marked as paid",
  "updated_ids": [887],
  "failed_ids": []
}
```

## Inventory adjust

Request:

```http
POST /api/v1/ops/inventory/items/1901/adjust
Content-Type: application/json
```

```json
{
  "delta": 5,
  "reason_code": "restock",
  "comment": "supplier delivery received"
}
```

Response:

```json
{
  "ok": true,
  "message": "Inventory adjusted",
  "updated_ids": [1901],
  "failed_ids": []
}
```

## Catalog quick actions

- `POST /api/v1/ops/catalog/products/{id}/toggle-active`
- `POST /api/v1/ops/catalog/variants/{id}/update-price`
- `POST /api/v1/ops/catalog/offers/{id}/set-visibility`

`set-visibility` request:

```json
{ "visibility": "OUTLET" }
```

## Jobs polling pattern (frontend)

Po bulk operacijos:

1. paimti `job.id` iš response;
2. poll'inti `GET /api/v1/ops/jobs/{job_id}` kas 2-5 s;
3. stabdyti poll'inimą kai `status in ["success", "failed"]`;
4. rodyti `result_payload` ir `error_message`.

Pirkėjo informacija (order detalėje)
customer blokas
user_id
email
full_name (jei turim iš profilio / shipping)
phone
company (B2B atvejis)
customer_group
is_guest (taip/ne)
Adresai
shipping_address (vardas, įmonė, gatvė, miestas, pašto kodas, šalis, tel.)
billing_address (jei atskiras)
pickup_point (id, pavadinimas, raw metadata)
Užsakymų istorijos santrauka (labai naudinga vadybininkui)
customer_orders_count
customer_paid_orders_count
customer_last_order_at
customer_total_spent (pasirinktinai, jei norėsit)
