import { App, Editor, Platform, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import { Converter, extension, subParser, ConverterGlobals } from 'showdown';
import {type DomToImage} from "dom-to-image"

import dti  from 'dom-to-image-more'
import {DEFAULT_SETTINGS, MarkdownToHTMLSettingTab, MarkdownToHTMLSettings} from "src/settings"
import {createExtension} from "src/extension"

const  domtoimage:DomToImage =dti; 


export default class MarkdownToHTML extends Plugin {
	settings: MarkdownToHTMLSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'copy-as-html-command',
			name: 'Copy as HTML command',
			icon:'code-xml',
			editorCallback: (editor: any) => this.markdownToHTML(editor)
		});
		this.addCommand({
			id: 'copy-as-img-command',
			name: 'Copy as img command',
			icon: "image-plus",
			editorCallback: (editor: any) => this.markdownToPNG(editor)
		});

		this.addSettingTab(new MarkdownToHTMLSettingTab(this.app, this));
	}

	/**Gets the showdown converter */
	getConverter() {
		return new Converter({backslashEscapesHTMLTags:true, tasklists:true})
	};

	async markdownToHTML(editor: Editor) {
		const converter = this.getConverter();
		converter.setFlavor('github');
		converter.setOption('ellipsis', false);
		let text = editor.getSelection();
		const div = createDiv();
		try {
			createExtension.call(this);
			converter.useExtension("extended-tags")

			if (this.settings.removeComments) {
				text = text.replace(/%%.+?%%/gs, '');
			}
			const html = converter.makeHtml(text).toString();
			let outputHtml = this.settings.wrapResult ? `<div id="content">${html}</div>` : html;
			// TODO: Refactor
			div.style.maxHeight = '0';
			div.style.overflow = 'hidden';
			div.innerHTML = outputHtml;
			if(this.settings.useFilter)
				this.filterHTML(this.settings.filterSelector, div)
			await this.inlineStyles(div);
			// TODO: Remove classes
			outputHtml = div.innerHTML;
			//@ts-ignore
			const blob = new Blob([outputHtml], {
				//@ts-ignore
				type: ["text/plain", "text/html"]
			})
			const data = [new ClipboardItem({
				//@ts-ignore
				["text/plain"]: blob,
				//@ts-ignore
				["text/html"]: blob
			})];
			//@ts-ignore
			navigator.clipboard.write(data);
			div.detach()
		} catch (err) {
			new Notice("Failed to copy as HTML:\n" + err, null)
			div?.detach()
			throw err;
		}

	}

async markdownToPNG(editor: Editor) {
		const converter = this.getConverter();
		converter.setFlavor('github');
		converter.setOption('ellipsis', false);
		let text = editor.getSelection();
		const div = createDiv();
		let popup = new Notice("Generating Image", null);
		try {
			createExtension.call(this);
			converter.useExtension("extended-tags")

			if (this.settings.removeComments) {
				text = text.replace(/%%.+?%%/gs, '');
			}
			const html = converter.makeHtml(text);
			let outputHtml = this.settings.wrapResult ? `<div id="content">${html}</div>` : html;
			// TODO: Refactor
			// div.style.maxHeight = '0';
			// div.style.overflow = 'hidden';
			div.innerHTML = outputHtml;
			if(this.settings.useFilter)
				this.filterHTML(this.settings.filterSelector, div)
			// await this.inlineStyles(div);
			document.body.append(div)
			await this.nodeToImage(div)
			popup.hide();
			div.detach()
		} catch (err) {
			popup.hide();
			new Notice("Failed to copy as IMG:\n" + err, null)
			div?.detach()
			throw err;
		}

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

	async nodeToImage(node:HTMLElement){
		try{
			node.style.maxWidth= Platform.isMobile? this.settings.renderMaxwidthMobile
					:this.settings.renderMaxwidth;
			node.style.padding= "2em";
			
		
			
			const blob = await domtoimage.toBlob(node,
				{
					//@ts-ignore
					bgcolor:"rgba(30, 30, 30, 1)", // TODO: Extract from css
					scale:this.settings.renderScale,

				} as any);
			
			const data = [new ClipboardItem({
				
					[blob.type]: blob,
			
				} as any)];
				navigator.clipboard.write(data);
			new Notice("Exported to png")
		}catch(err){
			new Notice("Failed to convert to image: "+err)
			throw err
		}
	}

	/**Inlines the chosen styles */
	private async inlineStyles(div: HTMLDivElement) {
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

	private filterHTML(selector:string, root:HTMLElement){
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		// ...
	}
}
