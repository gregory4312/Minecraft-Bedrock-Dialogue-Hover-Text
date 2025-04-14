# Minecraft Dialogue Translator

A Visual Studio Code extension that makes working with Minecraft Bedrock dialogue files easier by showing the translated text when hovering over dialogue keys.

## Features

- Automatically detects Minecraft Bedrock project structure
- Shows translated text when hovering over dialogue keys in JSON files
- Works with dialogue files in `/BP/dialogues/` or `/behavior_packs/*/dialogues/`
- Supports translation files in `/RP/texts/en_US.lang` or `/resource_packs/*/texts/en_US.lang`
- Updates translations in real-time when language files are modified

## How It Works

This extension checks for the structure of a Minecraft Bedrock project with:
- Behavior Pack (BP) folder containing dialogue JSON files
- Resource Pack (RP) folder containing language files

When you hover over a dialogue key like `dialogue.npc_name.0` in a JSON file, the extension finds the corresponding translation from the language file and displays it as a tooltip.

## Requirements

- Visual Studio Code 1.60.0 or newer
- A Minecraft Bedrock project with dialogue files and language files

## Extension Settings

This extension contributes the following settings:

* `minecraftDialogueTranslator.enableHover`: Enable/disable hover tooltips for dialogue keys
* `minecraftDialogueTranslator.languageFile`: Path to the language file relative to workspace root (default: "RP/texts/en_US.lang")

## Usage

1. Open a Minecraft Bedrock project folder in VS Code
2. Open a dialogue JSON file from the BP/dialogues folder
3. Hover over any `"translate": "dialogue.npc_name.0"` key
4. See the actual dialogue text from the language file

## Known Issues

- Only supports English language files (en_US.lang) by default
- Currently only detects translate keys in the format `"translate": "dialogue.*.#"`

## Release Notes

### 0.1.0

- Initial release
- Basic hover functionality for dialogue keys
- Support for common Bedrock project structures

## Development

### Building the Extension

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`

### Testing the Extension

1. Press F5 to start debugging
2. Open a Minecraft Bedrock project
3. Test the hover functionality on dialogue files

## License

MIT
