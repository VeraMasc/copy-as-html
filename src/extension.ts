import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import  MarkdownToHTML from "main";
import { Converter, extension, subParser, ConverterGlobals } from 'showdown';

	/**Creates the listener extension needed to handle tags without breaking codeblocks */
export function  createExtension(this:MarkdownToHTML) {
		let settings = this.settings;
		extension('extended-tags', function () {
			var myext = {
				type: 'listener',
				listeners: {
					'italicsAndBold.before': function (event: any, text: any, converter: any, options: any, globals: any) {
						//Cleanup
						text = text.replace(/\^\w+$/g, ''); //removing block reference ids
						if (settings.removeTags || settings.obsidianSupport)
							text = text.replace(/(#\w+)/g, settings.removeTags ? '' : '<span class="tag">$1</span>');
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
						if (settings.obsidianSupport) {
							//Custom highlight
							text = text.replace(/\=\=(?:{(.*?)})(.+?)\=\=/g, '<span class="cm-custom-highlight cm-highlight cm-custom-highlight-$1">$2</span>');
							//Highlights
							text = text.replace(/\=\=(.+?)\=\=/g, '<span class="cm-custom-highlight cm-highlight">$1</span>');
							
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
							// TODO: support block styling
						}
						return text;
					},
					'hashHTMLBlocks.after':function (event: any, text: any, converter: any, options: any, globals: any) {
						//Force showdown to parse html spans
						// HACK: This is needed to stop parser from fucking up inline html elements
						return subParser("hashHTMLSpans")(text,options,globals)
						// TODO: Replace Showdown with parser that doesn't break nested spans
					},

					"paragraphs.after": function (event: any, text: string, converter: any, options: any, globals: any) {
						if(settings.experimental){
							// Split in basic paragraphs (warning: not all block elements will separate)
							let paragraphs = text.split(/(?<=<\/p>)\n/gm)
							paragraphs = paragraphs.map((str)=>{
								let match = text.match(/^<p>::::*([\w\-\u0020]+)<br \/>\n/)
								if(match){
									str = str.slice(match[0].length)
									str = `<p class="${match[1]}">`+str;
								}
								return str;
							})
							text = paragraphs.join("\n");
							
						}
						return text;
					}
				}
			};
			return [myext];
		});
	}