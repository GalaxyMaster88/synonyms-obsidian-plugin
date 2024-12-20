import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';

async function fetchWithRetry(url: string): Promise<string> {
	const response = await fetch(url, {});
	return await response .text();
}
async function scrapeWebpage(url: string) {
	const html = await fetchWithRetry(url);
	// console.log(html);
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
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
};


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

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

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
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).first();
		console.log('START');

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) { // Ensure rightLeaf is not null
				await rightLeaf.setViewState({
					type: VIEW_TYPE_EXAMPLE,
					active: true,
				});
				// Ensure `leaf` is updated after setting the view state
				leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).first();
			} else {
				// Fallback if no right leaf is available
				console.log('No right leaf; Fallback');
				return;
			}
		}

		if (leaf) {
			const view = leaf.view as ExampleView;
            view.updateContent(word || '');
            workspace.revealLeaf(leaf);
		}
    }
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
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
            container.createEl("h4", { text: `Synonyms for: ${this.header}` });
        }
		if (this.definition) {
            const definitionContainer = container.createDiv({
                cls: 'definition-container'
            });
            
            
            for (const meaning of this.definition) {
                const details = definitionContainer.createEl('details', {
                    cls: 'definition-part'
                });
                details.setAttribute('open', '');
                
                const summary = details.createEl('summary');
                
                // Create a separate div for the part of speech that will be rendered as markdown
                const partOfSpeechDiv = summary.createDiv();
                await MarkdownRenderer.render(
                    this.app,
                    `### ${meaning.partOfSpeech}`,
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
        if (this.synonymsList.length > 0) {
            const synonymsList = container.createEl("ul");
            this.synonymsList.forEach(synonym => {
                synonymsList.createEl("li", { text: synonym });
            });
        } else {
            container.createEl("p", { text: "No synonyms found." });
        }
    }

    async onClose() {
        // Cleanup, if needed
    }
	async getSynonyms(word: string) {
		let data: string[] = [];
		data = await scrapeWebpage(`https://www.wordreference.com/synonyms/${word}`);
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
