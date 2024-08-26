import { reloadInspectedTab, togglePolyfill } from "./messenger";

export function polyfillDynamicIframes() {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {
				if (node.tagName === 'IFRAME') {
          console.log("Tibor iframe injector inside script");
          // reloadInspectedTab();
          // togglePolyfill();
				}
			});
		});
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
}
