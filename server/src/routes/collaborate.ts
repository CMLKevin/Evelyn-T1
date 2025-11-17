import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// ========================================
// Document Management
// ========================================

// Create new document
router.post('/api/collaborate', async (req, res) => {
  try {
    const { title, contentType, language, initialContent } = req.body;
    
    if (!title || !contentType) {
      return res.status(400).json({ error: 'Title and content type are required' });
    }

    const sessionId = uuidv4();
    
    // Create document with initial version
    const document = await prisma.collaborateDocument.create({
      data: {
        sessionId,
        title,
        contentType,
        language: language || null,
        status: 'active',
        versions: {
          create: {
            version: 1,
            content: initialContent || '',
            description: 'Initial version',
            createdBy: 'user'
          }
        }
      },
      include: {
        versions: true,
        suggestions: true,
        comments: true
      }
    });

    console.log(`[Collaborate] Created document ${document.id}: ${title}`);
    return res.json(document);
  } catch (error) {
    console.error('[Collaborate] Create document error:', error);
    return res.status(500).json({ error: 'Failed to create document' });
  }
});

// List all documents
router.get('/api/collaborate', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    const documents = await prisma.collaborateDocument.findMany({
      where: status ? { status: status as string } : undefined,
      take: Number(limit),
      orderBy: { lastAccessedAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        },
        _count: {
          select: {
            suggestions: true,
            comments: true,
            versions: true
          }
        }
      }
    });

    return res.json(documents);
  } catch (error) {
    console.error('[Collaborate] List documents error:', error);
    return res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Get document by ID
router.get('/api/collaborate/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.collaborateDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        },
        suggestions: {
          where: { status: { not: 'rejected' } },
          orderBy: { createdAt: 'desc' }
        },
        comments: {
          orderBy: { createdAt: 'desc' }
        },
        editHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Update last accessed time
    await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { lastAccessedAt: new Date() }
    });

    return res.json(document);
  } catch (error) {
    console.error('[Collaborate] Get document error:', error);
    return res.status(500).json({ error: 'Failed to get document' });
  }
});

// Update document content
router.put('/api/collaborate/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { content, title, language, metadata } = req.body;
    
    const updateData: any = {
      updatedAt: new Date(),
      lastAccessedAt: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (language !== undefined) updateData.language = language;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: updateData,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    // If content is provided, create edit history entry
    if (content !== undefined) {
      const latestVersion = document.versions[0];
      
      await prisma.collaborateEdit.create({
        data: {
          documentId,
          author: 'user',
          editType: 'replace',
          beforeText: latestVersion?.content || '',
          afterText: content,
          position: JSON.stringify({ type: 'full_document' }),
          description: 'User edit'
        }
      });
    }

    res.json(document);
  } catch (error) {
    console.error('[Collaborate] Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/api/collaborate/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    await prisma.collaborateDocument.delete({
      where: { id: documentId }
    });

    console.log(`[Collaborate] Deleted document ${documentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Collaborate] Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Archive document
router.patch('/api/collaborate/:id/archive', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { status: 'archived' }
    });

    res.json(document);
  } catch (error) {
    console.error('[Collaborate] Archive document error:', error);
    res.status(500).json({ error: 'Failed to archive document' });
  }
});

// ========================================
// Content Operations
// ========================================

// Request suggestions
router.post('/api/collaborate/:id/suggest', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { category, selectedText, lineStart, lineEnd } = req.body;
    
    const document = await prisma.collaborateDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // This will be implemented in Phase 1.4 (AI Integration)
    // For now, return a placeholder response
    return res.json({ 
      message: 'Suggestion request received',
      documentId,
      category,
      note: 'AI integration will be implemented in Phase 1.4'
    });
  } catch (error) {
    console.error('[Collaborate] Request suggestions error:', error);
    return res.status(500).json({ error: 'Failed to request suggestions' });
  }
});

// Apply suggestion
router.post('/api/collaborate/:id/apply-suggestion', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { suggestionId } = req.body;
    
    const suggestion = await prisma.collaborateSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'applied',
        appliedAt: new Date()
      }
    });

    // Create edit history entry
    await prisma.collaborateEdit.create({
      data: {
        documentId,
        author: 'evelyn',
        editType: 'replace',
        beforeText: suggestion.originalText || '',
        afterText: suggestion.suggestedText || '',
        position: JSON.stringify({
          lineStart: suggestion.lineStart,
          lineEnd: suggestion.lineEnd,
          charStart: suggestion.charStart,
          charEnd: suggestion.charEnd
        }),
        description: `Applied suggestion: ${suggestion.title}`
      }
    });

    res.json(suggestion);
  } catch (error) {
    console.error('[Collaborate] Apply suggestion error:', error);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});

// Reject suggestion
router.post('/api/collaborate/:id/reject-suggestion', async (req, res) => {
  try {
    const { suggestionId } = req.body;
    
    const suggestion = await prisma.collaborateSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'rejected' }
    });

    res.json(suggestion);
  } catch (error) {
    console.error('[Collaborate] Reject suggestion error:', error);
    res.status(500).json({ error: 'Failed to reject suggestion' });
  }
});

// ========================================
// Shortcuts (Placeholders - will be implemented in Phase 1.4)
// ========================================

router.post('/api/collaborate/:id/shortcut/adjust-length', async (req, res) => {
  const { direction } = req.body; // 'shorter' | 'longer'
  res.json({ message: 'Adjust length shortcut - to be implemented in Phase 1.4', direction });
});

router.post('/api/collaborate/:id/shortcut/reading-level', async (req, res) => {
  const { level } = req.body; // 'kindergarten' | 'elementary' | 'middle' | 'high' | 'college' | 'graduate'
  res.json({ message: 'Reading level shortcut - to be implemented in Phase 1.4', level });
});

router.post('/api/collaborate/:id/shortcut/add-polish', async (req, res) => {
  res.json({ message: 'Add polish shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/add-emojis', async (req, res) => {
  res.json({ message: 'Add emojis shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/review-code', async (req, res) => {
  res.json({ message: 'Review code shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/add-logs', async (req, res) => {
  res.json({ message: 'Add logs shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/add-comments', async (req, res) => {
  res.json({ message: 'Add comments shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/fix-bugs', async (req, res) => {
  res.json({ message: 'Fix bugs shortcut - to be implemented in Phase 1.4' });
});

router.post('/api/collaborate/:id/shortcut/port-language', async (req, res) => {
  const { targetLanguage } = req.body;
  res.json({ message: 'Port language shortcut - to be implemented in Phase 1.4', targetLanguage });
});

// ========================================
// Version Control
// ========================================

// Get version history
router.get('/api/collaborate/:id/versions', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const versions = await prisma.collaborateVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' }
    });

    return res.json(versions);
  } catch (error) {
    console.error('[Collaborate] Get versions error:', error);
    return res.status(500).json({ error: 'Failed to get version history' });
  }
});

// Save new version
router.post('/api/collaborate/:id/save-version', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { content, description, createdBy = 'user' } = req.body;
    
    // Get latest version number
    const latestVersion = await prisma.collaborateVersion.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' }
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;
    
    const version = await prisma.collaborateVersion.create({
      data: {
        documentId,
        version: newVersionNumber,
        content,
        description,
        createdBy
      }
    });

    // Update document timestamp
    await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { updatedAt: new Date() }
    });

    console.log(`[Collaborate] Saved version ${newVersionNumber} for document ${documentId}`);
    res.json(version);
  } catch (error) {
    console.error('[Collaborate] Save version error:', error);
    res.status(500).json({ error: 'Failed to save version' });
  }
});

// Revert to version
router.post('/api/collaborate/:id/revert', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { versionId } = req.body;
    
    const targetVersion = await prisma.collaborateVersion.findUnique({
      where: { id: versionId }
    });

    if (!targetVersion || targetVersion.documentId !== documentId) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Create a new version with the old content
    const latestVersion = await prisma.collaborateVersion.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' }
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;
    
    const newVersion = await prisma.collaborateVersion.create({
      data: {
        documentId,
        version: newVersionNumber,
        content: targetVersion.content,
        description: `Reverted to version ${targetVersion.version}`,
        createdBy: 'user',
        evelynNote: `This version restores content from version ${targetVersion.version}`
      }
    });

    // Create edit history entry
    await prisma.collaborateEdit.create({
      data: {
        documentId,
        author: 'user',
        editType: 'replace',
        beforeText: latestVersion?.content || '',
        afterText: targetVersion.content,
        position: JSON.stringify({ type: 'full_document' }),
        description: `Reverted to version ${targetVersion.version}`
      }
    });

    return res.json(newVersion);
  } catch (error) {
    console.error('[Collaborate] Revert version error:', error);
    return res.status(500).json({ error: 'Failed to revert version' });
  }
});

// Get diff between versions
router.get('/api/collaborate/:id/diff', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { fromVersion, toVersion } = req.query;
    
    const versions = await prisma.collaborateVersion.findMany({
      where: {
        documentId,
        version: {
          in: [Number(fromVersion), Number(toVersion)]
        }
      }
    });

    if (versions.length !== 2) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    const from = versions.find(v => v.version === Number(fromVersion));
    const to = versions.find(v => v.version === Number(toVersion));

    return res.json({
      fromVersion: from,
      toVersion: to,
      // Diff will be computed on frontend
    });
  } catch (error) {
    console.error('[Collaborate] Get diff error:', error);
    return res.status(500).json({ error: 'Failed to get diff' });
  }
});

// ========================================
// Comments
// ========================================

// Add comment
router.post('/api/collaborate/:id/comments', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { author, content, lineStart, lineEnd } = req.body;
    
    const comment = await prisma.collaborateComment.create({
      data: {
        documentId,
        author: author || 'user',
        content,
        lineStart,
        lineEnd
      }
    });

    return res.json(comment);
  } catch (error) {
    console.error('[Collaborate] Add comment error:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/api/collaborate/:id/comments/:commentId', async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    
    await prisma.collaborateComment.delete({
      where: { id: commentId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Collaborate] Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Resolve comment
router.patch('/api/collaborate/:id/comments/:commentId/resolve', async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const { resolved = true } = req.body;
    
    const comment = await prisma.collaborateComment.update({
      where: { id: commentId },
      data: { resolved }
    });

    res.json(comment);
  } catch (error) {
    console.error('[Collaborate] Resolve comment error:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// ========================================
// Export
// ========================================

router.post('/api/collaborate/:id/export', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { format = 'txt' } = req.body; // txt | md | html | json
    
    const document = await prisma.collaborateDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const latestVersion = document.versions[0];
    const content = latestVersion?.content || '';
    
    let exportedContent = content;
    let mimeType = 'text/plain';
    let filename = `${document.title}.txt`;

    switch (format) {
      case 'md':
        mimeType = 'text/markdown';
        filename = `${document.title}.md`;
        break;
      case 'html':
        mimeType = 'text/html';
        filename = `${document.title}.html`;
        exportedContent = `<!DOCTYPE html>
<html>
<head>
  <title>${document.title}</title>
  <meta charset="UTF-8">
</head>
<body>
  <pre>${content}</pre>
</body>
</html>`;
        break;
      case 'json':
        mimeType = 'application/json';
        filename = `${document.title}.json`;
        exportedContent = JSON.stringify({
          title: document.title,
          contentType: document.contentType,
          language: document.language,
          content,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        }, null, 2);
        break;
      default:
        if (document.language) {
          const extensions: Record<string, string> = {
            javascript: 'js',
            typescript: 'ts',
            python: 'py',
            java: 'java',
            cpp: 'cpp',
            php: 'php'
          };
          const ext = extensions[document.language] || 'txt';
          filename = `${document.title}.${ext}`;
        }
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(exportedContent);
  } catch (error) {
    console.error('[Collaborate] Export error:', error);
    return res.status(500).json({ error: 'Failed to export document' });
  }
});

export default router;
