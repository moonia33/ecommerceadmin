<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page as routePage } from '$app/state';
	import { ArrowLeft, ImagePlus, Save, Trash2, X } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import RichEditor from '#lib/components/cms/RichEditor.svelte';
	import LanguageTabs from '#lib/components/cms/LanguageTabs.svelte';
	import SeoFields from '#lib/components/cms/SeoFields.svelte';
	import ProductPicker from '#lib/components/cms/ProductPicker.svelte';
	import { fromLocalInput, slugify, toLocalInput } from '#lib/components/cms/legacy';
	import {
		createBlogPost,
		deleteBlogPost,
		fetchBlogPost,
		fetchCatalogLookups,
		fetchCmsLookups,
		mediaUrl,
		updateBlogPost,
		uploadBlogCover,
		type BlogPostDetail,
		type BlogProductRef,
		type BlogState,
		type BlogTranslation,
		type CmsLookups,
		type OpsLookupOption
	} from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const isNew = $derived(routePage.params.id === 'naujas');

	let loading = $state(true);
	let saving = $state(false);
	let lookups = $state<CmsLookups | null>(null);
	let catalogCategories = $state<OpsLookupOption[]>([]);
	let lang = $state('lt');
	let postId = $state<number | null>(null);
	let postState = $state<BlogState>('draft');
	let status = $state<'draft' | 'published'>('draft');
	let publishedAt = $state('');
	let shopId = $state<number | null>(null);
	let authorName = $state('');
	let isFeatured = $state(false);
	let coverImage = $state('');
	let removeCover = $state(false);
	let categoryIds = $state<number[]>([]);
	let relatedProducts = $state<BlogProductRef[]>([]);
	let relatedCategoryIds = $state<number[]>([]);
	let translations = $state<Record<string, BlogTranslation>>({});
	let slugTouched = $state<Record<string, boolean>>({});
	let pickerOpen = $state(false);
	let catalogCategoryToAdd = $state<number | null>(null);

	function blank(code: string): BlogTranslation {
		return { language_code: code, slug: '', title: '', excerpt: '', body_json: null, seo_title: '', seo_description: '', cover_image_alt: '' };
	}

	function ensure(code: string) {
		if (!translations[code]) translations[code] = blank(code);
		return translations[code];
	}

	const current = $derived(translations[lang] ?? blank(lang));
	const filled = $derived(Object.values(translations).filter((t) => t.title.trim()).map((t) => t.language_code));

	function apply(d: BlogPostDetail) {
		postId = d.id;
		postState = d.state;
		status = d.status;
		publishedAt = toLocalInput(d.published_at);
		shopId = d.shop_id;
		authorName = d.author_name;
		isFeatured = d.is_featured;
		coverImage = d.cover_image;
		removeCover = false;
		categoryIds = d.category_ids;
		relatedProducts = d.related_products;
		relatedCategoryIds = d.related_category_ids;
		translations = Object.fromEntries(d.translations.map((t) => [t.language_code, { ...t }]));
		slugTouched = Object.fromEntries(d.translations.map((t) => [t.language_code, true]));
	}

	onMount(async () => {
		try {
			[lookups, { categories: catalogCategories }] = await Promise.all([fetchCmsLookups(), fetchCatalogLookups()]);
			lang = lookups.default_language;
			if (!isNew) apply(await fetchBlogPost(routePage.params.id ?? ''));
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		} finally {
			loading = false;
		}
	});

	function setTitle(value: string) {
		const t = ensure(lang);
		t.title = value;
		if (!slugTouched[lang]) t.slug = slugify(value);
	}

	async function save(nextStatus: 'draft' | 'published' = status) {
		saving = true;
		try {
			const payload = {
				shop_id: shopId,
				status: nextStatus,
				published_at: fromLocalInput(publishedAt),
				author_name: authorName,
				is_featured: isFeatured,
				category_ids: categoryIds,
				related_product_ids: relatedProducts.map((p) => p.id),
				related_category_ids: relatedCategoryIds,
				remove_cover_image: removeCover,
				translations: Object.values(translations).filter((t) => t.title.trim())
			};
			const saved = postId ? await updateBlogPost(postId, payload) : await createBlogPost(payload);
			apply(saved);
			pushToast('success', nextStatus === 'published' ? (saved.state === 'scheduled' ? 'Suplanuota' : 'Publikuota') : 'Išsaugota');
			if (isNew) goto(`/blogas/${saved.id}`, { replaceState: true });
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko išsaugoti');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!postId || !confirm('Ištrinti juodraštį?')) return;
		try {
			await deleteBlogPost(postId);
			goto('/blogas');
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko ištrinti');
		}
	}

	async function uploadCover(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!postId) return pushToast('info', 'Pirma išsaugokite juodraštį');
		try {
			const saved = await uploadBlogCover(postId, file);
			coverImage = saved.cover_image;
			removeCover = false;
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		}
	}

	function toggleCategory(id: number) {
		categoryIds = categoryIds.includes(id) ? categoryIds.filter((x) => x !== id) : [...categoryIds, id];
	}
</script>

{#if loading || !lookups}
	<div class="p-10"><Spinner label="Kraunama…" /></div>
{:else}
	<div class="space-y-4">
		<PageHeader title={isNew ? 'Naujas straipsnis' : current.title || 'Straipsnis'} subtitle={postState === 'published' ? 'Publikuotas' : postState === 'scheduled' ? 'Suplanuotas' : 'Juodraštis'}>
			{#snippet actions()}
				<a href="/blogas" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} /> Atgal</a>
				{#if status === 'published'}
					<button type="button" onclick={() => save('draft')} disabled={saving} class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Grąžinti į juodraštį</button>
					<button type="button" onclick={() => save('published')} disabled={saving} class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"><Save size={16} /> Išsaugoti</button>
				{:else}
					<button type="button" onclick={() => save('draft')} disabled={saving} class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Save size={16} /> Išsaugoti juodraštį</button>
					<button type="button" onclick={() => save('published')} disabled={saving} class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{publishedAt && new Date(publishedAt) > new Date() ? 'Suplanuoti' : 'Publikuoti'}</button>
				{/if}
			{/snippet}
		</PageHeader>

		<div class="grid gap-4 lg:grid-cols-[1fr_320px]">
			<div class="space-y-4">
				<LanguageTabs languages={lookups.languages} bind:current={lang} {filled} />
				<input value={current.title} oninput={(e) => setTitle(e.currentTarget.value)} placeholder="Straipsnio pavadinimas" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xl font-semibold" />
				<label class="flex items-center rounded-lg border border-slate-300 bg-white text-sm">
					<span class="pl-3 text-slate-400">adresas:</span>
					<input value={current.slug} oninput={(e) => { slugTouched[lang] = true; ensure(lang).slug = e.currentTarget.value; }} class="w-full rounded-lg px-2 py-1.5 font-mono text-xs" />
				</label>
				<textarea value={current.excerpt} oninput={(e) => (ensure(lang).excerpt = e.currentTarget.value)} rows="2" placeholder="Trumpas aprašymas sąrašui (1–2 sakiniai)" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"></textarea>
				{#key lang + ':' + (postId ?? 'new')}
					<RichEditor content={current.body_json} onchange={(doc) => (ensure(lang).body_json = doc)} />
				{/key}
				<SeoFields
					bind:title={() => current.seo_title, (v) => (ensure(lang).seo_title = v)}
					bind:description={() => current.seo_description, (v) => (ensure(lang).seo_description = v)}
					fallbackTitle={current.title}
				/>
			</div>

			<aside class="space-y-4 text-sm">
				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
					<label class="block">
						<span class="text-slate-600">Publikavimo data</span>
						<input type="datetime-local" bind:value={publishedAt} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						<span class="text-xs text-slate-400">Tuščia = iškart. Ateities data = suplanuota.</span>
					</label>
					<label class="block">
						<span class="text-slate-600">Autorius</span>
						<input bind:value={authorName} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
					</label>
					<label class="block">
						<span class="text-slate-600">Parduotuvė</span>
						<select bind:value={shopId} class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
							<option value={null}>Visos parduotuvės</option>
							{#each lookups.shops as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
						</select>
					</label>
					<label class="flex items-center gap-2"><input type="checkbox" bind:checked={isFeatured} /> Išskirtinis (rodyti viršuje)</label>
				</div>

				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
					<div class="font-semibold text-slate-700">Viršelis</div>
					{#if coverImage && !removeCover}
						<img src={mediaUrl(coverImage)} alt="" class="w-full rounded-lg" />
						<button type="button" class="text-xs text-rose-600 hover:underline" onclick={() => (removeCover = true)}>Pašalinti (po išsaugojimo)</button>
					{/if}
					<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
						<ImagePlus size={16} /> Įkelti
						<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="hidden" onchange={uploadCover} />
					</label>
					<input value={current.cover_image_alt} oninput={(e) => (ensure(lang).cover_image_alt = e.currentTarget.value)} placeholder="Alternatyvus tekstas ({lang.toUpperCase()})" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
				</div>

				<div class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
					<div class="font-semibold text-slate-700">Blogo kategorijos</div>
					{#if !lookups.blog_categories.length}<p class="text-xs text-slate-400">Sukurkite sąraše „Kategorijos“.</p>{/if}
					{#each lookups.blog_categories as c (c.id)}
						<label class="flex items-center gap-2"><input type="checkbox" checked={categoryIds.includes(c.id ?? 0)} onchange={() => toggleCategory(c.id ?? 0)} /> {c.name}</label>
					{/each}
				</div>

				<div class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
					<div class="font-semibold text-slate-700">Susijusios prekės</div>
					<p class="text-xs text-slate-400">Straipsnis bus rodomas šių prekių puslapiuose.</p>
					{#each relatedProducts as p (p.id)}
						<div class="flex items-center gap-2">
							{#if p.image}<img src={mediaUrl(p.image)} alt="" class="h-8 w-8 rounded object-cover" />{/if}
							<span class="flex-1 truncate">{p.name} <span class="text-xs text-slate-400">{p.sku}</span></span>
							<button type="button" title="Pašalinti" onclick={() => (relatedProducts = relatedProducts.filter((x) => x.id !== p.id))}><X size={14} /></button>
						</div>
					{/each}
					<button type="button" onclick={() => (pickerOpen = true)} class="text-sky-700 hover:underline">+ Pridėti prekes</button>
				</div>

				<div class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
					<div class="font-semibold text-slate-700">Susijusios katalogo kategorijos</div>
					{#each relatedCategoryIds as id (id)}
						<div class="flex items-center gap-2">
							<span class="flex-1 truncate">{catalogCategories.find((c) => c.id === id)?.name ?? id}</span>
							<button type="button" title="Pašalinti" onclick={() => (relatedCategoryIds = relatedCategoryIds.filter((x) => x !== id))}><X size={14} /></button>
						</div>
					{/each}
					<select bind:value={catalogCategoryToAdd} onchange={() => { if (catalogCategoryToAdd && !relatedCategoryIds.includes(catalogCategoryToAdd)) relatedCategoryIds = [...relatedCategoryIds, catalogCategoryToAdd]; catalogCategoryToAdd = null; }} class="w-full rounded-lg border border-slate-300 px-2 py-2">
						<option value={null}>+ Pridėti kategoriją</option>
						{#each catalogCategories as c (c.id)}<option value={c.id}>{'— '.repeat(c.depth)}{c.name}</option>{/each}
					</select>
				</div>

				{#if postId && status === 'draft'}
					<button type="button" onclick={remove} class="inline-flex items-center gap-1.5 text-rose-600 hover:underline"><Trash2 size={14} /> Ištrinti juodraštį</button>
				{/if}
			</aside>
		</div>
	</div>
{/if}

<ProductPicker bind:open={pickerOpen} title="Susijusios prekės" initial={relatedProducts} onpick={(products) => (relatedProducts = products)} />
