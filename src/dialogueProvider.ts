import * as vscode from 'vscode';
import * as utils from './utils';
import * as path from 'path';
import { DebugHelper } from './debug';

/**
 * Manages dialogue translations for the current workspace
 */
export class DialogueProvider {
    private translations: Map<string, string> = new Map();
    private langFilePath: string | null = null;
    private workspaceRoot: string;
    private debugHelper: DebugHelper;

    constructor(workspaceRoot: string, debugHelper: DebugHelper) {
        this.workspaceRoot = workspaceRoot;
        this.debugHelper = debugHelper;
    }

    /**
     * Initialize the dialogue provider by finding and parsing the language file
     */
    public async initialize(): Promise<boolean> {
        this.debugHelper.log(`Initializing DialogueProvider for ${this.workspaceRoot}`);
        
        if (!await utils.isMinecraftBedrockProject(this.workspaceRoot)) {
            this.debugHelper.log('Not a Minecraft Bedrock project');
            vscode.window.showInformationMessage('Not a Minecraft Bedrock project. Dialogue translation features are disabled.');
            return false;
        }
        
        this.debugHelper.log('Minecraft Bedrock project detected');
        this.langFilePath = await utils.getLangFilePath(this.workspaceRoot);
        
        if (!this.langFilePath) {
            this.debugHelper.log('Could not find a language file');
            vscode.window.showWarningMessage('Could not find a language file (en_US.lang). Hover translations will not work.');
            return false;
        }

        this.debugHelper.log(`Found language file: ${this.langFilePath}`);
        
        try {
            this.translations = await utils.parseLangFile(this.langFilePath);
            
            const count = this.translations.size;
            this.debugHelper.log(`Loaded ${count} dialogue translations from ${path.basename(this.langFilePath)}`);
            
            // Log a few sample translations for debugging
            if (count > 0) {
                this.debugHelper.log('Sample translations:');
                let samples = 0;
                for (const [key, value] of this.translations.entries()) {
                    if (key.startsWith('dialogue.') && samples < 5) {
                        this.debugHelper.log(`  ${key} = ${value}`);
                        samples++;
                    }
                }
            } else {
                this.debugHelper.log('No dialogue translations found in language file');
            }
            
            vscode.window.showInformationMessage(`Loaded ${count} dialogue translations from ${path.basename(this.langFilePath)}`);
            
            // Setup file watcher for language file to reload when it changes
            const watcher = vscode.workspace.createFileSystemWatcher(this.langFilePath);
            watcher.onDidChange(() => this.reloadTranslations());
            
            return true;
        } catch (error) {
            this.debugHelper.log(`Error loading translations: ${error}`);
            vscode.window.showErrorMessage(`Error loading translations: ${error}`);
            return false;
        }
    }

    /**
     * Reload translations from the language file
     */
    private async reloadTranslations(): Promise<void> {
        if (!this.langFilePath) {
            return;
        }

        this.debugHelper.log(`Reloading translations from ${this.langFilePath}`);
        
        try {
            this.translations = await utils.parseLangFile(this.langFilePath);
            this.debugHelper.log(`Reloaded ${this.translations.size} dialogue translations`);
            vscode.window.showInformationMessage(`Reloaded ${this.translations.size} dialogue translations`);
        } catch (error) {
            this.debugHelper.log(`Error reloading translations: ${error}`);
            vscode.window.showErrorMessage(`Error reloading translations: ${error}`);
        }
    }

    /**
     * Get the translation for a dialogue key
     */
    public getTranslation(key: string): string | undefined {
        const translation = this.translations.get(key);
        this.debugHelper.log(`Getting translation for key: ${key} = ${translation || 'not found'}`);
        return translation;
    }
    
    /**
     * Provide hover information for dialogue keys in the document
     */
    public provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        this.debugHelper.log(`Providing hover at ${position.line}:${position.character} in ${document.uri.fsPath}`);
        
        // Only provide hover for JSON files in dialogues folder
        if (!this.isRelevantDocument(document)) {
            this.debugHelper.log(`Not a dialogue file: ${document.uri.fsPath}`);
            return undefined;
        }
        
        // Get the current line text
        const lineText = document.lineAt(position.line).text;
        this.debugHelper.log(`Line text: ${lineText}`);
        
        // Check if the line contains a translation key
        const translateMatch = /"translate":\s*"([^"]+)"/g;
        
        let match;
        while ((match = translateMatch.exec(lineText)) !== null) {
            // Get the range of the translate key
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            // Check if the hover position is within the key
            if (position.character >= keyStart && position.character <= keyEnd) {
                const key = match[1];
                this.debugHelper.log(`Found translate key at cursor: ${key}`);
                
                // Only process dialogue keys
                if (!key.startsWith('dialogue.')) {
                    this.debugHelper.log(`Not a dialogue key: ${key}`);
                    return undefined;
                }
                
                const translation = this.getTranslation(key);
                if (translation) {
                    this.debugHelper.log(`Found translation for ${key}: ${translation}`);
                    const hoverRange = new vscode.Range(
                        position.line, keyStart,
                        position.line, keyEnd
                    );
                    
                    // Create markdown content for hover
                    const content = new vscode.MarkdownString();
                    
                    // Add translation text
                    content.appendCodeblock(translation, 'text');
                    
                    // Check if this is a dialogue key or a button key
                    if (key.startsWith('dialogue.button.')) {
                        // For buttons, see if we can find where this button points to
                        this.addButtonTargetInfo(document, key, content);
                    } else if (this.isDialogueKey(key)) {
                        // For dialogues, add NPC and index information
                        this.addDialogueInfo(key, content);
                    }
                    
                    this.debugHelper.log(`Returning hover content for ${key}`);
                    return new vscode.Hover(content, hoverRange);
                } else {
                    this.debugHelper.log(`No translation found for key: ${key}`);
                }
            }
        }
        
        // Check if we're hovering over a dialogue command
        const commandMatch = /\/dialogue\s+open\s+@e\[tag=([^\]]+)\][^.]+\.(\d+)/;
        const commandMatchResult = commandMatch.exec(lineText);
        
        if (commandMatchResult && this.isPositionWithinMatch(position, lineText, commandMatchResult)) {
            const targetNpcTag = commandMatchResult[1];
            const targetDialogueIndex = commandMatchResult[2];
            
            this.debugHelper.log(`Found dialogue command targeting: ${targetNpcTag}.${targetDialogueIndex}`);
            
            // Create the dialogue key from the command
            const dialogueKey = `dialogue.${targetNpcTag}.${targetDialogueIndex}`;
            const translation = this.getTranslation(dialogueKey);
            
            if (translation) {
                this.debugHelper.log(`Found translation for command target: ${translation}`);
                const content = new vscode.MarkdownString();
                content.appendCodeblock(translation, 'text');
                content.appendMarkdown(`\n> Points to: **${targetNpcTag}** dialogue index **${targetDialogueIndex}**`);
                
                return new vscode.Hover(content);
            } else {
                this.debugHelper.log(`No translation found for command target: ${dialogueKey}`);
            }
        }
        
        this.debugHelper.log(`No hover content provided for this position`);
        return undefined;
    }
    
    /**
     * Check if a position is within a regex match
     */
    private isPositionWithinMatch(position: vscode.Position, _lineText: string, match: RegExpExecArray): boolean {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        const isWithin = position.character >= startIndex && position.character <= endIndex;
        this.debugHelper.log(`Position ${position.character} within match ${startIndex}-${endIndex}: ${isWithin}`);
        return isWithin;
    }
    
    /**
     * Add information about dialogue key structure
     */
    private addDialogueInfo(key: string, content: vscode.MarkdownString): void {
        const parts = key.split('.');
        if (parts.length === 3) {
            const [, npcTag, index] = parts;
            content.appendMarkdown(`\n> NPC: **${npcTag}**, Index: **${index}**`);
            
            // Look for other dialogues from the same NPC
            const dialogueCount = this.countDialoguesForNpc(npcTag);
            if (dialogueCount > 1) {
                content.appendMarkdown(`\n> This NPC has **${dialogueCount}** dialogue entries.`);
            }
            
            this.debugHelper.log(`Added dialogue info for ${npcTag}.${index} (${dialogueCount} entries)`);
        }
    }
    
    /**
     * Add information about button targets
     */
    private addButtonTargetInfo(document: vscode.TextDocument, buttonKey: string, content: vscode.MarkdownString): void {
        this.debugHelper.log(`Adding button target info for ${buttonKey}`);
        
        // Try to find commands associated with this button
        const documentText = document.getText();
        const buttonKeyPattern = new RegExp(`"translate":\\s*"${buttonKey}"[\\s\\S]*?commands":\\s*\\[(.*?)\\]`, 's');
        const buttonMatch = buttonKeyPattern.exec(documentText);
        
        if (buttonMatch) {
            this.debugHelper.log(`Found commands for button: ${buttonMatch[1]}`);
            const commandsText = buttonMatch[1];
            const dialogueOpenPattern = /\/dialogue\s+open\s+@e\[tag=([^\]]+)\][^.]+\.(\d+)/g;
            let dialogueMatch;
            
            while ((dialogueMatch = dialogueOpenPattern.exec(commandsText)) !== null) {
                const targetNpcTag = dialogueMatch[1];
                const targetDialogueIndex = dialogueMatch[2];
                const targetKey = `dialogue.${targetNpcTag}.${targetDialogueIndex}`;
                const targetTranslation = this.getTranslation(targetKey);
                
                this.debugHelper.log(`Button points to dialogue: ${targetKey}`);
                content.appendMarkdown(`\n> Button points to: **${targetNpcTag}** dialogue **${targetDialogueIndex}**`);
                
                if (targetTranslation) {
                    this.debugHelper.log(`Target dialogue text: ${targetTranslation}`);
                    content.appendMarkdown(`\n> Target text: *"${this.truncateText(targetTranslation)}"*`);
                } else {
                    this.debugHelper.log(`No translation found for target dialogue: ${targetKey}`);
                }
                
                break; // Just show the first target for now
            }
        } else {
            this.debugHelper.log(`No commands found for button ${buttonKey}`);
        }
    }
    
    /**
     * Count dialogues for a specific NPC
     */
    private countDialoguesForNpc(npcTag: string): number {
        let count = 0;
        const prefix = `dialogue.${npcTag}.`;
        
        for (const key of this.translations.keys()) {
            if (key.startsWith(prefix) && this.isDialogueKey(key)) {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * Check if a key is a dialogue key (not a name or button)
     */
    private isDialogueKey(key: string): boolean {
        const parts = key.split('.');
        const isDialogue = parts.length === 3 && 
               parts[0] === 'dialogue' && 
               parts[1] !== 'button' && 
               !isNaN(Number(parts[2])) &&
               parts[2] !== 'name';
               
        this.debugHelper.log(`Checking if ${key} is a dialogue key: ${isDialogue}`);
        return isDialogue;
    }
    
    /**
     * Truncate text to a reasonable length
     */
    private truncateText(text: string, maxLength: number = 40): string {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    /**
     * Check if a document should be processed by this provider
     */
    public isRelevantDocument(document: vscode.TextDocument): boolean {
        const isRelevant = utils.isDialogueFile(document.uri.fsPath);
        this.debugHelper.log(`Checking if document is relevant: ${document.uri.fsPath} = ${isRelevant}`);
        return isRelevant;
    }
    
    /**
     * Provide completion items for dialogue keys
     */
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        this.debugHelper.log(`Providing completion items at ${position.line}:${position.character} in ${document.uri.fsPath}`);
        
        const items: vscode.CompletionItem[] = [];
        
        // Get all dialogue keys from the translations map
        for (const [key, value] of this.translations.entries()) {
            // Skip non-dialogue keys
            if (!key.startsWith('dialogue.')) {
                continue;
            }
            
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
            
            // Set the documentation to show the translated text
            item.documentation = new vscode.MarkdownString(value);
            
            // Categorize by type
            if (key.startsWith('dialogue.button.')) {
                item.kind = vscode.CompletionItemKind.Event;
                item.detail = 'Button Text';
            } else if (key.endsWith('.name')) {
                item.kind = vscode.CompletionItemKind.Class;
                item.detail = 'NPC Name';
            } else if (this.isDialogueKey(key)) {
                item.kind = vscode.CompletionItemKind.Text;
                item.detail = 'Dialogue Text';
            }
            
            items.push(item);
        }
        
        // Try to extract the NPC name from the file name to filter suggestions
        const fileName = path.basename(document.uri.fsPath, '.json');
        if (fileName) {
            this.debugHelper.log(`Prioritizing completions for NPC: ${fileName}`);
            
            // Prioritize dialogue keys for this NPC
            for (const item of items) {
                if (item.label.toString().includes(`.${fileName}.`)) {
                    item.sortText = '0' + item.label.toString(); // Sort at the top
                }
            }
        }
        
        this.debugHelper.log(`Returning ${items.length} completion items`);
        return items;
    }
}