# AI-Docs-Generator

[![CI](https://github.com/bdaly101/AI-Docs-Generator/actions/workflows/ci.yml/badge.svg)](https://github.com/bdaly101/AI-Docs-Generator/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/ai-docs-generator.svg)](https://www.npmjs.com/package/ai-docs-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Auto-generate and update documentation from code changes using AI. Powered by Claude.

## Features

- **README Generation** - Automatically update README sections when you add new features
- **API Documentation** - Generate endpoint documentation from code changes
- **JSDoc/TSDoc Comments** - Add missing documentation comments to exported functions and classes
- **Changelog Sync** - Generate CHANGELOG.md entries from git commits
- **Watch Mode** - Automatically regenerate docs when files change
- **Dry Run** - Preview changes before writing to files

## Installation

```bash
npm install -g ai-docs-generator
```

Or as a dev dependency:

```bash
npm install -D ai-docs-generator
```

## Quick Start

1. **Initialize configuration**

```bash
aidocs init
```

2. **Set your API key**

```bash
export ANTHROPIC_API_KEY=your-api-key
```

3. **Generate documentation**

```bash
aidocs generate --since HEAD~5
```

## CLI Usage

### Initialize Configuration

```bash
aidocs init                # Create .aidocsrc.json
aidocs init --force        # Overwrite existing config
```

### Generate Documentation

```bash
aidocs generate                    # Generate from HEAD~1
aidocs generate --since HEAD~5     # Generate from last 5 commits
aidocs generate --since v1.0.0     # Generate since tag
aidocs generate --readme           # Only update README
aidocs generate --api              # Only update API docs
aidocs generate --jsdoc            # Only add JSDoc comments
aidocs generate --dry-run          # Preview without writing
```

### Watch Mode

```bash
aidocs watch                       # Watch with 2s debounce
aidocs watch --debounce 5000       # Custom debounce (ms)
```

### Sync Changelog

```bash
aidocs sync                        # From latest tag
aidocs sync v1.0.0                 # From specific tag
aidocs sync --version 1.1.0        # Specify new version
aidocs sync --dry-run              # Preview output
```

## Configuration

Create `.aidocsrc.json` in your project root:

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  },
  "readme": {
    "enabled": true,
    "path": "README.md",
    "sections": ["features", "installation", "usage", "api"],
    "updateOnNewFeature": true
  },
  "apiDocs": {
    "enabled": true,
    "outputPath": "docs/api",
    "format": "markdown",
    "includeExamples": true
  },
  "jsdoc": {
    "enabled": true,
    "style": "tsdoc",
    "includeTypes": true,
    "includeExamples": false
  },
  "changelog": {
    "enabled": true,
    "path": "CHANGELOG.md",
    "format": "keepachangelog",
    "groupBy": "type"
  },
  "ignore": [
    "node_modules/**",
    "dist/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### Configuration Options

#### AI Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `"anthropic"` | `"anthropic"` | AI provider (currently only Anthropic) |
| `model` | `string` | `"claude-sonnet-4-5-20250929"` | Model to use |
| `apiKey` | `string` | env var | API key (falls back to `ANTHROPIC_API_KEY`) |

#### README Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable README generation |
| `path` | `string` | `"README.md"` | Path to README file |
| `sections` | `string[]` | `["features", ...]` | Sections to manage |
| `updateOnNewFeature` | `boolean` | `true` | Auto-update on new exports |

#### API Docs Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable API doc generation |
| `outputPath` | `string` | `"docs/api"` | Output directory |
| `format` | `"markdown" \| "html"` | `"markdown"` | Output format |
| `includeExamples` | `boolean` | `true` | Include code examples |

#### JSDoc Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable JSDoc generation |
| `style` | `"jsdoc" \| "tsdoc"` | `"tsdoc"` | Comment style |
| `includeTypes` | `boolean` | `true` | Include type annotations |
| `includeExamples` | `boolean` | `false` | Include examples |

#### Changelog Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable changelog generation |
| `path` | `string` | `"CHANGELOG.md"` | Path to changelog |
| `format` | `"keepachangelog" \| "conventional"` | `"keepachangelog"` | Format style |
| `groupBy` | `"type" \| "scope" \| "date"` | `"type"` | Grouping method |

## How It Works

1. **Git Analysis** - Parses git diffs to identify changed files and code
2. **AST Parsing** - Extracts functions, classes, interfaces from TypeScript/JavaScript
3. **Change Detection** - Identifies what type of documentation is needed
4. **AI Generation** - Uses Claude to generate contextual documentation
5. **Smart Merging** - Updates files while preserving existing content

## Requirements

- Node.js >= 18.0.0
- Git repository
- Anthropic API key

## Development

```bash
# Clone the repository
git clone https://github.com/bdaly101/AI-Docs-Generator.git
cd AI-Docs-Generator

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © 2024

