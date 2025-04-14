import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if the workspace has the structure of a Minecraft Bedrock project
 */
export async function isMinecraftBedrockProject(workspaceRoot: string): Promise<boolean> {
    // Check for common Bedrock project indicators
    const possibleStructures = [
        // Check if we have behavior packs and resource packs folders
        { bp: path.join(workspaceRoot, 'BP'), rp: path.join(workspaceRoot, 'RP') },
        // Alternative structure
        { 
            bp: path.join(workspaceRoot, 'behavior_packs'), 
            rp: path.join(workspaceRoot, 'resource_packs')
        }
    ];

    for (const structure of possibleStructures) {
        const bpExists = await fileExists(structure.bp);
        const rpExists = await fileExists(structure.rp);
        
        if (bpExists && rpExists) {
            return true;
        }
    }

    return false;
}

/**
 * Get the possible paths for the language file
 */
export async function getLangFilePath(workspaceRoot: string): Promise<string | null> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('minecraftDialogueTranslator');
    const configuredPath = config.get<string>('languageFile');
    
    // Check if the configured path exists
    if (configuredPath) {
        const fullPath = path.join(workspaceRoot, configuredPath);
        if (await fileExists(fullPath)) {
            return fullPath;
        }
    }
    
    // Check for common language file locations
    const possibleLangPaths = [
        path.join(workspaceRoot, 'RP', 'texts', 'en_US.lang'),
        path.join(workspaceRoot, 'resource_packs', 'RP', 'texts', 'en_US.lang'),
        // Try to find the file in any resource pack
        ...(await findAllLangFiles(workspaceRoot))
    ];
    
    for (const langPath of possibleLangPaths) {
        if (await fileExists(langPath)) {
            return langPath;
        }
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
    const translations = new Map<string, string>();
    
    try {
        const content = await readFile(langFilePath);
        const lines = content.split('\n');
        
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
            }
        }
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
    return filePath.includes('/dialogue/') && filePath.endsWith('.json');
}

/**
 * Extract dialogue keys from document text
 */
export function findDialogueKeys(text: string): RegExpMatchArray[] {
    // Match patterns like "dialogue.npc_name.index" in the document
    const keyRegex = /"translate":\s*"(dialogue\.[^"]+\.\d+)"/g;
    const results: RegExpMatchArray[] = [];
    
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
        results.push(match);
    }
    
    return results;
}
