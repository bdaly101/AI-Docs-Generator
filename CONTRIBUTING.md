# Contributing to AI-Docs-Generator

Thank you for your interest in contributing to AI-Docs-Generator! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/AI-Docs-Generator.git
cd AI-Docs-Generator
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up your environment**

```bash
export ANTHROPIC_API_KEY=your-api-key  # For integration tests
```

4. **Verify your setup**

```bash
npm run typecheck
npm run test:ci
npm run build
```

## Development Workflow

We follow a three-branch workflow:

- `main` - Production-ready code
- `staging` - Pre-production testing
- `dev` - Active development

### Creating a Feature

1. **Create a feature branch from `dev`**

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

2. **Make your changes**

3. **Run checks before committing**

```bash
npm run typecheck
npm run test:ci
npm run build
```

4. **Commit your changes**

```bash
git add -A
git commit -m "feat: description of your feature"
```

5. **Push and create a PR**

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request to the `dev` branch on GitHub.

## Commit Message Format

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

Examples:
```
feat: add support for custom templates
fix: resolve issue with JSDoc insertion
docs: update configuration reference
test: add integration tests for changelog
```

## Code Style

- **TypeScript** - All code must be TypeScript
- **Strict mode** - `tsc --noEmit` must pass
- **ESM** - Use ES modules (`import`/`export`)
- **Formatting** - Use consistent indentation (2 spaces)

## Testing

### Running Tests

```bash
npm test              # Watch mode
npm run test:ci       # CI mode (run once)
npm run test:ci -- --coverage  # With coverage
```

### Test Structure

```
tests/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests with mocked AI
└── e2e/            # End-to-end CLI tests
```

### Writing Tests

- Unit tests should not require external services
- Integration tests should mock the AI client
- E2E tests should use the built CLI

## Pull Request Guidelines

1. **Fill out the PR template** - Describe your changes
2. **Link issues** - Reference any related issues
3. **Pass CI** - All checks must pass
4. **Request review** - Tag maintainers for review

## Project Structure

```
AI-Docs-Generator/
├── src/
│   ├── cli/            # CLI commands
│   │   ├── commands/   # Individual commands
│   │   └── index.ts    # CLI entry point
│   ├── config/         # Configuration system
│   ├── core/           # Core functionality
│   │   ├── ai/         # AI client and prompts
│   │   ├── analyzer/   # Git and AST analysis
│   │   ├── generators/ # Documentation generators
│   │   └── updater/    # File writing utilities
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── tests/              # Test files
├── dist/               # Built output
└── docs/               # Documentation
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions

Thank you for contributing!

