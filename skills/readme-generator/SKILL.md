---
name: readme-generator
description: |
  WHEN: README generation/update, project documentation, installation/usage/contribution guides
  WHAT: Project analysis + sectioned README templates + badges + environment variable docs
  WHEN NOT: API docs → api-documenter, Code comments → api-documenter
---

# README Generator Skill

## Purpose
Analyzes project structure to generate or update README.md with installation, usage, API docs, and more.

## When to Use
- README generation requests
- New project needs README
- Existing README update needed
- Installation, usage documentation requests

## Workflow

### Step 1: Analyze Project
```
**Project**: my-awesome-app
**Type**: Next.js Web Application
**Language**: TypeScript
**Package Manager**: npm
**Dependencies**: React, Next.js, Tailwind CSS
**Scripts**: dev, build, start, test, lint
```

### Step 2: Check Existing README
```
README Status:
- Exists: [Yes/No]
- Current sections: [list]
- Last modified: [date]
```

### Step 3: Select Sections
**AskUserQuestion:**
```
"Select README sections"
Options:
- Project intro/overview
- Installation
- Usage/Getting started
- Environment variables
- API documentation
- Contributing guide
- License
multiSelect: true
```

### Step 4: Select Style
**AskUserQuestion:**
```
"Select README style"
Options:
- Concise (essentials only)
- Detailed (screenshots/GIFs)
- Technical (API-focused)
- Open source (badges, contributing)
```

## README Templates

### Basic Structure
```markdown
# Project Name

![License](https://img.shields.io/badge/license-MIT-blue.svg)

Brief description (1-2 sentences)

## Features
- Feature 1
- Feature 2

## Installation
\`\`\`bash
git clone https://github.com/username/project.git
cd project
npm install
\`\`\`

## Usage
\`\`\`bash
npm run dev      # Development
npm run build    # Production build
\`\`\`

## Environment Variables
Create `.env.local`:
\`\`\`env
DATABASE_URL=your_database_url
NEXT_PUBLIC_API_URL=your_api_url
\`\`\`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |

## Tech Stack
- **Framework**: Next.js 14
- **Language**: TypeScript

## Project Structure
\`\`\`
├── app/              # Next.js App Router
├── components/       # React components
├── lib/             # Utilities
└── public/          # Static assets
\`\`\`

## Contributing
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## License
MIT License
```

### Open Source Template
```markdown
# Project Name

[![npm](https://badge.fury.io/js/package.svg)](https://www.npmjs.com/package/package)
[![CI](https://github.com/user/repo/workflows/CI/badge.svg)](https://github.com/user/repo/actions)
[![Coverage](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/user/repo)

> Compelling project description

## Installation
\`\`\`bash
npm install package-name
\`\`\`

## Usage
\`\`\`typescript
import { feature } from 'package-name'
const result = feature({ option: 'value' })
\`\`\`

## API Reference
### `feature(options)`
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `option` | `string` | `'default'` | Description |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md)

## License
MIT - see [LICENSE](LICENSE)
```

## Response Template
```
## README Generated

**File**: README.md
**Style**: Detailed

### Included Sections
- [x] Project intro
- [x] Installation
- [x] Usage
- [x] Environment variables
- [x] Tech stack
- [x] Contributing
- [x] License

### Recommendations
- [ ] Add screenshots/demo GIF
- [ ] Detail API documentation
- [ ] Create CONTRIBUTING.md
```

## Best Practices
1. **Concise**: Quick access to key info
2. **Structured**: Clear section separation
3. **Examples**: Copy-paste ready code
4. **Current**: Keep versions updated
5. **Visual**: Badges, screenshots for readability

## Integration
- `api-documenter` skill: API section details
- `/explain-code` command: Project structure understanding

## Notes
- Preserves existing README style when updating
- Excludes sensitive info (.env values)
- Project structure based on actual analysis
