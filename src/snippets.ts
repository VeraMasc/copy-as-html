import {Plugin, App} from 'obsidian'

/** Reads the text contents of a specific style snippet */
export async function  getSnippetContent(name:string, app:App):Promise<string>{
    return await app.vault.adapter.read((app as any).customCss.getSnippetPath(name))
}

export async function getAllSnippetContent(snippets:string[],app:App):Promise<string[]>{
    return await Promise.all(snippets.map((s)=> getSnippetContent(s, app)));
}
