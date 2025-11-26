/**
 * Built-in Collaborate Templates
 * 
 * Pre-defined templates for common document types.
 * Templates support {{placeholder}} syntax for dynamic content.
 */

export interface TemplatePlaceholder {
  key: string;
  description: string;
  default?: string;
}

export interface BuiltInTemplate {
  name: string;
  description: string;
  category: 'code' | 'writing' | 'business' | 'custom';
  contentType: 'text' | 'code' | 'mixed';
  language?: string;
  icon?: string;
  content: string;
  placeholders: TemplatePlaceholder[];
}

// ========================================
// Code Templates
// ========================================

const codeTemplates: BuiltInTemplate[] = [
  {
    name: 'React Component',
    description: 'Functional React component with TypeScript and hooks',
    category: 'code',
    contentType: 'code',
    language: 'typescript',
    icon: 'Component',
    content: `import { useState, useEffect } from 'react';

interface {{ComponentName}}Props {
  {{propName}}?: {{propType}};
}

export default function {{ComponentName}}({ {{propName}} }: {{ComponentName}}Props) {
  const [state, setState] = useState<{{stateType}}>({{initialState}});

  useEffect(() => {
    // {{effectDescription}}
  }, []);

  return (
    <div className="{{className}}">
      <h1>{{ComponentName}}</h1>
      {/* Component content */}
    </div>
  );
}
`,
    placeholders: [
      { key: 'ComponentName', description: 'Name of the component', default: 'MyComponent' },
      { key: 'propName', description: 'Name of the main prop', default: 'title' },
      { key: 'propType', description: 'Type of the main prop', default: 'string' },
      { key: 'stateType', description: 'Type for the state', default: 'string' },
      { key: 'initialState', description: 'Initial state value', default: '""' },
      { key: 'effectDescription', description: 'What the effect does', default: 'Initialize component' },
      { key: 'className', description: 'CSS class name', default: 'container' },
    ]
  },
  {
    name: 'Express API Route',
    description: 'Express.js REST API route handler with TypeScript',
    category: 'code',
    contentType: 'code',
    language: 'typescript',
    icon: 'Server',
    content: `import { Router, Request, Response } from 'express';
import { db } from '../db/client.js';

const router = Router();

/**
 * {{routeDescription}}
 * {{method}} /api/{{resourceName}}
 */
router.{{methodLower}}('/api/{{resourceName}}', async (req: Request, res: Response) => {
  try {
    // {{implementationNote}}
    const result = await db.{{modelName}}.findMany();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[{{ResourceName}}] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
`,
    placeholders: [
      { key: 'routeDescription', description: 'Description of the route', default: 'Get all resources' },
      { key: 'method', description: 'HTTP method (GET, POST, etc.)', default: 'GET' },
      { key: 'methodLower', description: 'HTTP method lowercase', default: 'get' },
      { key: 'resourceName', description: 'Resource name in URL', default: 'items' },
      { key: 'ResourceName', description: 'Resource name capitalized', default: 'Items' },
      { key: 'modelName', description: 'Prisma model name', default: 'item' },
      { key: 'implementationNote', description: 'Implementation note', default: 'Fetch all items from database' },
    ]
  },
  {
    name: 'Python Script',
    description: 'Python script with main function and argument parsing',
    category: 'code',
    contentType: 'code',
    language: 'python',
    icon: 'FileCode',
    content: `#!/usr/bin/env python3
"""
{{scriptDescription}}

Author: {{author}}
Date: {{date}}
"""

import argparse
import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def {{functionName}}({{paramName}}: {{paramType}}) -> {{returnType}}:
    """
    {{functionDescription}}
    
    Args:
        {{paramName}}: {{paramDescription}}
    
    Returns:
        {{returnDescription}}
    """
    logger.info(f"Processing: {{{paramName}}}")
    
    # {{implementationNote}}
    result = {{defaultReturn}}
    
    return result


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='{{scriptDescription}}')
    parser.add_argument(
        '--{{argName}}',
        type=str,
        required={{argRequired}},
        help='{{argDescription}}'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        result = {{functionName}}(args.{{argName}})
        logger.info(f"Result: {result}")
    except Exception as e:
        logger.error(f"Error: {e}")
        raise


if __name__ == '__main__':
    main()
`,
    placeholders: [
      { key: 'scriptDescription', description: 'Description of the script', default: 'A Python utility script' },
      { key: 'author', description: 'Author name', default: 'Your Name' },
      { key: 'date', description: 'Creation date', default: new Date().toISOString().split('T')[0] },
      { key: 'functionName', description: 'Main function name', default: 'process_data' },
      { key: 'paramName', description: 'Parameter name', default: 'input_data' },
      { key: 'paramType', description: 'Parameter type', default: 'str' },
      { key: 'paramDescription', description: 'Parameter description', default: 'Input data to process' },
      { key: 'returnType', description: 'Return type', default: 'Optional[str]' },
      { key: 'returnDescription', description: 'Return description', default: 'Processed result or None' },
      { key: 'defaultReturn', description: 'Default return value', default: 'None' },
      { key: 'implementationNote', description: 'Implementation note', default: 'TODO: Implement logic' },
      { key: 'argName', description: 'CLI argument name', default: 'input' },
      { key: 'argRequired', description: 'Is argument required', default: 'True' },
      { key: 'argDescription', description: 'Argument description', default: 'Input file or value' },
    ]
  },
  {
    name: 'Jest Unit Test',
    description: 'Jest test file with describe/it structure',
    category: 'code',
    contentType: 'code',
    language: 'typescript',
    icon: 'TestTube',
    content: `import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { {{moduleName}} } from './{{modulePath}}';

describe('{{moduleName}}', () => {
  beforeEach(() => {
    // {{setupDescription}}
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('{{methodName}}', () => {
    it('should {{testDescription}}', () => {
      // Arrange
      const input = {{testInput}};
      const expected = {{expectedOutput}};

      // Act
      const result = {{moduleName}}.{{methodName}}(input);

      // Assert
      expect(result).{{matcher}}(expected);
    });

    it('should handle edge case: {{edgeCase}}', () => {
      // Arrange
      const input = {{edgeCaseInput}};

      // Act & Assert
      expect(() => {{moduleName}}.{{methodName}}(input)).{{edgeCaseMatcher}};
    });
  });
});
`,
    placeholders: [
      { key: 'moduleName', description: 'Module/class being tested', default: 'MyModule' },
      { key: 'modulePath', description: 'Import path', default: 'myModule' },
      { key: 'setupDescription', description: 'Setup description', default: 'Reset state before each test' },
      { key: 'methodName', description: 'Method being tested', default: 'process' },
      { key: 'testDescription', description: 'What the test verifies', default: 'return correct output for valid input' },
      { key: 'testInput', description: 'Test input value', default: '"test"' },
      { key: 'expectedOutput', description: 'Expected output', default: '"TEST"' },
      { key: 'matcher', description: 'Jest matcher', default: 'toBe' },
      { key: 'edgeCase', description: 'Edge case description', default: 'null input' },
      { key: 'edgeCaseInput', description: 'Edge case input', default: 'null' },
      { key: 'edgeCaseMatcher', description: 'Edge case assertion', default: 'toThrow()' },
    ]
  },
];

// ========================================
// Writing Templates
// ========================================

const writingTemplates: BuiltInTemplate[] = [
  {
    name: 'Blog Post',
    description: 'Structured blog post with intro, sections, and conclusion',
    category: 'writing',
    contentType: 'text',
    icon: 'FileText',
    content: `# {{title}}

*{{tagline}}*

---

## Introduction

{{introHook}}

In this post, we'll explore {{topic}} and discover {{promise}}.

## {{section1Title}}

{{section1Content}}

### Key Takeaways

- {{takeaway1}}
- {{takeaway2}}
- {{takeaway3}}

## {{section2Title}}

{{section2Content}}

## Conclusion

{{conclusionSummary}}

{{callToAction}}

---

*{{authorBio}}*
`,
    placeholders: [
      { key: 'title', description: 'Blog post title', default: 'Your Compelling Title Here' },
      { key: 'tagline', description: 'Short tagline or subtitle', default: 'A brief description of what readers will learn' },
      { key: 'introHook', description: 'Opening hook to grab attention', default: 'Have you ever wondered...' },
      { key: 'topic', description: 'Main topic', default: 'the fascinating world of [topic]' },
      { key: 'promise', description: 'What readers will gain', default: 'actionable insights you can use today' },
      { key: 'section1Title', description: 'First section title', default: 'Understanding the Basics' },
      { key: 'section1Content', description: 'First section content', default: 'Start with the foundational concepts...' },
      { key: 'takeaway1', description: 'First key takeaway', default: 'Key insight #1' },
      { key: 'takeaway2', description: 'Second key takeaway', default: 'Key insight #2' },
      { key: 'takeaway3', description: 'Third key takeaway', default: 'Key insight #3' },
      { key: 'section2Title', description: 'Second section title', default: 'Practical Applications' },
      { key: 'section2Content', description: 'Second section content', default: 'Now let\'s see how to apply this...' },
      { key: 'conclusionSummary', description: 'Conclusion summary', default: 'We\'ve covered a lot of ground today...' },
      { key: 'callToAction', description: 'Call to action', default: 'Ready to get started? Here\'s what to do next...' },
      { key: 'authorBio', description: 'Author bio', default: 'Written by [Your Name]' },
    ]
  },
  {
    name: 'README.md',
    description: 'Project README with badges, installation, and usage',
    category: 'writing',
    contentType: 'mixed',
    language: 'markdown',
    icon: 'BookOpen',
    content: `# {{projectName}}

{{projectDescription}}

## Features

- {{feature1}}
- {{feature2}}
- {{feature3}}

## Installation

\`\`\`bash
{{installCommand}}
\`\`\`

## Quick Start

\`\`\`{{codeLanguage}}
{{quickStartCode}}
\`\`\`

## Usage

{{usageDescription}}

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| {{optionName}} | {{optionType}} | {{optionDefault}} | {{optionDescription}} |

## Contributing

{{contributingText}}

## License

{{licenseType}}
`,
    placeholders: [
      { key: 'projectName', description: 'Project name', default: 'My Awesome Project' },
      { key: 'projectDescription', description: 'Short project description', default: 'A brief description of what this project does' },
      { key: 'feature1', description: 'Feature 1', default: '✨ Feature one description' },
      { key: 'feature2', description: 'Feature 2', default: '🚀 Feature two description' },
      { key: 'feature3', description: 'Feature 3', default: '🔧 Feature three description' },
      { key: 'installCommand', description: 'Installation command', default: 'npm install your-package' },
      { key: 'codeLanguage', description: 'Code language for examples', default: 'javascript' },
      { key: 'quickStartCode', description: 'Quick start code example', default: 'import pkg from "your-package";\n\npkg.doSomething();' },
      { key: 'usageDescription', description: 'Usage description', default: 'Detailed usage instructions go here...' },
      { key: 'optionName', description: 'Config option name', default: 'debug' },
      { key: 'optionType', description: 'Config option type', default: 'boolean' },
      { key: 'optionDefault', description: 'Config option default', default: 'false' },
      { key: 'optionDescription', description: 'Config option description', default: 'Enable debug mode' },
      { key: 'contributingText', description: 'Contributing guidelines', default: 'Contributions are welcome! Please read our contributing guidelines.' },
      { key: 'licenseType', description: 'License', default: 'MIT' },
    ]
  },
  {
    name: 'Meeting Notes',
    description: 'Structured meeting notes with attendees, agenda, and action items',
    category: 'writing',
    contentType: 'text',
    icon: 'Users',
    content: `# Meeting Notes: {{meetingTitle}}

**Date:** {{date}}
**Time:** {{time}}
**Location:** {{location}}

## Attendees

- {{attendee1}}
- {{attendee2}}
- {{attendee3}}

## Agenda

1. {{agendaItem1}}
2. {{agendaItem2}}
3. {{agendaItem3}}

## Discussion

### {{discussionTopic1}}

{{discussionNotes1}}

### {{discussionTopic2}}

{{discussionNotes2}}

## Decisions Made

- {{decision1}}
- {{decision2}}

## Action Items

| Task | Owner | Due Date |
|------|-------|----------|
| {{task1}} | {{owner1}} | {{due1}} |
| {{task2}} | {{owner2}} | {{due2}} |

## Next Meeting

**Date:** {{nextMeetingDate}}
**Agenda Preview:** {{nextAgenda}}
`,
    placeholders: [
      { key: 'meetingTitle', description: 'Meeting title', default: 'Weekly Team Sync' },
      { key: 'date', description: 'Meeting date', default: new Date().toLocaleDateString() },
      { key: 'time', description: 'Meeting time', default: '10:00 AM' },
      { key: 'location', description: 'Meeting location', default: 'Conference Room A / Zoom' },
      { key: 'attendee1', description: 'Attendee 1', default: 'John Doe (Host)' },
      { key: 'attendee2', description: 'Attendee 2', default: 'Jane Smith' },
      { key: 'attendee3', description: 'Attendee 3', default: 'Bob Johnson' },
      { key: 'agendaItem1', description: 'Agenda item 1', default: 'Project status update' },
      { key: 'agendaItem2', description: 'Agenda item 2', default: 'Blockers and challenges' },
      { key: 'agendaItem3', description: 'Agenda item 3', default: 'Next steps' },
      { key: 'discussionTopic1', description: 'Discussion topic 1', default: 'Project Status' },
      { key: 'discussionNotes1', description: 'Discussion notes 1', default: 'Key points discussed...' },
      { key: 'discussionTopic2', description: 'Discussion topic 2', default: 'Upcoming Milestones' },
      { key: 'discussionNotes2', description: 'Discussion notes 2', default: 'Timeline and deliverables...' },
      { key: 'decision1', description: 'Decision 1', default: 'Agreed to proceed with option A' },
      { key: 'decision2', description: 'Decision 2', default: 'Budget approved for Q2' },
      { key: 'task1', description: 'Action item 1', default: 'Complete documentation' },
      { key: 'owner1', description: 'Task 1 owner', default: 'Jane' },
      { key: 'due1', description: 'Task 1 due date', default: 'Next Friday' },
      { key: 'task2', description: 'Action item 2', default: 'Schedule follow-up meeting' },
      { key: 'owner2', description: 'Task 2 owner', default: 'John' },
      { key: 'due2', description: 'Task 2 due date', default: 'EOD Today' },
      { key: 'nextMeetingDate', description: 'Next meeting date', default: 'Next week, same time' },
      { key: 'nextAgenda', description: 'Next meeting agenda preview', default: 'Review action items, Q2 planning' },
    ]
  },
];

// ========================================
// Business Templates
// ========================================

const businessTemplates: BuiltInTemplate[] = [
  {
    name: 'Email Template',
    description: 'Professional email with clear structure',
    category: 'business',
    contentType: 'text',
    icon: 'Mail',
    content: `Subject: {{subject}}

Hi {{recipientName}},

{{opening}}

{{mainContent}}

{{nextSteps}}

{{closing}}

Best regards,
{{senderName}}
{{senderTitle}}
{{senderContact}}
`,
    placeholders: [
      { key: 'subject', description: 'Email subject', default: 'Regarding [Topic]' },
      { key: 'recipientName', description: 'Recipient name', default: 'Team' },
      { key: 'opening', description: 'Opening line', default: 'I hope this email finds you well.' },
      { key: 'mainContent', description: 'Main email content', default: 'I wanted to reach out regarding...' },
      { key: 'nextSteps', description: 'Next steps or call to action', default: 'Please let me know if you have any questions.' },
      { key: 'closing', description: 'Closing line', default: 'Thank you for your time and consideration.' },
      { key: 'senderName', description: 'Your name', default: 'Your Name' },
      { key: 'senderTitle', description: 'Your title', default: 'Your Title' },
      { key: 'senderContact', description: 'Your contact info', default: 'email@example.com | (555) 123-4567' },
    ]
  },
  {
    name: 'Project Brief',
    description: 'Project overview with objectives, scope, and timeline',
    category: 'business',
    contentType: 'text',
    icon: 'Briefcase',
    content: `# Project Brief: {{projectName}}

## Overview

**Project Lead:** {{projectLead}}
**Start Date:** {{startDate}}
**Target Completion:** {{endDate}}
**Status:** {{status}}

## Executive Summary

{{executiveSummary}}

## Objectives

1. {{objective1}}
2. {{objective2}}
3. {{objective3}}

## Scope

### In Scope
- {{inScope1}}
- {{inScope2}}

### Out of Scope
- {{outOfScope1}}
- {{outOfScope2}}

## Stakeholders

| Name | Role | Responsibility |
|------|------|----------------|
| {{stakeholder1}} | {{role1}} | {{responsibility1}} |
| {{stakeholder2}} | {{role2}} | {{responsibility2}} |

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| {{phase1}} | {{duration1}} | {{deliverable1}} |
| {{phase2}} | {{duration2}} | {{deliverable2}} |

## Success Criteria

- {{successCriteria1}}
- {{successCriteria2}}

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| {{risk1}} | {{impact1}} | {{mitigation1}} |

## Budget

**Estimated Budget:** {{budget}}
**Approval Status:** {{approvalStatus}}
`,
    placeholders: [
      { key: 'projectName', description: 'Project name', default: 'New Feature Development' },
      { key: 'projectLead', description: 'Project lead name', default: 'John Doe' },
      { key: 'startDate', description: 'Start date', default: new Date().toLocaleDateString() },
      { key: 'endDate', description: 'Target end date', default: 'TBD' },
      { key: 'status', description: 'Project status', default: '🟡 Planning' },
      { key: 'executiveSummary', description: 'Executive summary', default: 'Brief overview of the project and its importance...' },
      { key: 'objective1', description: 'Objective 1', default: 'Primary objective' },
      { key: 'objective2', description: 'Objective 2', default: 'Secondary objective' },
      { key: 'objective3', description: 'Objective 3', default: 'Tertiary objective' },
      { key: 'inScope1', description: 'In scope item 1', default: 'Core feature A' },
      { key: 'inScope2', description: 'In scope item 2', default: 'Core feature B' },
      { key: 'outOfScope1', description: 'Out of scope item 1', default: 'Feature X (future phase)' },
      { key: 'outOfScope2', description: 'Out of scope item 2', default: 'Integration with Y' },
      { key: 'stakeholder1', description: 'Stakeholder 1', default: 'Product Manager' },
      { key: 'role1', description: 'Role 1', default: 'Decision Maker' },
      { key: 'responsibility1', description: 'Responsibility 1', default: 'Final approval' },
      { key: 'stakeholder2', description: 'Stakeholder 2', default: 'Engineering Lead' },
      { key: 'role2', description: 'Role 2', default: 'Technical Lead' },
      { key: 'responsibility2', description: 'Responsibility 2', default: 'Implementation oversight' },
      { key: 'phase1', description: 'Phase 1', default: 'Discovery' },
      { key: 'duration1', description: 'Duration 1', default: '2 weeks' },
      { key: 'deliverable1', description: 'Deliverable 1', default: 'Requirements document' },
      { key: 'phase2', description: 'Phase 2', default: 'Development' },
      { key: 'duration2', description: 'Duration 2', default: '4 weeks' },
      { key: 'deliverable2', description: 'Deliverable 2', default: 'Working prototype' },
      { key: 'successCriteria1', description: 'Success criteria 1', default: 'Feature deployed to production' },
      { key: 'successCriteria2', description: 'Success criteria 2', default: '90% user satisfaction' },
      { key: 'risk1', description: 'Risk 1', default: 'Scope creep' },
      { key: 'impact1', description: 'Impact 1', default: 'High' },
      { key: 'mitigation1', description: 'Mitigation 1', default: 'Strict change control process' },
      { key: 'budget', description: 'Budget estimate', default: '$50,000' },
      { key: 'approvalStatus', description: 'Approval status', default: 'Pending' },
    ]
  },
];

// ========================================
// All Templates
// ========================================

export const builtInTemplates: BuiltInTemplate[] = [
  ...codeTemplates,
  ...writingTemplates,
  ...businessTemplates,
];

export default builtInTemplates;
