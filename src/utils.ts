import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if the workspace has the structure of a Minecraft Bedrock project
 */
export async function isMinecraftBedrockProject(workspaceRoot: string): Promise<boolean> {
    console.log(`Checking if ${workspaceRoot} is a Minecraft Bedrock project`);
    
    // Check for common Bedrock project indicators
    const possibleStructures = [
        // Check if we have behavior packs and resource packs folders
        { bp: path.join(workspaceRoot, 'BP'), rp: path.join(workspaceRoot, 'RP') },
        // Alternative structure
        { 
            bp: path.join(workspaceRoot, 'behavior_packs'), 
            rp: path.join(workspaceRoot, 'resource_packs')
        },
        // Some projects may have the BP and RP folders at the root
        { bp: path.join(workspaceRoot), rp: path.join(workspaceRoot) }
    ];

    for (const structure of possibleStructures) {
        const bpExists = await fileExists(structure.bp);
        const rpExists = await fileExists(structure.rp);
        
        // For root-level check, make sure there are dialogue and texts folders
        if (structure.bp === workspaceRoot) {
            const dialogueExists = await fileExists(path.join(workspaceRoot, 'dialogue')) || 
                                 await fileExists(path.join(workspaceRoot, 'dialogues'));
            const textsExists = await fileExists(path.join(workspaceRoot, 'texts'));
            
            if (dialogueExists && textsExists) {
                console.log('Detected Minecraft Bedrock project with root-level dialogue and texts folders');
                return true;
            }
        } else if (bpExists && rpExists) {
            console.log(`Detected Minecraft Bedrock project with BP: ${structure.bp} and RP: ${structure.rp}`);
            return true;
        }
    }

    // As a fallback, check for individual dialogue and texts folders
    const dialogueFolders = [
        path.join(workspaceRoot, 'dialogue'),
        path.join(workspaceRoot, 'dialogues'),
        path.join(workspaceRoot, 'BP', 'dialogue'),
        path.join(workspaceRoot, 'BP', 'dialogues')
    ];
    
    const textsFolders = [
        path.join(workspaceRoot, 'texts'),
        path.join(workspaceRoot, 'RP', 'texts')
    ];
    
    // Check if at least one dialogue folder and one texts folder exists
    for (const dialogueFolder of dialogueFolders) {
        if (await fileExists(dialogueFolder)) {
            for (const textsFolder of textsFolders) {
                if (await fileExists(textsFolder)) {
                    console.log(`Detected Minecraft Bedrock project with dialogue: ${dialogueFolder} and texts: ${textsFolder}`);
                    return true;
                }
            }
        }
    }

    console.log('Not a Minecraft Bedrock project');
    return false;
}

/**
 * Get the possible paths for the language file
 */
export async function getLangFilePath(workspaceRoot: string): Promise<string | null> {
    console.log(`Looking for language file in ${workspaceRoot}`);
    
    // Get configuration
    const config = vscode.workspace.getConfiguration('minecraftDialogueTranslator');
    const configuredPath = config.get<string>('languageFile');
    
    // Check if the configured path exists
    if (configuredPath) {
        const fullPath = path.join(workspaceRoot, configuredPath);
        if (await fileExists(fullPath)) {
            console.log(`Found language file from configuration: ${fullPath}`);
            return fullPath;
        }
    }
    
    // Check for common language file locations
    const possibleLangPaths = [
        path.join(workspaceRoot, 'RP', 'texts', 'en_US.lang'),
        path.join(workspaceRoot, 'texts', 'en_US.lang'),
        path.join(workspaceRoot, 'resource_packs', 'RP', 'texts', 'en_US.lang'),
        // Try to find the file in any resource pack
        ...(await findAllLangFiles(workspaceRoot))
    ];
    
    for (const langPath of possibleLangPaths) {
        if (await fileExists(langPath)) {
            console.log(`Found language file: ${langPath}`);
            return langPath;
        }
    }
    
    // Try to find any .lang file as a fallback
    console.log('No standard language file found, searching for any .lang file...');
    const anyLangFile = await findAnyLangFile(workspaceRoot);
    if (anyLangFile) {
        console.log(`Found fallback language file: ${anyLangFile}`);
        return anyLangFile;
    }
    
    console.log('No language file found');
    return null;
}

/**
 * Find any .lang file in the workspace
 */
async function findAnyLangFile(_workspaceRoot: string): Promise<string | null> {
    try {
        // Use VS Code file search API to find any .lang file in the workspace
        const langFiles = await vscode.workspace.findFiles('**/*.lang', null, 10);
        
        if (langFiles.length > 0) {
            return langFiles[0].fsPath;
        }
    } catch (error) {
        console.error('Error searching for .lang files:', error);
    }
    
    return null;
}

/**
 * Find all .lang files in any resource pack
 */
async function findAllLangFiles(workspaceRoot: string): Promise<string[]> {
    const results: string[] = [];
    
    // Check for resource packs folder
    const resourcePacksPath = path.join(workspaceRoot, 'resource_packs');
    if (await fileExists(resourcePacksPath)) {
        const resourcePacks = await readDirectory(resourcePacksPath);
        
        for (const pack of resourcePacks) {
            const textsPath = path.join(resourcePacksPath, pack, 'texts');
            if (await fileExists(textsPath)) {
                const textFiles = await readDirectory(textsPath);
                for (const file of textFiles) {
                    if (file.endsWith('.lang')) {
                        results.push(path.join(textsPath, file));
                    }
                }
            }
        }
    }
    
    return results;
}

/**
 * Parse a .lang file and return a map of keys to values
 */
export async function parseLangFile(langFilePath: string): Promise<Map<string, string>> {
    console.log(`Parsing language file: ${langFilePath}`);
    const translations = new Map<string, string>();
    
    try {
        const content = await readFile(langFilePath);
        const lines = content.split('\n');
        
        let dialogueCount = 0;
        
        for (const line of lines) {
            // Skip comments and empty lines
            if (line.trim() === '' || line.startsWith('#')) {
                continue;
            }
            
            // Parse key=value format
            const equalsIndex = line.indexOf('=');
            if (equalsIndex > 0) {
                const key = line.substring(0, equalsIndex).trim();
                const value = line.substring(equalsIndex + 1).trim();
                translations.set(key, value);
                
                if (key.startsWith('dialogue.')) {
                    dialogueCount++;
                }
            }
        }
        
        console.log(`Parsed ${translations.size} translations, including ${dialogueCount} dialogue entries`);
    } catch (error) {
        console.error(`Error parsing lang file: ${error}`);
    }
    
    return translations;
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            resolve(!err);
        });
    });
}

/**
 * Read a file as text
 */
export function readFile(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Read a directory
 */
export function readDirectory(dirPath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

/**
 * Check if a file is a dialogue JSON file
 */
export function isDialogueFile(filePath: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // First check if this is a JSON file
    if (!normalizedPath.endsWith('.json')) {
        return false;
    }
    
    // Match any of these path patterns (case insensitive)
    const dialoguePatterns = [
        '/dialogue/',
        '/dialogues/',
        '/bp/dialogue/',
        '/bp/dialogues/',
        '/behavior_pack/dialogue/',
        '/behavior_pack/dialogues/',
        '/behavior_packs/dialogue/',
        '/behavior_packs/dialogues/'
    ];
    
    const lowerPath = normalizedPath.toLowerCase();
    const isDialogue = dialoguePatterns.some(pattern => lowerPath.includes(pattern));
    
    if (isDialogue) {
        console.log(`Detected dialogue file: ${filePath}`);
    }
    
    return isDialogue;
}

/**
 * Extract dialogue keys from document text
 */
export function findDialogueKeys(text: string): RegExpMatchArray[] {
    // Match patterns like "dialogue.npc_name.index" in the document
    const keyRegex = /"translate":\s*"(dialogue\.[^"]+)"/g;
    const results: RegExpMatchArray[] = [];
    
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
        results.push(match);
    }
    
    return results;
}