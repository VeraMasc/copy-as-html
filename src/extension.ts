import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import  MarkdownToHTML from "main";
import { Converter, extension, subParser, ConverterGlobals,ShowdownOptions } from 'showdown';

	/**Creates the listener extension needed to handle tags without breaking codeblocks */
export function  createExtension_(plugin:MarkdownToHTML) {
		let settings = plugin.settings;
		extension('extended-tags', function () {
			var myext = {
				type: 'listener',
				listeners: {
					'hashBlock.before':function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
						// TODO: Fully implement rendering callouts

						if(settings.experimental && /^<blockquote>\s*<p>\[!/.test(text)){
							text = text.replace(/(?<=^<blockquote)>\s*<p>\[!([^\[\]]+)](?:\s([^\n]+?)(?=<(?:\/p|br\s*\/)>|$\n))?/, (str:string, ...match)=>{
								// console.warn(str,match)
								let type = match[0];
								if(!type)
									return str;
								let title = match![1] ?? (type.charAt(0).toUpperCase() + type.slice(1));
								return ` class="callout" data-callout="${type}">\n<div class="callout-title">${title}</div>\n<p>`;
							})

							// let match = /^(<blockquote)(>\s*<p>)\[!([^\[\]]+)](?:(\s[^\n]+)(?:<\/p>)?)?/.exec(text)
							// // console.warn(text,match)
							// let type = match?.[3]
							// if(type){
							// 	let title = match![4] ?? (type.charAt(0).toUpperCase() + type.slice(1));
							// 	// HACK: Properly handle callout titles having a </p> at the end
							// 	title = title.replace(/<\/p>$/,'')
							// 	text = `<blockquote class="callout" data-callout="${type}">\n<div class="callout-title">${title}</div>\n<p>` +text.slice(match![0].length)
							// }
							
						}
						
						return text;
					},
					'anchors.before': function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
						//Match wikilinks
						text = text.replace(/\[\[([^|\]#]*)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g, (str:string, ...matches)=>{
							console.log(str, matches)
							let path = encodeURI(matches[0]) + (matches[1]? '#'+ encodeURI(matches[1]):'');
							// console.warn(path)
							let title = matches[2] ?? (
								(matches[0] && matches[1])? 
									matches[0]+'#'+matches[1]
									:(matches[0] || matches[1] || '')
							);
							return `[${title}](${path})`;
						})

						// TODO: Fix links and wikilinks starting with "#"
						
						return text;
					},

					// 'anchors.after': function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {

					// 	return text;
					// },
					'italicsAndBold.before': function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
						//Cleanup
						let {removeTags, obsidianSupport, removeEmphasis, removeBrackets} = settings;
						text = text.replace(/\^\w+$/g, ''); //removing block reference ids
						if (removeTags || obsidianSupport)
							text = text.replace(/((?<!\S)#\w+)/g, removeTags ? '' : '<a class="tag">$1</a>');
						if (removeEmphasis) {
							text = text.replace(/[*~]+(\w+)[*~]+/g, '$1');
						}
						if (removeBrackets) {
							text = text.replace(/\[\[(.*?)\]\]/g, '$1');
						}
						return text;
					},
					'strikethrough.after': function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
						//Obsidian
						if (settings.obsidianSupport) {
							// TODO: Add new regex hilights
							// Hilights and Custom highlights
							text = text
								.replace(/\=\=(?:{(.*?)})?(.+?)\=\=/g, (str:string, ...match)=>{
									let [type, text] = match;
									let hlClass = type? '' : ' cm-custom-highlight-'+type;
									return `<span class="cm-custom-highlight cm-highlight${hlClass}">${text}</span>`
								}) 
							
						}
						//Extended
						if (settings.extendedSupport) {

							
							text = text
								.replace(/\^(.+?)\^/g, '<sup>$1</sup>') //Superscript 
								.replace(/\~(.+?)\~/g, '<sub>$1</sub>') //Subscript
								.replace(/(?<!\!)!!{([\w\s-]*?)}(.+?)!!(?<![!\s]\!\!)(?!\!)/g, '<span class="$1">$2</span>');//Custom spans
							
							// TODO: add spoilers and other stuff
							// TODO: Allow custom tag delimiters?
							// TODO: support block styling
							// TODO: Check for regex bugs
						}
						return text;
					},
					'hashHTMLBlocks.after':function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
						//Force showdown to parse html spans
						// HACK: This is needed to stop parser from fucking up inline html elements
						return subParser("hashHTMLSpans")(text,options,globals)
						// TODO: Replace Showdown with parser that doesn't break nested spans
					},

					"paragraphs.after":function (event: string, text: string, converter: Converter, options: ShowdownOptions, globals: ConverterGlobals) {
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