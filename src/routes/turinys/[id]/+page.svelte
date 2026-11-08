<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page as routePage } from '$app/state';
	import { ArrowLeft, ExternalLink, ImagePlus, Save } from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import RichEditor from '#lib/components/cms/RichEditor.svelte';
	import LanguageTabs from '#lib/components/cms/LanguageTabs.svelte';
	import SeoFields from '#lib/components/cms/SeoFields.svelte';
	import { legacyMarkdownToHtml, slugify } from '#lib/components/cms/legacy';
	import {
		createCmsPage,
		fetchCmsLookups,
		fetchCmsPage,
		mediaUrl,
		updateCmsPage,
		uploadCmsPageHero,
		type CmsLookups,
		type CmsPageDetail,
		type CmsPageTranslation
	} from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';

	const isNew = $derived(routePage.params.id === 'naujas');

	let loading = $state(true);
	let saving = $state(false);
	let lookups = $state<CmsLookups | null>(null);
	let lang = $state('lt');
	let slug = $state('');
	let shopId = $state<number | null>(null);
	let categoryId = $state<number | null>(null);
	let sortOrder = $state(0);
	let isActive = $state(true);
	let translations = $state<Record<string, CmsPageTranslation & { remove_hero_image?: boolean }>>({});
	let pageId = $state<number | null>(null);

	function blank(code: string): CmsPageTranslation {
		return { language_code: code, title: '', seo_title: '', seo_description: '', hero_image: '', hero_image_alt: '', body_json: null, body_markdown: '' };
	}

	function apply(detail: CmsPageDetail) {
		pageId = detail.id;
		slug = detail.slug;
		shopId = detail.shop_id;
		categoryId = detail.category_id;
		sortOrder = detail.sort_order;
		isActive = detail.is_active;
		const map: typeof translations = {};
		for (const t of detail.translations) map[t.language_code] = { ...t };
		translations = map;
	}

	const current = $derived(translations[lang] ?? blank(lang));
	const filled = $derived(Object.values(translations).filter((t) => t.title.trim()).map((t) => t.language_code));

	function ensure(code: string) {
		if (!translations[code]) translations[code] = blank(code);
		return translations[code];
	}

	onMount(async () => {
		try {
			lookups = await fetchCmsLookups();
			lang = lookups.default_language;
			if (!isNew) apply(await fetchCmsPage(routePage.params.id ?? ''));
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		} finally {
			loading = false;
		}
	});

	async function save() {
		const finalSlug = slugify(slug || translations[lookups?.default_language ?? 'lt']?.title || '');
		if (!finalSlug) {
			pushToast('error', 'Įrašykite pavadinimą arba adresą');
			return;
		}
		saving = true;
		try {
			const payload = {
				slug: finalSlug,
				shop_id: shopId,
				category_id: categoryId,
				sort_order: Number(sortOrder) || 0,
				is_active: isActive,
				translations: Object.values(translations).map((t) => ({
					language_code: t.language_code,
					title: t.title,
					seo_title: t.seo_title,
					seo_description: t.seo_description,
					hero_image_alt: t.hero_image_alt,
					body_json: t.body_json,
					remove_hero_image: !!t.remove_hero_image
				}))
			};
			const saved = pageId ? await updateCmsPage(pageId, payload) : await createCmsPage(payload);
			apply(saved);
			pushToast('success', 'Išsaugota');
			if (isNew) goto(`/turinys/${saved.id}`, { replaceState: true });
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko išsaugoti');
		} finally {
			saving = false;
		}
	}

	async function uploadHero(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!pageId) {
			pushToast('info', 'Pirma išsaugokite puslapį');
			return;
		}
		try {
			const keep = $state.snapshot(translations);
			const saved = await uploadCmsPageHero(pageId, lang, file);
			const fresh = saved.translations.find((t) => t.language_code === lang);
			translations = { ...keep, [lang]: { ...(keep[lang] ?? blank(lang)), hero_image: fresh?.hero_image ?? '', remove_hero_image: false } };
			pushToast('success', 'Paveikslėlis įkeltas');
		} catch (error) {
			pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti');
		}
	}
</script>

{#if loading || !lookups}
	<div class="p-10"><Spinner label="Kraunama…" /></div>
{:else}
	<div class="space-y-4">
		<PageHeader title={isNew ? 'Naujas puslapis' : current.title || slug}>
			{#snippet actions()}
				<a href="/turinys" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} /> Atgal</a>
				<button type="button" onclick={save} disabled={saving} class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"><Save size={16} /> {saving ? 'Saugoma…' : 'Išsaugoti'}</button>
			{/snippet}
		</PageHeader>

		<div class="grid gap-4 lg:grid-cols-[1fr_300px]">
			<div class="space-y-4">
				<LanguageTabs languages={lookups.languages} bind:current={lang} {filled} />
				<input
					value={current.title}
					oninput={(e) => (ensure(lang).title = e.currentTarget.value)}
					placeholder="Puslapio pavadinimas"
					class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xl font-semibold"
				/>
				{#key lang + ':' + (pageId ?? 'new')}
					<RichEditor
						content={current.body_json}
						html={current.body_json ? '' : legacyMarkdownToHtml(current.body_markdown)}
						onchange={(doc) => (ensure(lang).body_json = doc)}
					/>
				{/key}
				{#if !current.body_json && current.body_markdown}
					<p class="text-xs text-amber-700">Tekstas perkeltas iš seno formato. Patikrinkite ir išsaugokite — nuo tada bus naudojamas naujas redaktorius.</p>
				{/if}
				<SeoFields
					bind:title={() => current.seo_title, (v) => (ensure(lang).seo_title = v)}
					bind:description={() => current.seo_description, (v) => (ensure(lang).seo_description = v)}
					fallbackTitle={current.title}
				/>
			</div>

			<aside class="space-y-4">
				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
					<label class="flex items-center gap-2"><input type="checkbox" bind:checked={isActive} /> Rodomas parduotuvėje</label>
					<label class="block">
						<span class="text-slate-600">Adresas</span>
						<div class="mt-1 flex items-center rounded-lg border border-slate-300">
							<span class="pl-3 text-slate-400">/info/</span>
							<input bind:value={slug} placeholder={slugify(current.title)} class="w-full rounded-lg px-1 py-2 font-mono text-xs" />
						</div>
					</label>
					<label class="block">
						<span class="text-slate-600">Parduotuvė</span>
						<select bind:value={shopId} class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
							<option value={null}>Visos parduotuvės</option>
							{#each lookups.shops as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
						</select>
					</label>
					<label class="block">
						<span class="text-slate-600">Pagalbos skiltis</span>
						<select bind:value={categoryId} class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
							<option value={null}>—</option>
							{#each lookups.page_categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
						</select>
					</label>
					<label class="block">
						<span class="text-slate-600">Eiliškumas</span>
						<input type="number" bind:value={sortOrder} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
					</label>
					{#if pageId && isActive}
						<p class="inline-flex items-center gap-1 text-xs text-slate-500"><ExternalLink size={14} /> Parduotuvėje: /info/{slug}</p>
					{/if}
				</div>

				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
					<div class="font-semibold text-slate-700">Viršutinis paveikslėlis ({lang.toUpperCase()})</div>
					{#if current.hero_image && !current.remove_hero_image}
						<img src={mediaUrl(current.hero_image)} alt="" class="w-full rounded-lg" />
						<button type="button" class="text-xs text-rose-600 hover:underline" onclick={() => (ensure(lang).remove_hero_image = true)}>Pašalinti (po išsaugojimo)</button>
					{/if}
					<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
						<ImagePlus size={16} /> Įkelti
						<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="hidden" onchange={uploadHero} />
					</label>
					<input value={current.hero_image_alt} oninput={(e) => (ensure(lang).hero_image_alt = e.currentTarget.value)} placeholder="Alternatyvus tekstas" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
				</div>
			</aside>
		</div>
	</div>
{/if}
