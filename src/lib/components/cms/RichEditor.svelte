<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Editor, type Content } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Image from '@tiptap/extension-image';
	import { TableKit } from '@tiptap/extension-table';
	import { Placeholder } from '@tiptap/extensions';
	import {
		Bold,
		Columns3,
		Heading2,
		Heading3,
		ImagePlus,
		Italic,
		Link as LinkIcon,
		List,
		ListOrdered,
		Minus,
		Pilcrow,
		Quote,
		Redo2,
		Rows3,
		ShoppingBag,
		Strikethrough,
		Table as TableIcon,
		Trash2,
		Underline as UnderlineIcon,
		Undo2,
		Unlink
	} from '@lucide/svelte';
	import { mediaUrl, uploadCmsMedia, type TiptapDoc } from '#lib/api/client';
	import { pushToast } from '#lib/stores/toasts.svelte';
	import ProductPicker from './ProductPicker.svelte';
	import { ProductCards } from './productCardsNode';

	let {
		content,
		html = '',
		placeholder = 'Rašykite tekstą… Paveikslėlį galite tiesiog nutempti arba įklijuoti.',
		onchange
	}: {
		/** Tiptap JSON; when null, `html` (e.g. converted legacy Markdown) is loaded instead. */
		content: TiptapDoc | null;
		html?: string;
		placeholder?: string;
		onchange: (doc: TiptapDoc) => void;
	} = $props();

	let element: HTMLDivElement;
	let fileInput: HTMLInputElement;
	let editor = $state<Editor | null>(null);
	let tick = $state(0);
	let uploading = $state(0);
	let pickerOpen = $state(false);

	// Keep the stored src as returned by the backend; only the editor view gets an absolute URL.
	const CmsImage = Image.extend({
		renderHTML({ HTMLAttributes }) {
			return ['img', { ...HTMLAttributes, src: mediaUrl(String(HTMLAttributes.src ?? '')) }];
		}
	}).configure({ allowBase64: false });

	async function uploadFiles(files: File[], pos?: number) {
		for (const file of files.filter((f) => f.type.startsWith('image/'))) {
			uploading += 1;
			try {
				const media = await uploadCmsMedia(file, file.name.replace(/\.[^.]+$/, ''));
				const chain = editor?.chain().focus();
				if (!chain) continue;
				(pos !== undefined ? chain.insertContentAt(pos, { type: 'image', attrs: { src: media.url, alt: '' } }) : chain.setImage({ src: media.url, alt: '' })).run();
			} catch (error) {
				pushToast('error', error instanceof Error ? error.message : 'Nepavyko įkelti paveikslėlio');
			} finally {
				uploading -= 1;
			}
		}
	}

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3, 4] },
					link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
				}),
				CmsImage,
				TableKit.configure({ table: { resizable: false } }),
				Placeholder.configure({ placeholder }),
				ProductCards
			],
			content: (content ?? html ?? '') as Content,
			editorProps: {
				attributes: { class: 'cms-prose min-h-[320px] px-4 py-3 focus:outline-none' },
				handleDrop(view, event, _slice, moved) {
					const files = Array.from(event.dataTransfer?.files ?? []);
					if (moved || !files.length) return false;
					event.preventDefault();
					const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
					uploadFiles(files, at?.pos);
					return true;
				},
				handlePaste(_view, event) {
					const files = Array.from(event.clipboardData?.files ?? []);
					if (!files.length) return false;
					event.preventDefault();
					uploadFiles(files);
					return true;
				}
			},
			onTransaction: () => {
				tick += 1;
			},
			onUpdate: ({ editor: e }) => onchange(e.getJSON() as TiptapDoc)
		});
		// Legacy Markdown converted to HTML: hand the parent the JSON right away.
		if (!content && html) onchange(editor.getJSON() as TiptapDoc);
	});

	onDestroy(() => editor?.destroy());

	function active(name: string, attrs?: Record<string, unknown>): boolean {
		void tick;
		return editor?.isActive(name, attrs) ?? false;
	}

	function setLink() {
		if (!editor) return;
		const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
		const url = window.prompt('Nuoroda (pvz. https://… arba /p/prekes-adresas)', previous);
		if (url === null) return;
		if (!url.trim()) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
	}

	function onPick(products: { id: number; sku: string }[], title: string) {
		if (!products.length) return;
		editor
			?.chain()
			.focus()
			.insertProductCards({ productIds: products.map((p) => p.id), labels: products.map((p) => p.sku), title })
			.run();
	}

	const btn = 'rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40';
	const on = 'bg-slate-800 text-white hover:bg-slate-700';
</script>

<div class="overflow-hidden rounded-xl border border-slate-300 bg-white">
	<div class="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
		<button type="button" title="Paprastas tekstas" class="{btn} {active('paragraph') ? on : ''}" onclick={() => editor?.chain().focus().setParagraph().run()}><Pilcrow size={16} /></button>
		<button type="button" title="Antraštė" class="{btn} {active('heading', { level: 2 }) ? on : ''}" onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></button>
		<button type="button" title="Paantraštė" class="{btn} {active('heading', { level: 3 }) ? on : ''}" onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></button>
		<span class="mx-1 h-5 w-px bg-slate-300"></span>
		<button type="button" title="Paryškinti (Ctrl+B)" class="{btn} {active('bold') ? on : ''}" onclick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
		<button type="button" title="Kursyvas (Ctrl+I)" class="{btn} {active('italic') ? on : ''}" onclick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
		<button type="button" title="Pabraukti (Ctrl+U)" class="{btn} {active('underline') ? on : ''}" onclick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></button>
		<button type="button" title="Perbraukti" class="{btn} {active('strike') ? on : ''}" onclick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></button>
		<button type="button" title="Nuoroda" class="{btn} {active('link') ? on : ''}" onclick={setLink}><LinkIcon size={16} /></button>
		{#if active('link')}
			<button type="button" title="Pašalinti nuorodą" class={btn} onclick={() => editor?.chain().focus().unsetLink().run()}><Unlink size={16} /></button>
		{/if}
		<span class="mx-1 h-5 w-px bg-slate-300"></span>
		<button type="button" title="Sąrašas" class="{btn} {active('bulletList') ? on : ''}" onclick={() => editor?.chain().focus().toggleBulletList().run()}><List size={16} /></button>
		<button type="button" title="Numeruotas sąrašas" class="{btn} {active('orderedList') ? on : ''}" onclick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
		<button type="button" title="Citata" class="{btn} {active('blockquote') ? on : ''}" onclick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
		<button type="button" title="Skirtukas" class={btn} onclick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus size={16} /></button>
		<span class="mx-1 h-5 w-px bg-slate-300"></span>
		<button type="button" title="Įkelti paveikslėlį" class={btn} onclick={() => fileInput.click()}><ImagePlus size={16} /></button>
		<button type="button" title="Lentelė" class={btn} onclick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></button>
		{#if active('table')}
			<button type="button" title="Pridėti eilutę" class={btn} onclick={() => editor?.chain().focus().addRowAfter().run()}><Rows3 size={16} /></button>
			<button type="button" title="Pridėti stulpelį" class={btn} onclick={() => editor?.chain().focus().addColumnAfter().run()}><Columns3 size={16} /></button>
			<button type="button" title="Ištrinti eilutę" class="{btn} text-xs" onclick={() => editor?.chain().focus().deleteRow().run()}>−eil.</button>
			<button type="button" title="Ištrinti stulpelį" class="{btn} text-xs" onclick={() => editor?.chain().focus().deleteColumn().run()}>−stulp.</button>
			<button type="button" title="Ištrinti lentelę" class={btn} onclick={() => editor?.chain().focus().deleteTable().run()}><Trash2 size={16} /></button>
		{/if}
		<button type="button" title="Prekių blokas" class="{btn} text-sky-700" onclick={() => (pickerOpen = true)}><ShoppingBag size={16} /></button>
		<span class="ml-auto flex items-center gap-0.5">
			{#if uploading}<span class="mr-2 text-xs text-slate-500">Įkeliama…</span>{/if}
			<button type="button" title="Atšaukti (Ctrl+Z)" class={btn} disabled={!(void tick, editor?.can().undo())} onclick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button>
			<button type="button" title="Grąžinti (Ctrl+Shift+Z)" class={btn} disabled={!(void tick, editor?.can().redo())} onclick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button>
		</span>
	</div>
	<div bind:this={element}></div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
		multiple
		class="hidden"
		onchange={(e) => {
			const input = e.currentTarget as HTMLInputElement;
			uploadFiles(Array.from(input.files ?? []));
			input.value = '';
		}}
	/>
</div>

<ProductPicker bind:open={pickerOpen} title="Prekių blokas straipsnyje" withTitle onpick={onPick} />

<style>
	:global(.cms-prose) {
		font-size: 0.95rem;
		line-height: 1.65;
		color: rgb(30 41 59);
	}
	:global(.cms-prose > * + *) {
		margin-top: 0.75em;
	}
	:global(.cms-prose h2) {
		font-size: 1.4rem;
		font-weight: 700;
		margin-top: 1.2em;
	}
	:global(.cms-prose h3) {
		font-size: 1.15rem;
		font-weight: 600;
		margin-top: 1em;
	}
	:global(.cms-prose h4) {
		font-weight: 600;
	}
	:global(.cms-prose ul) {
		list-style: disc;
		padding-left: 1.5rem;
	}
	:global(.cms-prose ol) {
		list-style: decimal;
		padding-left: 1.5rem;
	}
	:global(.cms-prose blockquote) {
		border-left: 3px solid rgb(148 163 184);
		padding-left: 1rem;
		color: rgb(71 85 105);
		font-style: italic;
	}
	:global(.cms-prose a) {
		color: rgb(2 132 199);
		text-decoration: underline;
	}
	:global(.cms-prose img) {
		max-width: 100%;
		border-radius: 0.5rem;
	}
	:global(.cms-prose img.ProseMirror-selectednode) {
		outline: 3px solid rgb(14 165 233);
	}
	:global(.cms-prose hr) {
		border-color: rgb(203 213 225);
	}
	:global(.cms-prose table) {
		border-collapse: collapse;
		width: 100%;
	}
	:global(.cms-prose th),
	:global(.cms-prose td) {
		border: 1px solid rgb(203 213 225);
		padding: 0.35rem 0.6rem;
		vertical-align: top;
	}
	:global(.cms-prose th) {
		background: rgb(241 245 249);
		font-weight: 600;
	}
	:global(.cms-prose .selectedCell) {
		background: rgb(224 242 254);
	}
	:global(.cms-prose p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		color: rgb(148 163 184);
		float: left;
		height: 0;
		pointer-events: none;
	}
</style>
