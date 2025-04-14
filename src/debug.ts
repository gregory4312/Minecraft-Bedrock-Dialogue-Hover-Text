// src/debug.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as utils from './utils';

export class DebugHelper {
    private outputChannel: vscode.OutputChannel;
    
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Minecraft Dialogue Translator');
    }
    
    public log(message: string): void {
        const config = vscode.workspace.getConfiguration('minecraftDialogueTranslator');
        const debugEnabled = config.get<boolean>('debug', false);
        
        console.log(message);
        
        if (debugEnabled) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
        }
    }
    
    public showOutputChannel(): void {
        this.outputChannel.show();
    }
    
    public async diagnoseExtension(workspaceRoot: string): Promise<void> {
        this.outputChannel.clear();
        this.outputChannel.show();
        
        this.log('===== MINECRAFT DIALOGUE TRANSLATOR DIAGNOSTICS =====');
        this.log(`Workspace root: ${workspaceRoot}`);
        
        // Check extension activation
        this.log('\n=== CHECKING EXTENSION ACTIVATION ===');
        this.log(`Extension is now active`);
        
        // Check project structure
        this.log('\n=== CHECKING PROJECT STRUCTURE ===');
        await this.checkProjectStructure(workspaceRoot);
        
        // Check language file
        this.log('\n=== CHECKING LANGUAGE FILE ===');
        await this.checkLanguageFile(workspaceRoot);
        
        // Check dialogue files
        this.log('\n=== CHECKING DIALOGUE FILES ===');
        await this.checkDialogueFiles(workspaceRoot);
        
        this.log('\n===== DIAGNOSTICS COMPLETE =====');
        this.log('Please check the above output for any issues.');
        
        vscode.window.showInformationMessage('Diagnostic information has been collected. Check the output panel for details.');
    }
    
    private async checkProjectStructure(workspaceRoot: string): Promise<void> {
        // Check BP and RP folders
        const bpPath = path.join(workspaceRoot, 'BP');
        const rpPath = path.join(workspaceRoot, 'RP');
        
        const bpExists = await utils.fileExists(bpPath);
        const rpExists = await utils.fileExists(rpPath);
        
        this.log(`BP folder exists: ${bpExists ? 'YES' : 'NO'} (${bpPath})`);
        this.log(`RP folder exists: ${rpExists ? 'YES' : 'NO'} (${rpPath})`);
        
        // Check alternative structure
        const behaviorPacksPath = path.join(workspaceRoot, 'behavior_packs');
        const resourcePacksPath = path.join(workspaceRoot, 'resource_packs');
        
        const behaviorPacksExists = await utils.fileExists(behaviorPacksPath);
        const resourcePacksExists = await utils.fileExists(resourcePacksPath);
        
        this.log(`behavior_packs folder exists: ${behaviorPacksExists ? 'YES' : 'NO'} (${behaviorPacksPath})`);
        this.log(`resource_packs folder exists: ${resourcePacksExists ? 'YES' : 'NO'} (${resourcePacksPath})`);
        
        // Determine the project structure
        if (bpExists && rpExists) {
            this.log('✅ Standard project structure detected (BP/RP)');
        } else if (behaviorPacksExists && resourcePacksExists) {
            this.log('✅ Alternative project structure detected (behavior_packs/resource_packs)');
        } else {
            this.log('❌ Could not detect a valid Minecraft Bedrock project structure');
        }
    }
    
    private async checkLanguageFile(workspaceRoot: string): Promise<void> {
        // Get configuration
        const config = vscode.workspace.getConfiguration('minecraftDialogueTranslator');
        const configuredPath = config.get<string>('languageFile');
        
        this.log(`Configured language file path: ${configuredPath}`);
        
        // Check if the configured path exists
        if (configuredPath) {
            const fullPath = path.join(workspaceRoot, configuredPath);
            const exists = await utils.fileExists(fullPath);
            this.log(`Configured language file exists: ${exists ? 'YES' : 'NO'} (${fullPath})`);
            
            if (exists) {
                await this.analyzeLanguageFile(fullPath);
            }
        }
        
        // Check common paths
        const commonPaths = [
            path.join(workspaceRoot, 'RP', 'texts', 'en_US.lang'),
            path.join(workspaceRoot, 'resource_packs', 'RP', 'texts', 'en_US.lang')
        ];
        
        for (const langPath of commonPaths) {
            const exists = await utils.fileExists(langPath);
            this.log(`Common language file exists: ${exists ? 'YES' : 'NO'} (${langPath})`);
            
            if (exists) {
                await this.analyzeLanguageFile(langPath);
            }
        }
        
        // Find all language files
        this.log('\nSearching for all .lang files:');
        const langFiles = await this.findAllLangFiles(workspaceRoot);
        
        if (langFiles.length === 0) {
            this.log('❌ No language files found in the project');
        }
    }
    
    private async findAllLangFiles(workspaceRoot: string): Promise<string[]> {
        const results: string[] = [];
        
        // Check RP/texts
        const rpTextsPath = path.join(workspaceRoot, 'RP', 'texts');
        if (await utils.fileExists(rpTextsPath)) {
            const files = await utils.readDirectory(rpTextsPath);
            for (const file of files) {
                if (file.endsWith('.lang')) {
                    const langPath = path.join(rpTextsPath, file);
                    results.push(langPath);
                    this.log(`Found language file: ${langPath}`);
                }
            }
        }
        
        // Check resource_packs folder
        const resourcePacksPath = path.join(workspaceRoot, 'resource_packs');
        if (await utils.fileExists(resourcePacksPath)) {
            const packs = await utils.readDirectory(resourcePacksPath);
            
            for (const pack of packs) {
                const textsPath = path.join(resourcePacksPath, pack, 'texts');
                if (await utils.fileExists(textsPath)) {
                    const files = await utils.readDirectory(textsPath);
                    for (const file of files) {
                        if (file.endsWith('.lang')) {
                            const langPath = path.join(textsPath, file);
                            results.push(langPath);
                            this.log(`Found language file: ${langPath}`);
                        }
                    }
                }
            }
        }
        
        return results;
    }
    
    private async analyzeLanguageFile(langFilePath: string): Promise<void> {
        try {
            const content = await utils.readFile(langFilePath);
            const lines = content.split('\n');
            
            let dialogueCount = 0;
            
            for (const line of lines) {
                if (line.trim().startsWith('dialogue.')) {
                    dialogueCount++;
                }
            }
            
            this.log(`Language file contains ${dialogueCount} dialogue entries`);
            
            if (dialogueCount === 0) {
                this.log('❌ No dialogue entries found in this language file');
            } else {
                this.log('✅ Dialogue entries found in language file');
                
                // Show some sample entries
                this.log('\nSample dialogue entries:');
                let sampleCount = 0;
                
                for (const line of lines) {
                    if (line.trim().startsWith('dialogue.') && sampleCount < 5) {
                        this.log(`  ${line.trim()}`);
                        sampleCount++;
                    }
                }
            }
        } catch (error) {
            this.log(`❌ Error analyzing language file: ${error}`);
        }
    }
    
    private async checkDialogueFiles(workspaceRoot: string): Promise<void> {
        // Check BP/dialogue
        const dialoguePath = path.join(workspaceRoot, 'BP', 'dialogue');
        const alternateDialoguePath = path.join(workspaceRoot, 'BP', 'dialogues');
        
        const dialogueExists = await utils.fileExists(dialoguePath);
        const alternateDialogueExists = await utils.fileExists(alternateDialoguePath);
        
        this.log(`BP/dialogue folder exists: ${dialogueExists ? 'YES' : 'NO'} (${dialoguePath})`);
        this.log(`BP/dialogues folder exists: ${alternateDialogueExists ? 'YES' : 'NO'} (${alternateDialoguePath})`);
        
        // Check if any JSON files in dialogue folders
        if (dialogueExists) {
            await this.checkDialogueFolder(dialoguePath);
        }
        
        if (alternateDialogueExists) {
            await this.checkDialogueFolder(alternateDialoguePath);
        }
        
        // Check behavior_packs
        const behaviorPacksPath = path.join(workspaceRoot, 'behavior_packs');
        if (await utils.fileExists(behaviorPacksPath)) {
            const packs = await utils.readDirectory(behaviorPacksPath);
            
            for (const pack of packs) {
                const packDialoguePath = path.join(behaviorPacksPath, pack, 'dialogue');
                const packDialoguesPath = path.join(behaviorPacksPath, pack, 'dialogues');
                
                if (await utils.fileExists(packDialoguePath)) {
                    await this.checkDialogueFolder(packDialoguePath);
                }
                
                if (await utils.fileExists(packDialoguesPath)) {
                    await this.checkDialogueFolder(packDialoguesPath);
                }
            }
        }
    }
    
    private async checkDialogueFolder(folderPath: string): Promise<void> {
        const files = await utils.readDirectory(folderPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        this.log(`Found ${jsonFiles.length} JSON files in ${folderPath}`);
        
        if (jsonFiles.length === 0) {
            this.log('❌ No JSON files found in this dialogue folder');
            return;
        }
        
        this.log('✅ JSON files found in dialogue folder');
        
        // Check contents of a sample file
        if (jsonFiles.length > 0) {
            const sampleFile = jsonFiles[0];
            const filePath = path.join(folderPath, sampleFile);
            
            this.log(`\nAnalyzing sample dialogue file: ${filePath}`);
            
            try {
                const content = await utils.readFile(filePath);
                const translateKeys = utils.findDialogueKeys(content);
                
                this.log(`Found ${translateKeys.length} translate keys in sample file`);
                
                if (translateKeys.length === 0) {
                    this.log('❌ No translate keys found in sample file');
                    this.log('Sample content:');
                    this.log(content.substring(0, 500) + '...');
                } else {
                    this.log('✅ Translate keys found in sample file');
                    this.log('Sample translate keys:');
                    
                    for (let i = 0; i < Math.min(5, translateKeys.length); i++) {
                        this.log(`  ${translateKeys[i][1]}`);
                    }
                }
            } catch (error) {
                this.log(`❌ Error analyzing dialogue file: ${error}`);
            }
        }
    }
}