import  MarkdownToHTML from "main";
import { Editor, Notice, Platform } from "obsidian";
import { Converter } from "showdown";
import {createExtension} from "src/extension"


import {type DomToImage} from "dom-to-image"
import dti  from 'dom-to-image-more'

const  domtoimage:DomToImage =dti; 

/**Class in charge of the actual conversion */
export class MDConverter{
    plugin:MarkdownToHTML;
	constructor (plugin:MarkdownToHTML){
		this.plugin = plugin;
	}

	/**Gets the showdown converter */
	getConverter() {
		const ret =  new Converter({backslashEscapesHTMLTags:true, tasklists:true})
		ret.setFlavor('github');
		ret.setOption('ellipsis', false);
		return ret;
	};

	/**Converts the selection into an html string */
	async selectionToHTML(editor: Editor) {
		let text = editor.getSelection();
		const div = createDiv();
		try {
			this.MDtoHTML(text, div);
			//@ts-ignore
			const blob = new Blob([div.innerHTML], {
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
			await this.plugin.writeToClipboard(data);
			div.detach()
		} catch (err) {
			new Notice("Failed to copy as HTML:\n" + err, null)
			div?.detach()
			throw err;
		}

	}
	
	/**Converts the selection to a PNG image */
	async selectionToPNG( editor: Editor) {
		let text = editor.getSelection();
		const div = createDiv();
		let popup = new Notice("Generating Image", null);
		try {
			this.MDtoHTML(text, div);
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
	
	/**Processes the conversion */
	async MDtoHTML(text:string, container:HTMLDivElement=null):Promise<HTMLDivElement>{
		// TODO: FIX AND IMPLEMENT
		const {settings} = this.plugin;
		container ??= createDiv();
		const converter = this.getConverter();
		try {
			converter.useExtension("extended-tags")

			if (settings.removeComments) {
				text = text.replace(/%%.+?%%/gs, '');
			}
			const html = converter.makeHtml(text).toString();
			let outputHtml = settings.wrapResult ? `<div id="content">${html}</div>` : html;

			container.innerHTML = outputHtml;
			if(settings.useFilter)
				this.plugin.filterHTML(settings.filterSelector, container)
			await this.plugin.inlineStyles(container);
			// TODO: Remove classes
			return container;

		} catch (err) {
			throw new Error("Failed to convert MD to HTML: "+err);
		}
	}

	/**Converts the image to a PNG */
	async nodeToImage(node:HTMLElement){
		// TODO: Refactor and rename nodeToImage
		const {settings} = this.plugin;
		try{
			node.style.maxWidth= Platform.isMobile? settings.renderMaxwidthMobile
					:settings.renderMaxwidth;
			node.style.padding= "2em";
			
		
			
			const blob = await domtoimage.toBlob(node,
				{
					//@ts-ignore
					bgcolor:"rgba(30, 30, 30, 1)", // TODO: Extract from css
					scale:settings.renderScale,

				} as any);
			
			const data = [new ClipboardItem({
				
					[blob.type]: blob,
			
			} as any)];
			await this.plugin.writeToClipboard(data);
			new Notice("Exported to png")
		}catch(err){
			new Notice("Failed to convert to image: "+err)
			throw err
		}
	}
}

