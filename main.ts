import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, MarkdownRenderer,requestUrl, RequestUrlResponse } from 'obsidian';
import { text } from 'stream/consumers';

async function scrapeWebpage(url: string) {
    try {
        // Use Obsidian's built-in requestUrl instead of fetch
        const response: RequestUrlResponse = await requestUrl({
            url: url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.text;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc;
    } catch (error) {
        console.error('Error fetching webpage:', error);
        throw new Error(`Failed to fetch webpage: ${error.message}`);
    }
}


async function getSynonymData(url: string){
	const doc = await scrapeWebpage(url);
	const textContents: string[] = [];

	// Get all elements with class 'engthes'
	const engthesElements = doc.getElementsByClassName('engthes');

	Array.from(engthesElements).forEach(element => {
        // Get immediate children of engthes element
        const children = element.children;
        Array.from(children).forEach(child => {
			const children2 = child.children;
			Array.from(children2).forEach(child => {
				if (!child.getAttribute('style')?.includes('text-decoration')) { // theres probably a better way to get this element
					// Get all direct span elements
					// console.log(child);
					const spans = child.querySelectorAll(':scope > span');
					// console.log(spans)
					spans.forEach(span => {
						const text = span.textContent?.trim();
						if (text && text !== '...') {
							textContents.push(text);
						}
					});
				}
			});
        });
    });

	// Remove duplicates and filter out empty strings
	return [...new Set(textContents)].filter(Boolean);
}
async function getEtymology(url: string){
	const doc = await scrapeWebpage(url);
	const textContents: Record<string, string> = {};
	// Get all elements with class 'engthes'
	const definitions = doc.querySelectorAll('.ant-col-xs-24 > .word--C9UPa');
	// Get immediate children of engthes element
	Array.from(definitions).forEach(child => {
		const children = child.querySelectorAll(':scope > * > * > *');
		let word = '';
		let text = '';
		console.log(children);
		Array.from(children).forEach(child => {
			if(child.classList.contains('word__name--TTbAA')){
				word = child.textContent ?? '';
			} else if(child.classList.contains('word__defination--2q7ZH')){
				text = child.querySelectorAll(':scope > *')[0].textContent ?? '';
			}
		});
		textContents[word] = text;
	});
	console.log(textContents);
}
// Remember to rename these classes and interfaces!
const VIEW_TYPE_EXAMPLE = "example-view";
 
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
        this.registerView(
            VIEW_TYPE_EXAMPLE,
            (leaf) => new ExampleView(leaf)
        );

		this.addCommand({
			id: 'Get-Synonyms',
			name: 'Get Synonyms',
			editorCallback: async (editor: Editor) => {
				const selection = editor.getSelection();
				this.activateView(selection);
			},
			hotkeys: [
                {
                    modifiers: ['Mod', 'Shift'],
                    key: 'Y'
                }
            ],
		});
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_EXAMPLE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	async activateView(word: string) {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE)[0];
		console.log('START');

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) { // Ensure rightLeaf is not null
				await rightLeaf.setViewState({
					type: VIEW_TYPE_EXAMPLE,
					active: true,
				});
				// Ensure `leaf` is updated after setting the view state
				leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE)[0];
			} else {
				// Fallback if no right leaf is available
				console.log('No right leaf; Fallback');
				return;
			}
		}

		if (leaf) {
			getEtymology(`https://www.etymonline.com/word/${word}`)
			const view = leaf.view as ExampleView;
            view.updateContent(word || '');
            workspace.revealLeaf(leaf);
		}
    }
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
class ExampleView extends ItemView {
    private header: string = '';
    private synonymsList: string[] = [];
	private definition: any = '';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_EXAMPLE;
    }

    getDisplayText(): string {
        return "Synonyms View";
    }

    async onOpen() {
        this.updateViewContent();
    }
	async updateContent(word: string) {
		this.header = word;
	
		// Run both promises concurrently
		const [synonymsList, definition] = await Promise.all([
			this.getSynonyms(word),
			this.getWordDefinition(word),
		]);
	
		// Update properties with resolved values
		this.synonymsList = synonymsList;
		this.definition = definition;
	
		// Update the view content after both are done
		this.updateViewContent();
	}
	

    private async updateViewContent() {
        const container = this.containerEl.children[1];
        container.empty();

        if (this.header) {
            container.createEl("h2", { text: `${capitalizeFirstLetter(this.header)}` });
        }
		if (this.definition) {
			const definitionContainer = container.createDiv({
				cls: 'definition-container'
			});
			
			// Create main details for all definitions
			const definitionsDetails = definitionContainer.createEl('details');
			const definitionsSummary = definitionsDetails.createEl('summary');
			definitionsDetails.setAttribute('open', '');

			await MarkdownRenderer.render(
				this.app,
				`#### Definitions`,
				definitionsSummary,
				'',
				this
			);
			
			for (const meaning of this.definition) {
				const details = definitionsDetails.createEl('details', {
					cls: 'definition-part'
				});
				
				const summary = details.createEl('summary');
				
				// Create a separate div for the part of speech
				const partOfSpeechDiv = summary.createDiv();
				await MarkdownRenderer.render(
					this.app,
					`###### ${capitalizeFirstLetter(meaning.partOfSpeech)}`,
					partOfSpeechDiv,
					'',
					this
				);
				
				// Create a div for the definitions
				const defsDiv = details.createDiv({
					cls: 'definition-list'
				});
				
				const defsMarkdown = meaning.definitions
					.map((def: string, index: number) => `${index + 1}. ${def}`)
					.join('\n');
				
				await MarkdownRenderer.render(
					this.app,
					defsMarkdown,
					defsDiv,
					'',
					this
				);
			}
		}
		
		// Create main details for synonyms
		const synonymsDetails = container.createEl('details');
		const synonymsSummary = synonymsDetails.createEl('summary');
		synonymsDetails.setAttribute('open', '');

		await MarkdownRenderer.render(
			this.app,
			`#### Synonyms`,
			synonymsSummary,
			'',
			this
		);
		
		if (this.synonymsList.length > 0) {
			const synonymsList = synonymsDetails.createEl("ul");
			synonymsList.classList.add("SynonymList");
			
			this.synonymsList.forEach(synonym => {
				const listItem = synonymsList.createEl("li", { 
					text: capitalizeFirstLetter(synonym) 
				});
			});
		} else {
			synonymsDetails.createEl("p", { text: "No synonyms found." });
		}
	}

    async onClose() {
        // Cleanup, if needed
    }
	async getSynonyms(word: string) {
		let data: string[] = [];
		data = await getSynonymData(`https://www.wordreference.com/synonyms/${word}`);
		if (data.length == 0){
			const response = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
			data = await response.json();
			return (data as any).map((item: any) => item.word);
		}
		return data;
	}
	async getWordDefinition(word: string) {
		try {
			const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
			const data = await response.json();
			
			if ((data as any).length > 0) {
				// Extract meanings
				const meanings = (data as any)[0].meanings.map((meaning: any) => {
					return {
						partOfSpeech: meaning.partOfSpeech,
						definitions: meaning.definitions.map((def: any) => def.definition)
					};
				});
				
				return meanings;
			}
			return null;
		} catch (error) {
			console.error('Error fetching definition:', error);
			return null;
		}
	}
}

function capitalizeFirstLetter(str: string): string {
    if (str.length === 0) {
        return str; // Return the original string if it's empty
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}