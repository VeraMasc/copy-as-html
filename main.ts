import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as showdown from 'showdown';

interface MarkdownToHTMLSettings {
    removeBrackets: boolean;
    removeEmphasis: boolean;
    removeTags: boolean;
    removeComments: boolean;
    /**If result should be wrapped in a div*/
    wrapResult: boolean;
    /**Snippets to inline*/
    snippets:[];
  }
  

  const DEFAULT_SETTINGS: MarkdownToHTMLSettings = {
    removeBrackets: true,
    removeEmphasis: false,
    removeTags: false,
    removeComments: false,
    wrapResult:true,
    snippets:[]
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

    markdownToHTML(editor: Editor) {
        const converter = new showdown.Converter();
        converter.setFlavor('github');
        converter.setOption('ellipsis', false);
        let text = editor.getSelection();
        // TODO: Handle highlights /==(.+?)==/g
        text = text.replace(/==/g, ''); //removing highlighted text emphasis (showdown doesn't handle it)
        // TODO: Handle custom spans
        text = text.replace(/\^\w+/g, ''); //removing block reference ids
        if (this.settings.removeBrackets) {
            text = text.replace(/\[\[(.*?)\]\]/g, '$1');
          }
          
        if (this.settings.removeEmphasis) {
            text = text.replace(/[*~]+(\w+)[*~]+/g, '$1');
          }
          
        if (this.settings.removeTags) {
            text = text.replace(/#\w+/g, '');
          }

        if (this.settings.removeComments) {
            text = text.replace(/%%.+%%/g, '');
          }
        const html = converter.makeHtml(text).toString();
        const outputHtml = this.settings.wrapResult?`<div id="content">${html}</div>`:html;

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
    }
  }
  
