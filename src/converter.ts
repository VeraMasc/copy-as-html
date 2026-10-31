import  MarkdownToHTML from "main";
import { Editor, MarkdownFileInfo, MarkdownView, normalizePath, Notice, Platform } from "obsidian";
import { Converter } from "showdown";
import {createExtension_} from "src/extension"


import {type DomToImage} from "dom-to-image"
import dti  from 'dom-to-image-more'
import { getAllSnippetContent } from "./snippets";

const  domtoimage =dti;

type ConverterContext = MarkdownView | MarkdownFileInfo;

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
	

	/**
	 * Wraps all the selection conversion functions for error handling 
	 * @param editor editor (to extract the selection)
	 * @param ctx view context, needed only for advanced features
	 * @param func function to execute on the selected text
	 * @param operation name of the operation for messaging purposes
	 * */
	private async _selectionWrapper_<T>(editor: Editor, ctx:ConverterContext, operation:string, func:(this:MDConverter, str:string, ctx?:ConverterContext)=>Promise<T>) {
		let text = editor.getSelection();
		
		try {
			await func.call(this, text, ctx)
		} catch (err) {
			new Notice(`${operation} Failed:\n${err}`)
			throw err;
		}
	}

	/** Transforms the selection into html */
	selectionToHTML(editor:Editor):Promise<void> {
		const div = createDiv();
		let func = function (this:MDConverter ,text:string){ return this._textToHTML_(text, div)};
		return this._selectionWrapper_(editor,null as any,"Selection to Html", func)
			.finally(()=> div?.detach()) //Ensures the div is detached no matter what
	}

	/**Converts the selection into an html string */
	private async _textToHTML_(text:string, div:HTMLDivElement) {
	
		this.MDtoHTML(text, div);
		//@ts-ignore
		const blob = new Blob([div.innerHTML], {
			//@ts-ignore
			type: ["text/plain", "text/html"],
		})
		const data = [new ClipboardItem({
			//@ts-ignore
			["text/plain"]: blob,
			//@ts-ignore
			["text/html"]: blob,
		})];
		//@ts-ignore
		await this.plugin.writeToClipboard(data);
			

	}

	/** Transforms the selection into html */
	selectionToHTMLDoc(editor:Editor, ctx:ConverterContext):Promise<void> {
		const div = createDiv();
		//Function to wrap with the error handling
		let func = function (this:MDConverter ,text:string){ 
			return this.textToHTMLDoc(text, ctx, div); 
		};
		return this._selectionWrapper_(editor, ctx,"Export to Html Document", func)
			.finally(()=> div?.detach()) //Ensures the div is detached no matter what
	}

	async textToHTMLDoc(text:string, ctx:ConverterContext, div:HTMLDivElement) {
		await this.MDtoHTML(text, div);
		let {settings, app}=this.plugin;
		let styles: string[] = await getAllSnippetContent(settings.snippets, app)
		let doc = `<head><style>${styles}</style></head><body class="is-exported">${div.innerHTML}</body>`
		console.warn(doc);
		if(!ctx.file)
			throw new ReferenceError("Could not find source file")
		
		let docpath = ctx.file.parent!.path;
		let docname = normalizePath(`${docpath}/${ctx.file.basename}.html`)
		let adapter = ctx.app.vault.adapter;
		let exists = await adapter.exists(docname)
		if(!exists){
			await adapter.write(docname,doc)
		}else{
			console.error(`File ${docname} already exists`)
		}
	
	}
	
	/**Converts the selection to a PNG image */
	async selectionToPNG( editor: Editor) {
		let text = editor.getSelection();  // TODO: Migrate to the wrapper error handling
		const div = createDiv();
		let popup = new Notice("Generating Image");
		try {
			this.MDtoHTML(text, div);
			document.body.append(div)
			
			await this.nodeToImage(div)
			popup.hide();
			div.detach()
		} catch (err) {
			popup.hide();
			new Notice("Failed to copy as IMG:\n" + err )
			div?.detach()
			throw err;
		}

	}
	
	/**Processes the conversion */
	async MDtoHTML(text:string, container:HTMLDivElement|null=null):Promise<HTMLDivElement>{
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
					httpTimeout: 1000,
					styleCaching: "relaxed",
					disableEmbedFonts:false, //Improves speed a lot but breaks fonts
					copyDefaultStyles:true,
					// TODO: Consider not embedding fonts or adding a toggle for that
					// TODO: Embedding fonts throttles everything, find a way to optimize it

				} as dti.Options);
			
			const data = [new ClipboardItem({
				
					[blob.type]: blob,
			
			} as any)];
			await this.plugin.writeToClipboard(data);
			new Notice(`Exported to png (${blob.size})`)
		}catch(err){
			new Notice("Failed to convert to image: "+err)
			throw err
		}
	}
}

