import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf} from 'obsidian';

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
		async function getSynonyms(word: string) {
			const response = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
			const data = await response.json();
			return data.map((item: any) => item.word);
		}
		  
		this.addCommand({
			id: 'Get-Synonyms',
			name: 'Get Synonyms',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				getSynonyms(selection).then(synonymsList => {
					this.activateView(selection, synonymsList);
				});
			},
			hotkeys: [
                {
                    modifiers: ['Mod', 'Shift'], // 'Mod' is cross-platform for Cmd (Mac) or Ctrl (Windows/Linux)
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
	async activateView(word: string, synonyms: string[]) {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE).first();

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) { // Ensure rightLeaf is not null
				leaf = (await rightLeaf.setViewState({
					type: VIEW_TYPE_EXAMPLE,
					active: true,
				})) as unknown as WorkspaceLeaf; // Type assertion
			} else {
				// Fallback if no right leaf is available
				return;
			}
		}
	
		if (leaf) {
			const view = leaf.view as ExampleView;
            view.updateContent(word || '', synonyms || []);
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

    updateContent(word: string, synonyms: string[]) {
        this.header = word;
        this.synonymsList = synonyms;
        this.updateViewContent();
    }

    private updateViewContent() {
        const container = this.containerEl.children[1];
        container.empty();

        if (this.header) {
            container.createEl("h4", { text: `Synonyms for: ${this.header}` });
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
}
