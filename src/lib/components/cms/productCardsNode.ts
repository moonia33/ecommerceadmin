import { Node, mergeAttributes } from '@tiptap/core';

export type ProductCardsAttrs = {
	productIds: number[];
	labels: string[];
	title: string;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		productCards: {
			insertProductCards: (attrs: ProductCardsAttrs) => ReturnType;
		};
	}
}

/** Block with product cards; the storefront renders live prices/stock from the ids. */
export const ProductCards = Node.create({
	name: 'productCards',
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			productIds: { default: [] },
			labels: { default: [] },
			title: { default: '' }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-product-cards]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes({ 'data-product-cards': '' }, HTMLAttributes)];
	},

	addNodeView() {
		return ({ node }) => {
			const dom = document.createElement('div');
			dom.className =
				'my-3 rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900';
			const attrs = node.attrs as ProductCardsAttrs;
			const head = document.createElement('div');
			head.className = 'font-semibold';
			head.textContent = `🛒 Prekių blokas (${attrs.productIds.length})${attrs.title ? ` — ${attrs.title}` : ''}`;
			const list = document.createElement('div');
			list.className = 'mt-1 text-xs text-sky-700';
			list.textContent = (attrs.labels.length ? attrs.labels : attrs.productIds.map(String)).join(', ');
			dom.append(head, list);
			return { dom };
		};
	},

	addCommands() {
		return {
			insertProductCards:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs })
		};
	}
});
