import {addCodeArea, SetFieldAsInvalid, SettingsContext} from "../.sharedModules/obsidian/SettingsUtils"
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import  MarkdownToHTML from "main";

export interface MarkdownToHTMLSettings {
    removeBrackets: boolean;
    removeEmphasis: boolean;
    removeTags: boolean;
    removeComments: boolean;
    /**If obsidian markdown syntax plugin should be supported */
    obsidianSupport: boolean;
    /**If extended markdown syntax plugin should be supported */
    extendedSupport: boolean;
	/**If experimental features should be enabled*/
    experimental: boolean;
    /**If result should be wrapped in a div*/
    wrapResult: boolean;
    /**Snippets to inline*/
    snippets: string[];
    /**If classes with inlined style should be removed*/
    removeInlined: boolean;
    /**Maximum width of the html container when rendering as png */
    renderMaxwidth:string;
    /**Enables selector filtering*/
    useFilter: boolean;
    /**Annotation selector*/
    filterSelector:string;
    /**Rendering scale*/
    renderScale:number;
}


export const DEFAULT_SETTINGS: MarkdownToHTMLSettings = {
    removeBrackets: true,
    removeEmphasis: false,
    removeTags: false,
    obsidianSupport: true,
    extendedSupport: false,
	experimental:false,
    removeComments: true,
    wrapResult: true,
    snippets: [],
    removeInlined: false,
    renderMaxwidth:"60vw",
    useFilter:false,
    filterSelector:"",
    renderScale: 2,
};



export class MarkdownToHTMLSettingTab extends PluginSettingTab {
	plugin: MarkdownToHTML;

	constructor(app: App, plugin: MarkdownToHTML) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		let settings = this.plugin.settings;
		containerEl.empty();
		this.addToggle(containerEl, 'removeBrackets', "Remove Wikilink brackets", "If enabled, removes wikilink brackets from copied text.")
		this.addToggle(containerEl, 'removeEmphasis', "Remove text emphasis", "If enabled, removes text styling such as bold, italics, and highlights.")
		this.addToggle(containerEl, 'removeTags', "Remove hashtags", "If enabled, removes text immediately after a hashtag.")
		this.addToggle(containerEl, 'removeComments', "Remove comments", "If enabled, removes commented text.")
		this.addToggle(containerEl, 'obsidianSupport', "Support Obsidian Markdown Syntax", "If enabled, it will handle highlights, tags and other obsidian specific elements.")
		this.addToggle(containerEl, 'extendedSupport', "Support Extended Markdown Syntax", "If enabled, it will handle custom spans and other highlight colors.")
		this.addToggle(containerEl, 'experimental', "Enable experimental features", "Mostly for testing, enables unreliable features that might not be production ready")
		this.addToggle(containerEl, 'wrapResult', "Wrap the output", "If enabled, it will wrap the resulting HTML in a div.")
		this.addToggle(containerEl, "removeInlined", "Remove inlined classes", "If enabled, classes that have had their style inlined will be removed from the HTML")
		this.addTextField(containerEl, "renderMaxwidth", "Max render width", "CSS for the maximum container width when rendering markdown to PNG")
		 new Setting(containerEl).setName("Render scale").setDesc("Sets the rendering scale")
			.addSlider(
				slider => slider.setLimits(1,10,0.5)
					.setValue(settings.renderScale)
					.setDynamicTooltip()
					.onChange(async v => {settings.renderScale = v; await this.plugin.saveSettings()})
			)

		// TODO: adaptative scale
		this.addToggle(containerEl, 'useFilter', "Activates selector filtering", "Allows to 'filter' the generated html to remove elements")

        //Filter code area
		const context:SettingsContext<MarkdownToHTMLSettings> = {containerEl, plugin:this.plugin,settings}
		const validator = (input:string, field:TextAreaComponent) => { 
            const el = createDiv();
            try{
                if(input)
                    el.querySelector(input)
                SetFieldAsInvalid(field,false);
                return true
            }catch{
                console.warn("Invalid code input")
                SetFieldAsInvalid(field,true);
                return false
            }
            
        }

        
		addCodeArea<MarkdownToHTMLSettings>(context, "filterSelector", "Filter selector", "Query to use to determine which HTML elements should be removed from the output", validator)
		// TODO: Add validation


		
		
		// Display snippets
		// TODO: rework snippets
		let desc = containerEl.createEl('details')
		let summary = desc.createEl('summary')
		new Setting(summary)
			.setName("Snippets")
			.setHeading()
		let activeSnippets = this.plugin.settings.snippets
		for (let snippet of (this.app as any).customCss.snippets) {
			new Setting(desc)
				.setName(snippet)
				.addToggle(toggle => toggle
					.setValue(activeSnippets.contains(snippet))
					.onChange(async (value) => {
						if (value) {
							if (!activeSnippets.contains(snippet))
								activeSnippets.push(snippet)
						} else {
							activeSnippets.remove(snippet)
						}
						await this.plugin.saveSettings();
					}));
		}


	}


	private addToggle(el: HTMLElement, prop: SettingProps, name: string, descr: string) {
		new Setting(el)
			.setName(name)
			.setDesc(descr)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings[prop])
				.onChange(async (value) => {
					this.plugin.settings[prop] = value;
					await this.plugin.saveSettings();
				}));
	}

	private addTextField(el: HTMLElement, prop: SettingTextFields, name: string, descr: string) {
		new Setting(el)
			.setName(name)
			.setDesc(descr)
			.addText(text => text
				.setValue(this.plugin.settings[prop])
				.onChange(async (value) => {
					this.plugin.settings[prop] = value;
					await this.plugin.saveSettings();
				}));
	}

	private addTextAreaField(el: HTMLElement, prop: SettingTextFields, name: string, descr: string) {
		new Setting(el)
			.setName(name)
			.setDesc(descr)
			.addTextArea(text => text
				.setValue(this.plugin.settings[prop])
				.onChange(async (value) => {
					this.plugin.settings[prop] = value;
					await this.plugin.saveSettings();
				}));
			
	}
}

export type SettingProps = keyof { [P in keyof MarkdownToHTMLSettings as MarkdownToHTMLSettings[P] extends boolean ? P : never]: P }
export type SettingTextFields = keyof { [P in keyof MarkdownToHTMLSettings as MarkdownToHTMLSettings[P] extends string ? P : never]: P } 
