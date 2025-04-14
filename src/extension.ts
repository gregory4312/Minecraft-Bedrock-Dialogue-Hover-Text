import * as vscode from 'vscode';
import * as path from 'path';
import { DialogueProvider } from './dialogueProvider';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Minecraft Dialogue Translator extension');

    // Get workspace root
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        console.log('No workspace folders found');
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const dialogueProvider = new DialogueProvider(workspaceRoot);
    
    // Initialize the dialogue provider
    const initialized = await dialogueProvider.initialize();
    if (!initialized) {
        return;
    }
    
    // Register hover provider for JSON files
    const hoverProvider = vscode.languages.registerHoverProvider(
        { language: 'json', scheme: 'file' },
        {
            provideHover(document, position, _token) {
                // Only process relevant files
                if (!dialogueProvider.isRelevantDocument(document)) {
                    return undefined;
                }
                
                return dialogueProvider.provideHover(document, position);
            }
        }
    );
    
    // Register completion provider for JSON files
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'json', scheme: 'file' },
        {
            provideCompletionItems(document, position, _token, _context) {
                // Only process relevant files
                if (!dialogueProvider.isRelevantDocument(document)) {
                    return undefined;
                }
                
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                // Check if we're typing in a translate key context
                if (linePrefix.match(/"translate"\s*:\s*"(?:[^"]*)?$/)) {
                    return dialogueProvider.provideCompletionItems(document, position);
                }
                
                return undefined;
            }
        },
        '"' // Trigger completion when typing a quote
    );
    
    context.subscriptions.push(hoverProvider, completionProvider);
    
    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('minecraftDialogueTranslator')) {
                dialogueProvider.initialize();
            }
        })
    );
    
    // Status bar for extension status
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(comment) Dialogue Translator";
    statusBarItem.tooltip = "Minecraft Dialogue Translator is active";
    statusBarItem.command = 'minecraftDialogueTranslator.showInfo';
    statusBarItem.show();
    
    context.subscriptions.push(statusBarItem);
    
    // Register command for status bar item
    context.subscriptions.push(
        vscode.commands.registerCommand('minecraftDialogueTranslator.showInfo', () => {
            vscode.window.showInformationMessage('Minecraft Dialogue Translator is active.');
        })
    );
    
    console.log('Minecraft Dialogue Translator activated');
}

export function deactivate() {
    console.log('Deactivating Minecraft Dialogue Translator extension');
}
