<script lang="ts">
	import { marked } from 'marked';
	import { uploadProductImage, deleteProductImage, createCatalogVariant, deleteCatalogVariant, adjustInventoryItem, createInventoryItem, fetchWarehouses, type OpsWarehouse } from '#lib/api/client';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Check,
		ChevronDown,
		ChevronUp,
		ExternalLink,
		Image as ImageIcon,
		Package,
		Plus,
		Save,
		Trash2,
		ImagePlus,
	} from '@lucide/svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		ApiError,
		createFeatureValue,
		fetchCatalogLookups,
		fetchCatalogProduct,
		mediaUrl,
		setOfferVisibility,
		toggleCatalogProduct,
		updateCatalogProduct,
		updateCatalogVariant,
		type OpsCatalogLookups,
		type OpsCatalogProductDetail,
		type OpsProductTranslation
	} from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const productId = $derived(page.params.id ?? '');

	type Tab = 'bendra' | 'turinys' | 'variantai' | 'savybes' | 'likuciai' | 'galerija';

	type VariantDraft = {
		name: string;
		barcode: string;
		price_eur: string;
		cost_eur: string;
		weight_g: string;
		length_cm: string;
		width_cm: string;
		height_cm: string;
		is_active: boolean;
		options: Record<number, number | null>;
	};

	type FeatureDraft = { feature_id: number; feature_value_id: number };

	let loading = $state(true);
	let product = $state<OpsCatalogProductDetail | null>(null);
	let lookups = $state<OpsCatalogLookups | null>(null);
	let busy = $state(false);
	let tab = $state<Tab>('bendra');
	let langTab = $state('');
	let expandedVariant = $state<number | null>(null);

	let form = $state({
		name: '',
		slug: '',
		is_active: true,
		brand_id: null as number | null,
		category_id: null as number | null,
		group_id: null as number | null,
		tax_class_id: null as number | null
	});
	let translationDrafts = $state<Record<string, OpsProductTranslation>>({});
	let baseContent = $state({ description: '', seo_title: '', seo_description: '', seo_keywords: '' });
	let videoUrlsText = $state('');
	let descPreview = $state(false);
	let newVariant = $state({ sku: '', name: '', barcode: '', price_eur: '', cost_eur: '' });
	let imgBusy = $state(false);
	let stockDeltas = $state<Record<number, string>>({});
	let newVariantOpts = $state<Record<number, number | ''>>({});
	let warehouses = $state<OpsWarehouse[]>([]);
	let stockAdd = $state<{ variant_id: number | ''; warehouse_id: number | ''; qty: string }>({ variant_id: '', warehouse_id: '', qty: '0' });
	let stockAddBusy = $state(false);
	let newOptionTypeId = $state<number | ''>('');
	let optTypesBusy = $state(false);

	async function saveOptionTypes() {
		if (!product || optTypesBusy) return;
		optTypesBusy = true;
		try {
			const updated = await updateCatalogProduct(product.id, {
				option_type_ids: productOptionTypes.map((ot) => ot.id)
			});
			product = updated;
			pushToast('success', 'Opcijų tipai išsaugoti.');
		} catch (e) {
			errorMsg(e, 'Nepavyko išsaugoti opcijų tipų.');
		} finally {
			optTypesBusy = false;
		}
	}

	async function addOptionType() {
		if (!product || newOptionTypeId === '' || optTypesBusy) return;
		const ids = [...productOptionTypes.map((ot) => ot.id), Number(newOptionTypeId)];
		optTypesBusy = true;
		try {
			const updated = await updateCatalogProduct(product.id, { option_type_ids: ids });
			product = updated;
			newOptionTypeId = '';
			pushToast('success', 'Opcijos tipas pridėtas.');
		} catch (e) {
			errorMsg(e, 'Nepavyko pridėti opcijos tipo.');
		} finally {
			optTypesBusy = false;
		}
	}

	async function removeOptionType(otId: number) {
		if (!product || optTypesBusy) return;
		optTypesBusy = true;
		try {
			const updated = await updateCatalogProduct(product.id, {
				option_type_ids: productOptionTypes.map((ot) => ot.id).filter((id) => id !== otId)
			});
			product = updated;
			pushToast('success', 'Opcijos tipas pašalintas.');
		} catch (e) {
			errorMsg(e, 'Nepavyko pašalinti opcijos tipo.');
		} finally {
			optTypesBusy = false;
		}
	}

	async function addStockRow() {
		if (!product || !stockAdd.variant_id || !stockAdd.warehouse_id || stockAddBusy) return;
		stockAddBusy = true;
		try {
			await createInventoryItem({
				variant_id: Number(stockAdd.variant_id),
				warehouse_id: Number(stockAdd.warehouse_id),
				qty: Math.max(0, Math.trunc(Number(stockAdd.qty) || 0))
			});
			stockAdd = { variant_id: '', warehouse_id: '', qty: '0' };
			await load();
			pushToast('success', 'Sandėlio likutis pridėtas.');
		} catch (e) {
			errorMsg(e, 'Nepavyko pridėti likučio.');
		} finally {
			stockAddBusy = false;
		}
	}

	const MD_TOOLS: [string, string][] = [
		['**tekstas**','B'],
		['*tekstas*','I'],
		['\n\n### Antraštė\n','H3'],
		['\n- punktas','• sąrašas'],
		['[nuoroda](https://)','link']
	];

	function mdWrap(tag: string) {
		const t = baseContent.description || '';
		baseContent.description = t + tag;
	}

	async function uploadImage(ev: Event) {
		const input = ev.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (!f || !product || imgBusy) return;
		imgBusy = true;
		try {
			const img = (await uploadProductImage(product.id, f)) as (typeof product.images)[number];
			product.images = [...product.images, img];
			pushToast('success', 'Nuotrauka ikelinta.');
		} catch (e) { errorMsg(e, 'Ikelti nepavyko.'); }
		finally { imgBusy = false; input.value = ''; }
	}

	async function removeImage(id: number) {
		if (!product || !confirm('Pasalinti nuotrauka?')) return;
		try {
			await deleteProductImage(id);
			product.images = product.images.filter((i) => i.id !== id);
		} catch (e) { errorMsg(e, 'Nepavyko.'); }
	}

	async function addVariant() {
		if (!product || !newVariant.sku.trim()) return;
		try {
			const v = await createCatalogVariant(product.id, {
				...newVariant,
				option_value_ids: Object.values(newVariantOpts).filter((x): x is number => typeof x === 'number')
			});
			product.variants = [...product.variants, v];
			variantDrafts[v.id] = { name: v.name, barcode: v.barcode, price_eur: v.price_eur, cost_eur: v.cost_eur, is_active: v.is_active, weight_g: String(v.weight_g ?? ''), length_cm: String(v.length_cm ?? ''), width_cm: String(v.width_cm ?? ''), height_cm: String(v.height_cm ?? ''), options: {} };
			newVariant = { sku: '', name: '', barcode: '', price_eur: '', cost_eur: '' };
			newVariantOpts = {};
			pushToast('success', 'Variantas sukurtas.');
		} catch (e) { errorMsg(e, 'Nepavyko.'); }
	}

	async function removeVariant(v: { id: number; sku: string }) {
		if (!product || !confirm('Istrinti varianta ' + v.sku + '?')) return;
		try {
			await deleteCatalogVariant(v.id);
			product.variants = product.variants.filter((x) => x.id !== v.id);
		} catch (e) { errorMsg(e, 'Nepavyko.'); }
	}

	async function adjustStock(itemId: number, kind: string) {
		const d = parseFloat(stockDeltas[itemId] || '0');
		if (!d) return;
		try {
			await adjustInventoryItem(itemId, { delta: d, reason_code: 'correction', comment: '', ...(kind === 'remote' ? { confirm_remote: true } : {}) });
			const offer = product?.offers.find((o) => o.inventory_item_id === itemId);
			if (offer) offer.qty_on_hand = (offer.qty_on_hand ?? 0) + d;
			stockDeltas[itemId] = '';
			pushToast('success', 'Likutis pakoreguotas.');
		} catch (e) { errorMsg(e, 'Nepavyko.'); }
	}
	let featuresDraft = $state<FeatureDraft[]>([]);
	let variantDrafts = $state<Record<number, VariantDraft>>({});

	let newFeatureId = $state<number | null>(null);
	let newFeatureValueId = $state<number | null>(null);
	let newFeatureValueText = $state('');

	const defaultLang = $derived(lookups?.default_language || 'lt');
	const languages = $derived(
		lookups ? [...lookups.languages].sort((a, b) => (a.code === defaultLang ? -1 : b.code === defaultLang ? 1 : 0)) : []
	);
	const productOptionTypes = $derived.by(() => {
		const p = product;
		if (!lookups || !p) return [];
		return lookups.option_types.filter((ot) => p.option_type_ids.includes(ot.id));
	});
	const assignedFeatureIds = $derived(new Set(featuresDraft.map((f) => f.feature_id)));
	const addableFeatures = $derived(
		lookups
			? lookups.features.filter((f) => f.allows_multiple || !assignedFeatureIds.has(f.id))
			: []
	);
	const newFeatureValues = $derived(
		lookups?.features.find((f) => f.id === newFeatureId)?.values ?? []
	);
	const newFeatureAllowsMultiple = $derived(
		lookups?.features.find((f) => f.id === newFeatureId)?.allows_multiple ?? false
	);

	function emptyTranslation(code: string): OpsProductTranslation {
		return {
			language_code: code,
			name: '',
			slug: '',
			description: '',
			seo_title: '',
			seo_description: '',
			seo_keywords: ''
		};
	}

	function hydrate() {
		if (!product || !lookups) return;
		form = {
			name: product.name,
			slug: product.slug,
			is_active: product.is_active,
			brand_id: product.brand_id,
			category_id: product.category_id,
			group_id: product.group_id,
			tax_class_id: product.tax_class_id
		};
		baseContent = {
			description: product.description,
			seo_title: product.seo_title,
			seo_description: product.seo_description,
			seo_keywords: product.seo_keywords
		};
		const byLang = Object.fromEntries(product.translations.map((t) => [t.language_code, t]));
		translationDrafts = Object.fromEntries(
			languages
				.filter((l) => l.code !== defaultLang)
				.map((l) => [l.code, byLang[l.code] ?? emptyTranslation(l.code)])
		);
		featuresDraft = product.features.map((f) => ({
			feature_id: f.feature_id,
			feature_value_id: f.feature_value_id
		}));
		variantDrafts = Object.fromEntries(
			product.variants.map((v) => [
				v.id,
				{
					name: v.name,
					barcode: v.barcode,
					price_eur: v.price_eur,
					cost_eur: v.cost_eur,
					weight_g: v.weight_g ? String(v.weight_g) : '',
					length_cm: v.length_cm ? String(v.length_cm) : '',
					width_cm: v.width_cm ? String(v.width_cm) : '',
					height_cm: v.height_cm ? String(v.height_cm) : '',
					is_active: v.is_active,
					options: Object.fromEntries(v.options.map((o) => [o.option_type_id, o.option_value_id]))
				}
			])
		);
		if (!langTab) langTab = defaultLang;
	}

	async function load() {
		loading = true;
		try {
			const [p, l, wh] = await Promise.all([
				fetchCatalogProduct(productId),
				fetchCatalogLookups(),
				fetchWarehouses().catch(() => [])
			]);
			product = p;
			lookups = l;
			warehouses = wh;
			hydrate();
		} catch (e) {
			pushToast('error', e instanceof ApiError ? e.message : 'Nepavyko įkelti prekės.');
		} finally {
			loading = false;
		}
	}

	function errorMsg(e: unknown, fallback: string) {
		pushToast('error', e instanceof ApiError ? e.message : fallback);
	}

	async function saveGeneral() {
		if (!product || busy) return;
		busy = true;
		try {
			const video_urls = videoUrlsText
				.split('\n')
				.map((u) => u.trim())
				.filter(Boolean);
			product = await updateCatalogProduct(product.id, {
				name: form.name,
				video_urls,
				slug: form.slug,
				is_active: form.is_active,
				brand_id: form.brand_id,
				category_id: form.category_id,
				group_id: form.group_id,
				tax_class_id: form.tax_class_id
			});
			pushToast('success', 'Bendra informacija išsaugota.');
			hydrate();
		} catch (e) {
			errorMsg(e, 'Išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		if (product) {
			videoUrlsText = (product.videos ?? [])
				.filter((v) => v.video_type === 'product')
				.map((v) => v.url)
				.join('\n')
		}
	});

	const descHtml = $derived(
		baseContent.description
			? marked.parse(String(baseContent.description), { async: false, breaks: true })
			: ''
	);

	async function saveContent() {
		if (!product || busy) return;
		busy = true;
		try {
			const video_urls = videoUrlsText
				.split('\n')
				.map((u) => u.trim())
				.filter(Boolean);
			product = await updateCatalogProduct(product.id, {
				name: form.name,
				video_urls,
				slug: form.slug,
				description: baseContent.description,
				seo_title: baseContent.seo_title,
				seo_description: baseContent.seo_description,
				seo_keywords: baseContent.seo_keywords,
				translations: languages
					.filter((l) => l.code !== defaultLang)
					.map((l) => translationDrafts[l.code] ?? emptyTranslation(l.code))
			});
			pushToast('success', 'Aprašymai ir SEO išsaugoti.');
			hydrate();
		} catch (e) {
			errorMsg(e, 'Išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	function toNumberOrNull(raw: string): number | null {
		const t = raw.trim().replace(',', '.');
		if (!t) return null;
		const n = Number.parseFloat(t);
		return Number.isFinite(n) ? n : null;
	}

	async function saveCurrent() {
		if (tab === 'bendra') return saveGeneral();
		if (tab === 'turinys' || tab === 'galerija') return saveContent();
		if (tab === 'savybes') return saveFeatures();
	}

	async function saveVariant(variantId: number) {
		if (!product || busy) return;
		const d = variantDrafts[variantId];
		if (!d) return;
		const price = toNumberOrNull(d.price_eur);
		if (price === null || price < 0) {
			pushToast('error', 'Įveskite teisingą kainą (pvz. 12.50).');
			return;
		}
		const cost = toNumberOrNull(d.cost_eur);
		if (d.cost_eur.trim() && (cost === null || cost < 0)) {
			pushToast('error', 'Savikaina turi būti skaičius.');
			return;
		}
		busy = true;
		try {
			const updated = await updateCatalogVariant(variantId, {
				name: d.name,
				barcode: d.barcode,
				price_eur: price.toFixed(2),
				cost_eur: cost === null ? null : cost.toFixed(2),
				is_active: d.is_active,
				weight_g: parseInt(d.weight_g) || 0,
				length_cm: parseInt(d.length_cm) || 0,
				width_cm: parseInt(d.width_cm) || 0,
				height_cm: parseInt(d.height_cm) || 0,
				options: productOptionTypes.map((ot) => ({
					option_type_id: ot.id,
					option_value_id: d.options[ot.id] ?? null
				}))
			});
			product = {
				...product,
				variants: product.variants.map((v) => (v.id === variantId ? updated : v))
			};
			pushToast('success', `Variantas ${updated.sku} išsaugotas.`);
		} catch (e) {
			errorMsg(e, 'Varianto išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function addFeature() {
		if (!lookups || newFeatureId === null || busy) return;
		let valueId = newFeatureValueId;
		const text = newFeatureValueText.trim();
		if (valueId === null && !text) {
			pushToast('error', 'Pasirinkite reikšmę arba įveskite naują.');
			return;
		}
		busy = true;
		try {
			if (valueId === null && text) {
				const created = await createFeatureValue(newFeatureId, text);
				lookups = {
					...lookups,
					features: lookups.features.map((f) =>
						f.id === newFeatureId
							? { ...f, values: [...f.values, created] }
							: f
					)
				};
				valueId = created.id;
			}
			if (valueId !== null) {
				featuresDraft = [
					...featuresDraft.filter(
						(f) => f.feature_id !== newFeatureId || newFeatureAllowsMultiple
					),
					{ feature_id: newFeatureId, feature_value_id: valueId }
				];
			}
			newFeatureId = null;
			newFeatureValueId = null;
			newFeatureValueText = '';
		} catch (e) {
			errorMsg(e, 'Reikšmės pridėti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function saveFeatures() {
		if (!product || busy) return;
		busy = true;
		try {
			product = await updateCatalogProduct(product.id, {
				feature_value_ids: featuresDraft.map((f) => f.feature_value_id)
			});
			pushToast('success', 'Savybės išsaugotos.');
			hydrate();
		} catch (e) {
			errorMsg(e, 'Savybių išsaugoti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function changeVisibility(inventoryItemId: number, visibility: 'NORMAL' | 'OUTLET') {
		if (busy) return;
		busy = true;
		try {
			await setOfferVisibility(inventoryItemId, visibility);
			pushToast('success', 'Matomumas pakeistas.');
			await load();
		} catch (e) {
			errorMsg(e, 'Matomumo pakeisti nepavyko.');
		} finally {
			busy = false;
		}
	}

	async function toggleActive() {
		if (!product || busy) return;
		busy = true;
		try {
			await toggleCatalogProduct(product.id);
			pushToast('success', product.is_active ? 'Prekė deaktyvuota.' : 'Prekė aktyvuota.');
			await load();
		} catch (e) {
			errorMsg(e, 'Veiksmas nepavyko.');
		} finally {
			busy = false;
		}
	}

	onMount(() => void load());

	const inputClass =
		'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none';
	const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
	const tabBtn = (active: boolean) =>
		`rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition ${
			active
				? 'bg-sky-600 text-white shadow-sm'
				: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
		}`;
	const tabs: { id: Tab; label: string }[] = [
		{ id: 'bendra', label: 'Bendra' },
		{ id: 'turinys', label: 'Aprašymai ir SEO' },
		{ id: 'variantai', label: 'Variantai' },
		{ id: 'savybes', label: 'Savybės' },
		{ id: 'likuciai', label: 'Likučiai' },
		{ id: 'galerija', label: 'Galerija' }
	];
</script>

<div class="mb-4">
	<a href="/prekes" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
		<ArrowLeft size={15} />
		Atgal į prekes
	</a>
</div>

{#if loading}
	<Spinner label="Kraunama prekė…" />
{:else if !product}
	<EmptyState title="Prekė nerasta" />
{:else}
	<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-start gap-5">
			{#if product.thumbnail_url}
				<img
					src={mediaUrl(product.thumbnail_url)}
					alt={product.name}
					class="h-20 w-20 rounded-xl border border-slate-200 object-cover"
				/>
			{:else}
				<div
					class="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300"
				>
					<Package size={28} />
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-2xl font-semibold text-slate-900">{product.name}</h1>
					<Badge
						label={product.is_active ? 'Aktyvi' : 'Neaktyvi'}
						tone={product.is_active ? 'emerald' : 'slate'}
					/>
				</div>
				<p class="mt-1 text-sm text-slate-500">
					SKU: <span class="font-mono">{product.sku}</span> · {product.brand_name || 'Be gamintojo'}
					· {product.category_name || 'Be kategorijos'}
				</p>
			</div>
			<button
				type="button"
				class={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
					product.is_active
						? 'border-rose-200 text-rose-600 hover:bg-rose-50'
						: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
				}`}
				disabled={busy}
				onclick={() => void toggleActive()}
			>
				{product.is_active ? 'Deaktyvuoti prekę' : 'Aktyvuoti prekę'}
			</button>
		</div>
	</div>

	<div class="mt-4 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
		{#each tabs as t (t.id)}
			<button type="button" class={tabBtn(tab === t.id)} onclick={() => (tab = t.id)}>
				{t.label}
				{#if t.id === 'variantai'}
					<span class="opacity-70">({product.variants.length})</span>
				{:else if t.id === 'savybes'}
					<span class="opacity-70">({featuresDraft.length})</span>
				{:else if t.id === 'likuciai'}
					<span class="opacity-70">({product.offers.length})</span>
				{:else if t.id === 'galerija'}
					<span class="opacity-70">({product.images.length})</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- ================= BENDRA ================= -->
	{#if tab === 'bendra'}
		<section class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="text-base font-semibold text-slate-900">Pagrindinė informacija</h2>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div>
					<label class={labelClass} for="p-name">Pavadinimas</label>
					<input id="p-name" class={inputClass} bind:value={form.name} />
				</div>
				<div>
					<label class={labelClass} for="p-slug">Slug (URL adresas)</label>
					<input id="p-slug" class={`${inputClass} font-mono`} bind:value={form.slug} />
				</div>
				<div>
					<label class={labelClass} for="p-sku">SKU</label>
					<input id="p-sku" class={`${inputClass} font-mono bg-slate-50`} value={product.sku} disabled />
				</div>
				<div class="flex items-end pb-1">
					<label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
						<input
							type="checkbox"
							class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
							bind:checked={form.is_active}
						/>
						Prekė aktyvi (rodoma parduotuvėje)
					</label>
				</div>
			</div>

			<h3 class="mt-6 text-sm font-semibold text-slate-800">Priskyrimas</h3>
			<div class="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<div>
					<label class={labelClass} for="p-brand">Gamintojas (brandas)</label>
					<select id="p-brand" class={inputClass} bind:value={form.brand_id}>
						<option value={null}>— Nėra —</option>
						{#each lookups?.brands ?? [] as b (b.id)}
							<option value={b.id}>{b.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class={labelClass} for="p-category">Kategorija</label>
					<select id="p-category" class={inputClass} bind:value={form.category_id}>
						<option value={null}>— Nėra —</option>
						{#each lookups?.categories ?? [] as c (c.id)}
							<option value={c.id}>{'— '.repeat(c.depth)}{c.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class={labelClass} for="p-group">Prekių grupė (modelis/spalva)</label>
					<select id="p-group" class={inputClass} bind:value={form.group_id}>
						<option value={null}>— Nėra —</option>
						{#each lookups?.groups ?? [] as g (g.id)}
							<option value={g.id}>{g.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class={labelClass} for="p-tax">PVM klasė</label>
					<select id="p-tax" class={inputClass} bind:value={form.tax_class_id}>
						<option value={null}>— Nėra —</option>
						{#each lookups?.tax_classes ?? [] as t (t.id)}
							<option value={t.id}>{t.name} ({t.code})</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="mt-6 flex justify-end">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					disabled={busy}
					onclick={() => void saveGeneral()}
				>
					<Save size={15} /> Išsaugoti
				</button>
			</div>
		</section>
	{/if}

	<!-- ================= APRAŠYMAI IR SEO ================= -->
	{#if tab === 'turinys'}
		<section class="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
				<div>
					<h2 class="text-base font-semibold text-slate-900">Aprašymai ir SEO</h2>
					<p class="mt-0.5 text-xs text-slate-400">
						Kiekviena kalba — atskiras skirtukas. Išsaugoma viskas vienu mygtuku.
					</p>
				</div>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					disabled={busy}
					onclick={() => void saveContent()}
				>
					<Save size={15} /> Išsaugoti
				</button>
			</div>

			<div class="flex gap-1 overflow-x-auto border-b border-slate-200 px-5 pt-2">
				{#each languages as lang (lang.code)}
					<button
						type="button"
						class={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition ${
							langTab === lang.code
								? 'border-sky-600 text-sky-700'
								: 'border-transparent text-slate-500 hover:text-slate-800'
						}`}
						onclick={() => (langTab = lang.code)}
					>
						{lang.code.toUpperCase()} — {lang.name}
						{#if lang.code === defaultLang}
							<span class="ml-1 text-xs text-slate-400">(bazinė)</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="p-5">
				{#if langTab === defaultLang}
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label class={labelClass} for="t-name">Pavadinimas</label>
							<input id="t-name" class={inputClass} bind:value={form.name} />
						</div>
						<div>
							<label class={labelClass} for="t-slug">Slug</label>
							<input id="t-slug" class={`${inputClass} font-mono`} bind:value={form.slug} />
						</div>
					</div>
					<div class="mt-4">
						<div class="flex items-center justify-between">
							<label class={labelClass} for="t-desc">Aprašymas (Markdown)</label>
							<button
								type="button"
								class="text-xs font-medium text-sky-600 hover:text-sky-800"
								onclick={() => (descPreview = !descPreview)}
							>
								{descPreview ? 'Redaguoti' : 'Peržiūra'}
							</button>
						</div>
						<div class="mb-1 flex flex-wrap gap-1">
							{#each MD_TOOLS as [lbl, txt] (txt)}
								<button type="button" class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100" onclick={() => mdWrap(lbl)}>{txt}</button>
							{/each}
						</div>
						{#if descPreview}
							<div
								class="prose prose-sm mt-1 min-h-40 max-w-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
							>
								{@html descHtml}
							</div>
						{:else}
							<textarea
								id="t-desc"
								class={`${inputClass} min-h-40 font-mono text-xs`}
								bind:value={baseContent.description}
							></textarea>
						{/if}
					</div>
					<h3 class="mt-5 text-sm font-semibold text-slate-800">SEO ({defaultLang.toUpperCase()})</h3>
					<div class="mt-3 grid gap-4 sm:grid-cols-3">
						<div>
							<label class={labelClass} for="t-seo-title">SEO pavadinimas</label>
							<input id="t-seo-title" class={inputClass} bind:value={baseContent.seo_title} />
						</div>
						<div>
							<label class={labelClass} for="t-seo-desc">SEO aprašymas</label>
							<input id="t-seo-desc" class={inputClass} bind:value={baseContent.seo_description} />
						</div>
						<div>
							<label class={labelClass} for="t-seo-kw">SEO raktažodžiai</label>
							<input id="t-seo-kw" class={inputClass} bind:value={baseContent.seo_keywords} />
						</div>
					</div>
				{:else if translationDrafts[langTab]}
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label class={labelClass} for="tr-name">Pavadinimas ({langTab.toUpperCase()})</label>
							<input id="tr-name" class={inputClass} bind:value={translationDrafts[langTab].name} />
						</div>
						<div>
							<label class={labelClass} for="tr-slug">Slug ({langTab.toUpperCase()})</label>
							<input
								id="tr-slug"
								class={`${inputClass} font-mono`}
								bind:value={translationDrafts[langTab].slug}
							/>
						</div>
					</div>
					<div class="mt-4">
						<label class={labelClass} for="tr-desc">Aprašymas ({langTab.toUpperCase()})</label>
						<textarea
							id="tr-desc"
							class={`${inputClass} min-h-40 font-mono text-xs`}
							bind:value={translationDrafts[langTab].description}
						></textarea>
					</div>
					<h3 class="mt-5 text-sm font-semibold text-slate-800">SEO ({langTab.toUpperCase()})</h3>
					<div class="mt-3 grid gap-4 sm:grid-cols-3">
						<div>
							<label class={labelClass} for="tr-seo-title">SEO pavadinimas</label>
							<input
								id="tr-seo-title"
								class={inputClass}
								bind:value={translationDrafts[langTab].seo_title}
							/>
						</div>
						<div>
							<label class={labelClass} for="tr-seo-desc">SEO aprašymas</label>
							<input
								id="tr-seo-desc"
								class={inputClass}
								bind:value={translationDrafts[langTab].seo_description}
							/>
						</div>
						<div>
							<label class={labelClass} for="tr-seo-kw">SEO raktažodžiai</label>
							<input
								id="tr-seo-kw"
								class={inputClass}
								bind:value={translationDrafts[langTab].seo_keywords}
							/>
						</div>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<!-- ================= VARIANTAI ================= -->
	{#if tab === 'variantai'}
		<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">
					Variantai <span class="text-slate-400">({product.variants.length})</span>
				</h2>
				<p class="mt-0.5 text-xs text-slate-400">
					Kombinacijos (dydis, spalva ir pan.) matomos ir keičiamos tiesiogiai. Kainos be PVM.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
				<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kombinacijų tipai:</span>
				{#each productOptionTypes as ot (ot.id)}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
						{ot.name}
						<button type="button" class="text-sky-400 hover:text-rose-600" title="Pašalinti tipą" onclick={() => void removeOptionType(ot.id)}>×</button>
					</span>
				{/each}
				{#if productOptionTypes.length === 0}
					<span class="text-xs text-slate-400">nepriskirta — variantas bus be kombinacijų</span>
				{/if}
				<select class={`${inputClass} w-44`} bind:value={newOptionTypeId} aria-label="Opcijos tipas">
					<option value="">Pridėti tipą…</option>
					{#each (lookups?.option_types ?? []).filter((o) => !productOptionTypes.some((p) => p.id === o.id)) as o (o.id)}
						<option value={o.id}>{o.name}</option>
					{/each}
				</select>
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
					disabled={newOptionTypeId === '' || optTypesBusy}
					onclick={() => void addOptionType()}
				>
					<Plus size={12} /> Pridėti
				</button>
			</div>
			<div class="flex flex-wrap items-end gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
				<input class={`${inputClass} w-36`} placeholder="SKU*" bind:value={newVariant.sku} />
				<input class={`${inputClass} w-44`} placeholder="Pavadinimas" bind:value={newVariant.name} />
				<input class={`${inputClass} w-24`} placeholder="Kaina €" bind:value={newVariant.price_eur} />
				<input class={`${inputClass} w-24`} placeholder="Savikaina €" bind:value={newVariant.cost_eur} />
				{#each productOptionTypes as ot (ot.id)}
					<select
						class={`${inputClass} w-32`}
						value={newVariantOpts[ot.id] ?? ''}
						onchange={(e) => {
							const val = (e.currentTarget as HTMLSelectElement).value;
							newVariantOpts = { ...newVariantOpts, [ot.id]: val === '' ? '' : Number(val) };
						}}
						aria-label={ot.name}
					>
						<option value="">{ot.name}…</option>
						{#each ot.values as ov (ov.id)}
							<option value={ov.id}>{ov.label}</option>
						{/each}
					</select>
				{/each}
				<button type="button" class="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50" disabled={!newVariant.sku.trim() || (productOptionTypes.length > 0 && productOptionTypes.some((ot) => !newVariantOpts[ot.id]))} onclick={() => void addVariant()}>
					<Plus size={13} /> Pridėti
				</button>
			</div>
			{#if product.variants.length === 0}
				<EmptyState title="Variantų nėra" />
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full text-left text-sm">
						<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
							<tr>
								<th class="w-8 px-3 py-2.5"></th>
								<th class="px-3 py-2.5 font-medium">SKU / kombinacija</th>
								{#each productOptionTypes as ot (ot.id)}
									<th class="px-3 py-2.5 font-medium">{ot.name}</th>
								{/each}
								<th class="px-3 py-2.5 font-medium">Kaina (€)</th>
								<th class="px-3 py-2.5 font-medium">Savikaina</th>
								<th class="px-3 py-2.5 font-medium">Akt.</th>
								<th class="px-4 py-2.5 font-medium"></th>
							</tr>
						</thead>
						<tbody>
							{#each product.variants as variant (variant.id)}
								{@const d = variantDrafts[variant.id]}
								{#if d}
									<tr class="border-t border-slate-100 align-top">
										<td class="px-3 py-3">
											<button
												type="button"
												class="text-slate-400 hover:text-slate-700"
												onclick={() =>
													(expandedVariant = expandedVariant === variant.id ? null : variant.id)}
												aria-label="Išplėsti"
											>
												{#if expandedVariant === variant.id}
													<ChevronUp size={15} />
												{:else}
													<ChevronDown size={15} />
												{/if}
											</button>
										</td>
										<td class="px-3 py-3">
											<div class="font-mono text-xs font-medium text-slate-800">{variant.sku}</div>
											<div class="mt-0.5 text-xs text-slate-400">
												{variant.options.map((o) => o.label).filter(Boolean).join(' · ') ||
													variant.name ||
													'—'}
											</div>
										</td>
										{#each productOptionTypes as ot (ot.id)}
											{@const otValues = ot.values}
											<td class="px-3 py-3">
												<select
													class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
													bind:value={d.options[ot.id]}
													aria-label={ot.name}
												>
													<option value={null}>—</option>
													{#each otValues as ov (ov.id)}
														<option value={ov.id}>{ov.label}</option>
													{/each}
												</select>
											</td>
										{/each}
										<td class="px-3 py-3">
											<input
												class={`${inputClass} w-24`}
												inputmode="decimal"
												bind:value={d.price_eur}
												aria-label={`Kaina ${variant.sku}`}
											/>
										</td>
										<td class="px-3 py-3">
											<input
												class={`${inputClass} w-24`}
												inputmode="decimal"
												bind:value={d.cost_eur}
												placeholder="—"
												aria-label={`Savikaina ${variant.sku}`}
											/>
										</td>
										<td class="px-3 py-3">
											<input
												type="checkbox"
												class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
												bind:checked={d.is_active}
												aria-label={`Aktyvus ${variant.sku}`}
											/>
										</td>
										<td class="px-4 py-3">
											<div class="flex items-center gap-1">
												<button
													type="button"
													class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
													title="Ištrinti"
													onclick={() => void removeVariant(variant)}
												>
													<Trash2 size={14} />
												</button>
												<button
													type="button"
													class="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
													disabled={busy}
													onclick={() => void saveVariant(variant.id)}
												>
													<Check size={13} /> Saugoti
												</button>
											</div>
										</td>
									</tr>
									{#if expandedVariant === variant.id}
										<tr class="border-t border-slate-50 bg-slate-50/50">
											<td colspan={4 + productOptionTypes.length} class="px-5 py-4">
												<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
													<div class="sm:col-span-2">
														<label class={labelClass} for={`vn-${variant.id}`}>Varianto pavadinimas</label>
														<input id={`vn-${variant.id}`} class={inputClass} bind:value={d.name} />
													</div>
													<div class="sm:col-span-2">
														<label class={labelClass} for={`vb-${variant.id}`}>Barkodas (EAN)</label>
														<input
															id={`vb-${variant.id}`}
															class={`${inputClass} font-mono`}
															bind:value={d.barcode}
														/>
													</div>
													<div>
														<label class={labelClass} for={`vw-${variant.id}`}>Svoris (g)</label>
														<input
															id={`vw-${variant.id}`}
															class={inputClass}
															inputmode="numeric"
															bind:value={d.weight_g}
														/>
													</div>
													<div>
														<label class={labelClass} for={`vd-${variant.id}`}>I×P×A (cm)</label>
														<div class="flex items-center gap-1">
															<input
																id={`vd-${variant.id}`}
																class={`${inputClass} w-16`}
																inputmode="numeric"
																bind:value={d.length_cm}
																aria-label="Ilgis"
															/>
															<input
																class={`${inputClass} w-16`}
																inputmode="numeric"
																bind:value={d.width_cm}
																aria-label="Plotis"
															/>
															<input
																class={`${inputClass} w-16`}
																inputmode="numeric"
																bind:value={d.height_cm}
																aria-label="Aukštis"
															/>
														</div>
													</div>
												</div>
											</td>
										</tr>
									{/if}
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ================= SAVYBĖS ================= -->
	{#if tab === 'savybes'}
		<section class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="text-base font-semibold text-slate-900">
						Savybės <span class="text-slate-400">({featuresDraft.length})</span>
					</h2>
					<p class="mt-0.5 text-xs text-slate-400">
						Feature + value poros, naudojamos filtrams parduotuvėje.
					</p>
				</div>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					disabled={busy}
					onclick={() => void saveFeatures()}
				>
					<Save size={15} /> Išsaugoti savybes
				</button>
			</div>

			{#if featuresDraft.length === 0}
				<p class="mt-4 text-sm text-slate-400">Savybių dar nėra.</p>
			{:else}
				<div class="mt-4 space-y-2">
					{#each featuresDraft as fd, i (i)}
						{@const feature = lookups?.features.find((f) => f.id === fd.feature_id)}
						<div class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
							<span class="w-52 text-sm font-medium text-slate-700">
								{feature?.name || `#${fd.feature_id}`}
								<span class="ml-1 text-xs text-slate-400">({feature?.code})</span>
							</span>
							<select
								class="min-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
								bind:value={fd.feature_value_id}
								aria-label="Reikšmė"
							>
								{#each feature?.values ?? [] as v (v.id)}
									<option value={v.id}>{v.value}</option>
								{/each}
								{#if feature && !feature.values.some((v) => v.id === fd.feature_value_id)}
									<option value={fd.feature_value_id}>#{fd.feature_value_id}</option>
								{/if}
							</select>
							<button
								type="button"
								class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
								onclick={() => (featuresDraft = featuresDraft.filter((_, j) => j !== i))}
								aria-label="Pašalinti"
							>
								<Trash2 size={15} />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-5 rounded-xl border border-dashed border-slate-300 p-4">
				<h3 class="text-sm font-semibold text-slate-800">Pridėti savybę</h3>
				<div class="mt-3 flex flex-wrap items-end gap-3">
					<div class="min-w-52 flex-1">
						<label class={labelClass} for="nf">Savybė</label>
						<select
							id="nf"
							class={inputClass}
							bind:value={newFeatureId}
							onchange={() => {
								newFeatureValueId = null;
								newFeatureValueText = '';
							}}
						>
							<option value={null}>— Pasirinkite —</option>
							{#each addableFeatures as f (f.id)}
								<option value={f.id}>{f.name} ({f.code})</option>
							{/each}
						</select>
					</div>
					<div class="min-w-52 flex-1">
						<label class={labelClass} for="nfv">Reikšmė</label>
						<select id="nfv" class={inputClass} bind:value={newFeatureValueId} disabled={newFeatureId === null}>
							<option value={null}>— Pasirinkite —</option>
							{#each newFeatureValues as v (v.id)}
								<option value={v.id}>{v.value}</option>
							{/each}
						</select>
					</div>
					<div class="min-w-52 flex-1">
						<label class={labelClass} for="nfvt">arba nauja reikšmė</label>
						<input
							id="nfvt"
							class={inputClass}
							placeholder="pvz. Medvilnė"
							bind:value={newFeatureValueText}
							disabled={newFeatureId === null}
						/>
					</div>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3.5 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
						disabled={busy || newFeatureId === null}
						onclick={() => void addFeature()}
					>
						<Plus size={15} /> Pridėti
					</button>
				</div>
				<p class="mt-2 text-xs text-slate-400">
					Nepamirškite po pridėjimo paspausti „Išsaugoti savybes“.
				</p>
			</div>
		</section>
	{/if}

	<!-- ================= LIKUČIAI ================= -->
	{#if tab === 'likuciai'}
		<section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">
					Likučiai ir matomumas <span class="text-slate-400">({product.offers.length})</span>
				</h2>
				<p class="mt-0.5 text-xs text-slate-400">
					„Outlet“ matomumas — išpardavimo skyriuje. Likutis koreguojamas „Atsargos“ puslapyje.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
				<select class={`${inputClass} w-56`} bind:value={stockAdd.variant_id} aria-label="Variantas">
					<option value="">Variantas…</option>
					{#each product.variants as v (v.id)}
						<option value={v.id}>{v.sku}{v.name ? ' — ' + v.name : ''}</option>
					{/each}
				</select>
				<select class={`${inputClass} w-48`} bind:value={stockAdd.warehouse_id} aria-label="Sandėlis">
					<option value="">Sandėlis…</option>
					{#each warehouses as wh (wh.id)}
						<option value={wh.id}>{wh.code}{wh.name ? ' — ' + wh.name : ''}</option>
					{/each}
				</select>
				<input class={`${inputClass} w-20`} placeholder="Kiekis" type="number" min="0" bind:value={stockAdd.qty} aria-label="Kiekis" />
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
					disabled={!stockAdd.variant_id || !stockAdd.warehouse_id || stockAddBusy}
					onclick={() => void addStockRow()}
				>
					<Plus size={13} /> Pridėti sandėlį
				</button>
			</div>
			{#if product.offers.length === 0}
				<EmptyState title="Sandėlio įrašų nėra" />
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full text-left text-sm">
						<thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
							<tr>
								<th class="px-5 py-2.5 font-medium">Variantas</th>
								<th class="px-4 py-2.5 font-medium">Sandėlis</th>
								<th class="px-4 py-2.5 text-right font-medium">Likutis</th>
								<th class="px-4 py-2.5 text-right font-medium">Rezervuota</th>
								<th class="px-4 py-2.5 text-right font-medium">Laisva</th>
								<th class="px-4 py-2.5 text-right font-medium">Kaina</th>
								<th class="px-5 py-2.5 font-medium">Matomumas</th>
								<th class="px-4 py-2.5 font-medium">Korekcija</th>
							</tr>
						</thead>
						<tbody>
							{#each product.offers as offer (offer.inventory_item_id)}
								{@const offerVariant = product.variants.find((v) => v.id === offer.variant_id)}
								<tr class="border-t border-slate-100">
									<td class="px-5 py-3">
										<span class="font-mono text-xs text-slate-600">{offer.variant_sku || '—'}</span>
										{#if offerVariant}
											<span class="ml-2 text-xs text-slate-400">
												{offerVariant.options.map((o) => o.label).filter(Boolean).join(' · ')}
											</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<div class="text-slate-800">{offer.warehouse_code}</div>
										<div class="text-xs text-slate-400">{offer.warehouse_name}</div>
									</td>
									<td class="px-4 py-3 text-right">
										<span class={offer.qty_on_hand <= 0 ? 'font-semibold text-rose-600' : 'text-slate-800'}
											>{offer.qty_on_hand}</span
										>
									</td>
									<td class="px-4 py-3 text-right text-slate-600">{offer.qty_reserved}</td>
									<td class="px-4 py-3 text-right text-slate-800">{offer.qty_available}</td>
									<td class="px-4 py-3 text-right text-slate-600">
										{offer.offer_price_override_eur ? `${offer.offer_price_override_eur} €` : '—'}
									</td>
									<td class="px-5 py-3">
										<select
											class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50"
											value={offer.offer_visibility || 'NORMAL'}
											disabled={busy}
											onchange={(e) =>
												void changeVisibility(
													offer.inventory_item_id,
													(e.currentTarget as HTMLSelectElement).value as 'NORMAL' | 'OUTLET'
												)}
											aria-label="Matomumas"
										>
											<option value="NORMAL">Normali</option>
											<option value="OUTLET">Outlet</option>
										</select>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-1">
											<input class="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs" placeholder="±0" bind:value={stockDeltas[offer.inventory_item_id]} />
											<button type="button" class="rounded bg-slate-700 px-2 py-0.5 text-xs text-white hover:bg-slate-600" onclick={() => void adjustStock(offer.inventory_item_id, offer.warehouse_kind)}>OK</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ================= GALERIJA ================= -->
	{#if tab === 'galerija'}
		<section class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">			<h2 class="text-base font-semibold text-slate-900">
				Galerija <span class="text-slate-400">({product.images.length})</span>
			</h2>
				<label class={"inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500" + (imgBusy ? " opacity-50 pointer-events-none" : "")}>
					<ImagePlus size={14} /> {imgBusy ? 'Keliamas…' : 'Įkelti nuotrauką'}
					<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="hidden" onchange={uploadImage} />
				</label>
			</div>
			{#if product.images.length === 0}
				<p class="mt-4 text-sm text-slate-400">Nuotraukų nėra.</p>
			{:else}
				<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
					{#each product.images as img (img.id)}
						<figure class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
							<button type="button" class="absolute right-1 top-1 z-10 rounded-full bg-white/90 p-1 text-slate-500 shadow hover:text-red-600" title="Ištrinti" onclick={() => void removeImage(img.id)}>
								<Trash2 size={12} />
							</button>
							{#if img.url}
								<img src={mediaUrl(img.url)} alt={img.alt_text || product.name} class="aspect-square w-full object-cover" />
							{:else}
								<div class="flex aspect-square w-full items-center justify-center text-slate-300">
									<ImageIcon size={28} />
								</div>
							{/if}
							<figcaption class="px-2 py-1.5 text-xs text-slate-500">
								{img.alt_text || `#${img.id}`}
								{#if img.variant_skus.length}
									<div class="mt-0.5 font-mono text-[10px] text-slate-400">
										{img.variant_skus.join(', ')}
									</div>
								{/if}
							</figcaption>
						</figure>
					{/each}
				</div>
			{/if}

			<div class="mt-6">
				<h3 class="text-sm font-semibold text-slate-800">Video (YouTube nuorodos — po vieną eilutėje)</h3>
				<textarea
					class={`${inputClass} mt-2 min-h-20 font-mono text-xs`}
					placeholder="https://www.youtube.com/watch?v=..."
					bind:value={videoUrlsText}
				></textarea>
			</div>

			{#if product.videos.length}
				<h3 class="mt-6 text-sm font-semibold text-slate-800">Video ({product.videos.length})</h3>
				<ul class="mt-2 space-y-1.5">
					{#each product.videos as video (video.id)}
						<li class="flex items-center gap-2 text-sm">
							<a
								href={video.url}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 text-sky-700 hover:underline"
							>
								<ExternalLink size={13} /> {video.url}
							</a>
							<Badge label={video.video_type} tone="slate" />
							{#if video.language_code}
								<Badge label={video.language_code.toUpperCase()} tone="sky" />
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
{/if}
