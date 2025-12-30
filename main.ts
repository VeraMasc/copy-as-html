import { App, Editor, Platform, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import { Converter, extension, subParser, ConverterGlobals } from 'showdown';
import { createExtension } from 'src/extension';


import {DEFAULT_SETTINGS, MarkdownToHTMLSettingTab, MarkdownToHTMLSettings} from "src/settings"
import { MDConverter } from './src/converter';





export default class MarkdownToHTML extends Plugin {
	settings: MarkdownToHTMLSettings;
	converter: MDConverter = new MDConverter(this)

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'copy-as-html-command',
			name: 'Copy as HTML command',
			icon:'code-xml',
			editorCallback: (editor: any) => this.converter.selectionToHTML(editor)
		});
		this.addCommand({
			id: 'copy-as-img-command',
			name: 'Copy as img command',
			icon: "image-plus",
			editorCallback: (editor: any) => this.converter.selectionToPNG(editor)
		});

		this.addSettingTab(new MarkdownToHTMLSettingTab(this.app, this));
	}

	/**Writes to clipboard as soon as it becomes possible */
	writeToClipboard(data:ClipboardItems) {
	const func = ()=> navigator.clipboard.write(data);
	if(document.hasFocus())
		return func();
    return new Promise<void>((resolve, reject) => {
        const _asyncCopyFn = (async () => {
            try {
                await func();

                resolve();
            } catch (e) {
                reject(e);
            }
            window.removeEventListener("focus", _asyncCopyFn);
        });
    
        window.addEventListener("focus", _asyncCopyFn);
    });
}



	/**
	 * https://stackoverflow.com/questions/62292885/convert-css-styles-to-inline-styles-with-javascript-keeping-the-style-units 
	 * */
	applyInline(element: HTMLElement, styles: CSSStyleSheet[] | StyleSheetList) {
		const elements = [element, ...element.querySelectorAll("*")];
		const elementRules = document.createElement(element.tagName).style;
		elementRules.cssText = element.style.cssText;
		for (const sheet of styles) {
			let cssRules = {} as CSSRuleList;
			try {
				cssRules = sheet.cssRules;
			} catch (error) {
				//
			}
			for (const rule of Object.values(cssRules) as CSSStyleRule[]) {
				let classNames = this.settings.removeInlined ?
					Array.from(rule.selectorText.matchAll(/((?:\.[\w\-_]+)+)(?:\[.*?\])?(?:($)|,)/gm))
						.flatMap(cn => Array.from(cn[1].matchAll(/(?<=\.)[\w\-_]+/g)).map(r => r[0]))
					: [];

				for (const element of elements as HTMLElement[]) {
					if (!element.matches(rule.selectorText))
						continue;
					element.removeClasses(classNames);
					if (element.className == "")
						element.removeAttribute('class');
					for (const prop of rule.style)
						element.style.setProperty(
							prop,
							elementRules.getPropertyValue(prop) ||
							rule.style.getPropertyValue(prop),
							rule.style.getPropertyPriority(prop)
						);
				}
			}
		}
	}

	

	/**Inlines the chosen styles */
	async inlineStyles(div: HTMLDivElement) {
		const doc = document.implementation.createHTMLDocument("");
		doc.body.append(div);
		let styles: CSSStyleSheet[] = await Promise.all(this.settings.snippets.map(async (snippet) => {
			let style = createEl('style');
			style.textContent = await this.app.vault.adapter.read((this.app as any).customCss.getSnippetPath(snippet))
			doc.head.append(style);
			return style.sheet;
		}))
		this.applyInline(div, styles);
	}

	filterHTML(selector:string, root:HTMLElement){
		try{
			let toRemove = root.querySelectorAll(selector);
			for(let el of toRemove){
				el.detach();
			}
		}catch{
			new Notice("Error in filtering")
		}
	}

	

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		createExtension(this); //Update the extension to match settings
	}

	async saveSettings() {
		await this.saveData(this.settings);
		createExtension(this); //Update the extension to match settings
	}

	onunload() {
		// ...
	}
}
