import * as vscode from 'vscode';
import * as path from 'path';
import { DialogueProvider } from './dialogueProvider';
import { DebugHelper } from './debug';

// Create a debug helper instance
const debugHelper = new DebugHelper();

export async function activate(context: vscode.ExtensionContext) {
    debugHelper.log('Activating Minecraft Dialogue Translator extension');

    // Get workspace root
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        debugHelper.log('No workspace folders found');
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    debugHelper.log(`Workspace root: ${workspaceRoot}`);
    
    const dialogueProvider = new DialogueProvider(workspaceRoot, debugHelper);
    
    // Initialize the dialogue provider
    const initialized = await dialogueProvider.initialize();
    if (!initialized) {
        debugHelper.log('Failed to initialize dialogue provider');
        return;
    }
    
    // Register hover provider for JSON files
    const hoverProvider = vscode.languages.registerHoverProvider(
        { language: 'json', scheme: 'file' },
        {
            provideHover(document, position, _token) {
                debugHelper.log(`Hover triggered at ${position.line}:${position.character} in ${document.uri.fsPath}`);
                
                // Only process relevant files
                if (!dialogueProvider.isRelevantDocument(document)) {
                    debugHelper.log(`Not a relevant document: ${document.uri.fsPath}`);
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
    
    // Register debugging command
    context.subscriptions.push(
        vscode.commands.registerCommand('minecraftDialogueTranslator.debugExtension', () => {
            debugHelper.diagnoseExtension(workspaceRoot);
        })
    );
    
    debugHelper.log('Minecraft Dialogue Translator activated');
}

export function deactivate() {
    debugHelper.log('Deactivating Minecraft Dialogue Translator extension');
}