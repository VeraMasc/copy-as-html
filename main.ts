import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as showdown from 'showdown';

interface MarkdownToHTMLSettings {
	removeBrackets: boolean;
	removeEmphasis: boolean;
	removeTags: boolean;
	removeComments: boolean;
	/**If obsidian markdown syntax plugin should be supported */
	obsidianSupport: boolean;
	/**If extended markdown syntax plugin should be supported */
	extendedSupport: boolean;
	/**If result should be wrapped in a div*/
	wrapResult: boolean;
	/**Snippets to inline*/
	snippets: string[];
	/**If classes with inlined style should be removed*/
	removeInlined: boolean;
}


const DEFAULT_SETTINGS: MarkdownToHTMLSettings = {
	removeBrackets: true,
	removeEmphasis: false,
	removeTags: false,
	obsidianSupport: true,
	extendedSupport: false,
	removeComments: true,
	wrapResult: true,
	snippets: [],
	removeInlined: false,
};

export default class MarkdownToHTML extends Plugin {
	settings: MarkdownToHTMLSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: 'copy-as-html-command',
			name: 'Copy as HTML command',
			editorCallback: (editor: any) => this.markdownToHTML(editor)
		});
		this.addSettingTab(new MarkdownToHTMLSettingTab(this.app, this));
	}

	async markdownToHTML(editor: Editor) {
		const converter = new showdown.Converter();
		converter.setFlavor('github');
		converter.setOption('ellipsis', false);
		let text = editor.getSelection();
		const div = createDiv();
		try{
			this.createExtension();
			converter.useExtension("extended-tags")

			if (this.settings.removeComments) {
				text = text.replace(/%%.+?%%/gs, '');
			}
			const html = converter.makeHtml(text).toString();
			let outputHtml = this.settings.wrapResult ? `<div id="content">${html}</div>` : html;
			// TODO: Refactor
			div.style.maxHeight='0';
			div.style.overflow='hidden';
			div.innerHTML=outputHtml;
			
			await this.inlineStyles(div);
			// TODO: Remove classes
			console.log(div);
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
		}catch(err){
			new Notice("Failed to copy as HTML:\n"+err,null)
			div?.detach()
			throw err;
		}

	}


		/**
		 * https://stackoverflow.com/questions/62292885/convert-css-styles-to-inline-styles-with-javascript-keeping-the-style-units 
		 * */
		applyInline(element:HTMLElement, styles:CSSStyleSheet[]|StyleSheetList) {
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
				for (const rule of Object.values(cssRules) as CSSStyleRule[]){
					// let classNames= Array.from(rule.selectorText.matchAll(/((?:\.[\w\-_]+)+)(?:\[.*?\])?(?:($)|,)/gm))
					// 	.flatMap(cn => Array.from(cn[1].matchAll(/(?<=\.)[\w\-_]+/g)).map(r => r[0]))
						
					for (const element of elements as HTMLElement[]){
						if (!element.matches(rule.selectorText))
							continue;
						// element.removeClasses(classNames);
						// if(element.className=="")
						// 	element.removeAttribute('class');
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
	private async inlineStyles(div:HTMLDivElement){
		const doc = document.implementation.createHTMLDocument("");
		doc.body.append(div);
		let styles:CSSStyleSheet[] = await Promise.all(this.settings.snippets.map(async (snippet)=>
		{
			let style = createEl('style');
			style.textContent = await this.app.vault.adapter.read((this.app as any).customCss.getSnippetPath(snippet))
			doc.head.append(style);
			return style.sheet;
		}))
		this.applyInline(div, styles);
	}

	/**Creates the listener extension needed to handle tags without breaking codeblocks */
	private createExtension() {
		// TODO: Test weird edge cases
		let settings = this.settings;
		showdown.extension('extended-tags', function () {
			var myext = {
				type: 'listener',
				listeners: {
					'italicsAndBold.before':function (event: any, text: any, converter: any, options: any, globals: any) {
						//Cleanup
						text = text.replace(/\^\w+$/g, ''); //removing block reference ids
						if( settings.removeTags || settings.obsidianSupport)
							text = text.replace(/(#\w+)/g, settings.removeTags?'':'<span class="tag">$1</span>');
						if (settings.removeEmphasis) {
							text = text.replace(/[*~]+(\w+)[*~]+/g, '$1');
						}
						if (settings.removeBrackets) {
							text = text.replace(/\[\[(.*?)\]\]/g, '$1');
						}
						return text;
					},
					'strikethrough.after': function (event: any, text: any, converter: any, options: any, globals: any) {
						//Obsidian
						if(settings.obsidianSupport){
							//Highlights
							text = text.replace(/\=\=(?:{.*})?(.+?)\=\=/g, '<span class="hilight">$1</span>');
							// TODO: Add highlight color
						}
						//Extended
						if (settings.extendedSupport) {
							
							//Superscript 
							text = text.replace(/\^(.+?)\^/g, '<sup>$1</sup>');
							//Subscript
							text = text.replace(/\~(.+?)\~/g, '<sub>$1</sub>');
							
							
							//Custom spans
							text = text.replace(/!+(?<!\!\!\!)(?![!\s])(?:{([\w\s-]*?)})?(.+?)!+(?<![!\s]\!\!)(?!\!)/g, '<span class="$1">$2</span>');
							// TODO: add spoilers and other stuff
							// TODO: Allow custom tag delimiters? 
						}
						return text;
					}
				}
			};
			return [myext];
		});
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

class MarkdownToHTMLSettingTab extends PluginSettingTab {
	plugin: MarkdownToHTML;

	constructor(app: App, plugin: MarkdownToHTML) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Remove Wikilink brackets")
			.setDesc("If enabled, removes wikilink brackets from copied text.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeBrackets)
				.onChange(async (value) => {
					this.plugin.settings.removeBrackets = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Remove text emphasis")
			.setDesc("If enabled, removes text styling such as bold, italics, and highlights.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeEmphasis)
				.onChange(async (value) => {
					this.plugin.settings.removeEmphasis = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Remove hashtags")
			.setDesc("If enabled, removes text immediately after a hashtag.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeTags)
				.onChange(async (value) => {
					this.plugin.settings.removeTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Remove comments")
			.setDesc("If enabled, removes commented text.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeComments)
				.onChange(async (value) => {
					this.plugin.settings.removeComments = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Support Obsidian Markdown Syntax")
			.setDesc("If enabled, it will handle highlights, tags and other obsidian specific elements.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.extendedSupport)
				.onChange(async (value) => {
					this.plugin.settings.extendedSupport = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Support Extended Markdown Syntax")
			.setDesc("If enabled, it will handle custom spans and other highlight colors.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.extendedSupport)
				.onChange(async (value) => {
					this.plugin.settings.extendedSupport = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Wrap the output")
			.setDesc("If enabled, it will wrap the resulting HTML in a div.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.wrapResult)
				.onChange(async (value) => {
					this.plugin.settings.wrapResult = value;
					await this.plugin.saveSettings();
				}));

				// TODO: add all settings
		new Setting(containerEl)
			.setName("Snippets")
			.setHeading()
			// TODO: add snippets
		let activeSnippets = this.plugin.settings.snippets
		for(let snippet of (this.app as any).customCss.snippets){
			new Setting(containerEl)
			.setName(snippet)
			.addToggle(toggle => toggle
				.setValue(activeSnippets.contains(snippet))
				.onChange(async (value) => {
					if(value){
						if(!activeSnippets.contains(snippet))
							activeSnippets.push(snippet)
					}else{
						activeSnippets.remove(snippet)
					}
					await this.plugin.saveSettings();
				}));
		}
		
	}
}

