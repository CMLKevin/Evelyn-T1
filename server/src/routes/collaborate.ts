import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { diffDocuments, generateAIExplanation, threeWayMerge, generateAIMergeResolutions } from '../agent/documentComparison.js';

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
// NOTE: This route must be defined AFTER specific routes like /folders, /tags, /templates
// to avoid matching those paths as :id
router.get('/api/collaborate/:id', async (req, res) => {
  try {
    // Skip reserved paths that should be handled by other routes
    const reservedPaths = ['folders', 'tags', 'templates', 'compare', 'shortcuts'];
    if (reservedPaths.includes(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const documentId = parseInt(req.params.id);
    
    // Validate documentId is a valid number
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
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

// Get collaborate chat history for a document
router.get('/api/collaborate/:id/chat', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const rawMessages = await prisma.message.findMany({
      where: {
        role: { in: ['user', 'assistant'] },
        auxiliary: {
          contains: '"channel":"collaborate"'
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const filtered = rawMessages
      .map((msg) => {
        if (!msg.auxiliary) {
          return null;
        }

        try {
          const aux = JSON.parse(msg.auxiliary);

          if (aux.channel !== 'collaborate' || aux.documentId !== documentId) {
            return null;
          }

          return {
            id: msg.id,
            role: msg.role === 'assistant' ? 'evelyn' : 'user',
            content: msg.content,
            timestamp: msg.createdAt.toISOString(),
            messageIndex: typeof aux.messageIndex === 'number'
              ? aux.messageIndex
              : undefined
          };
        } catch {
          return null;
        }
      })
      .filter((msg): msg is { id: number; role: 'user' | 'evelyn'; content: string; timestamp: string; messageIndex: number | undefined } => msg !== null);

    const result = filtered.map((msg, idx) => ({
      ...msg,
      messageIndex: msg.messageIndex !== undefined ? msg.messageIndex : idx
    }));

    return res.json(result);
  } catch (error) {
    console.error('[Collaborate] Load chat history error:', error);
    return res.status(500).json({ error: 'Failed to load collaborate chat history' });
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
// Document Organization
// ========================================

// Toggle favorite
router.put('/api/collaborate/:id/favorite', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { isFavorite } = req.body;
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { isFavorite: Boolean(isFavorite) }
    });

    console.log(`[Collaborate] Document ${documentId} favorite: ${isFavorite}`);
    res.json(document);
  } catch (error) {
    console.error('[Collaborate] Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Update tags
router.put('/api/collaborate/:id/tags', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { tags } = req.body;
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { tags: JSON.stringify(tags) }
    });

    console.log(`[Collaborate] Document ${documentId} tags updated: ${tags.join(', ')}`);
    return res.json({ ...document, tags });
  } catch (error) {
    console.error('[Collaborate] Update tags error:', error);
    return res.status(500).json({ error: 'Failed to update tags' });
  }
});

// Move to folder
router.put('/api/collaborate/:id/folder', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { folderId } = req.body;
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { folderId: folderId ?? null }
    });

    console.log(`[Collaborate] Document ${documentId} moved to folder: ${folderId ?? 'root'}`);
    res.json(document);
  } catch (error) {
    console.error('[Collaborate] Move to folder error:', error);
    res.status(500).json({ error: 'Failed to move document to folder' });
  }
});

// Update document color
router.put('/api/collaborate/:id/color', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { color } = req.body;
    
    const document = await prisma.collaborateDocument.update({
      where: { id: documentId },
      data: { color: color ?? null }
    });

    console.log(`[Collaborate] Document ${documentId} color: ${color ?? 'none'}`);
    res.json(document);
  } catch (error) {
    console.error('[Collaborate] Update color error:', error);
    res.status(500).json({ error: 'Failed to update document color' });
  }
});

// ========================================
// Folder Management
// ========================================

// Get all folders
router.get('/api/collaborate/folders', async (req, res) => {
  try {
    const folders = await prisma.collaborateFolder.findMany({
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });

    res.json(folders);
  } catch (error) {
    console.error('[Collaborate] Get folders error:', error);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});

// Create folder
router.post('/api/collaborate/folders', async (req, res) => {
  try {
    const { name, parentId, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Get next order number for this parent
    const maxOrder = await prisma.collaborateFolder.aggregate({
      where: { parentId: parentId ?? null },
      _max: { order: true }
    });

    const folder = await prisma.collaborateFolder.create({
      data: {
        name,
        parentId: parentId ?? null,
        color: color ?? null,
        order: (maxOrder._max.order ?? 0) + 1
      }
    });

    console.log(`[Collaborate] Created folder: ${name}`);
    return res.json(folder);
  } catch (error) {
    console.error('[Collaborate] Create folder error:', error);
    return res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Update folder
router.put('/api/collaborate/folders/:folderId', async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const { name, color, order, parentId } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (parentId !== undefined) updateData.parentId = parentId;

    const folder = await prisma.collaborateFolder.update({
      where: { id: folderId },
      data: updateData
    });

    console.log(`[Collaborate] Updated folder ${folderId}`);
    res.json(folder);
  } catch (error) {
    console.error('[Collaborate] Update folder error:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete folder
router.delete('/api/collaborate/folders/:folderId', async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    
    // Move all documents in this folder to root
    await prisma.collaborateDocument.updateMany({
      where: { folderId },
      data: { folderId: null }
    });

    // Move child folders to parent (or root)
    const folder = await prisma.collaborateFolder.findUnique({
      where: { id: folderId }
    });

    if (folder) {
      await prisma.collaborateFolder.updateMany({
        where: { parentId: folderId },
        data: { parentId: folder.parentId }
      });
    }

    await prisma.collaborateFolder.delete({
      where: { id: folderId }
    });

    console.log(`[Collaborate] Deleted folder ${folderId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Collaborate] Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Get all unique tags across documents
router.get('/api/collaborate/tags', async (req, res) => {
  try {
    const documents = await prisma.collaborateDocument.findMany({
      where: { status: 'active' },
      select: { tags: true }
    });

    const allTags = new Set<string>();
    documents.forEach(doc => {
      try {
        const tags = JSON.parse(doc.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => allTags.add(tag));
        }
      } catch {
        // Ignore parse errors
      }
    });

    res.json([...allTags].sort());
  } catch (error) {
    console.error('[Collaborate] Get all tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

// ========================================
// Template Management
// ========================================

// Get all templates
router.get('/api/collaborate/templates', async (req, res) => {
  try {
    const templates = await prisma.collaborateTemplate.findMany({
      orderBy: [{ isBuiltIn: 'desc' }, { usageCount: 'desc' }, { name: 'asc' }]
    });

    // Parse placeholders JSON for each template
    const parsedTemplates = templates.map(t => ({
      ...t,
      placeholders: JSON.parse(t.placeholders || '[]')
    }));

    return res.json(parsedTemplates);
  } catch (error) {
    console.error('[Collaborate] Get templates error:', error);
    return res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Get single template
router.get('/api/collaborate/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const template = await prisma.collaborateTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json({
      ...template,
      placeholders: JSON.parse(template.placeholders || '[]')
    });
  } catch (error) {
    console.error('[Collaborate] Get template error:', error);
    return res.status(500).json({ error: 'Failed to get template' });
  }
});

// Create custom template
router.post('/api/collaborate/templates', async (req, res) => {
  try {
    const { name, description, category, contentType, language, content, placeholders, icon } = req.body;

    const template = await prisma.collaborateTemplate.create({
      data: {
        name,
        description: description || '',
        category: category || 'custom',
        contentType: contentType || 'text',
        language,
        content,
        placeholders: JSON.stringify(placeholders || []),
        icon,
        isBuiltIn: false
      }
    });

    console.log(`[Collaborate] Created template: ${template.name}`);
    res.json({
      ...template,
      placeholders: JSON.parse(template.placeholders)
    });
  } catch (error) {
    console.error('[Collaborate] Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Track template usage
router.post('/api/collaborate/templates/:id/use', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    await prisma.collaborateTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Collaborate] Track template usage error:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Delete custom template
router.delete('/api/collaborate/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    const template = await prisma.collaborateTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.isBuiltIn) {
      return res.status(400).json({ error: 'Cannot delete built-in templates' });
    }

    await prisma.collaborateTemplate.delete({
      where: { id: templateId }
    });

    console.log(`[Collaborate] Deleted template: ${template.name}`);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Collaborate] Delete template error:', error);
    return res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ========================================
// Document Comparison
// ========================================

// Compare two versions or documents
router.post('/api/collaborate/compare', async (req, res) => {
  try {
    const { documentIdA, versionA, documentIdB, versionB, contentA, contentB } = req.body;

    let docAContent: string;
    let docBContent: string;

    // Get content from versions or direct content
    if (contentA && contentB) {
      docAContent = contentA;
      docBContent = contentB;
    } else {
      // Fetch from database
      if (versionA !== undefined) {
        const version = await prisma.collaborateVersion.findFirst({
          where: { documentId: documentIdA, version: versionA }
        });
        docAContent = version?.content || '';
      } else {
        const doc = await prisma.collaborateDocument.findUnique({
          where: { id: documentIdA },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });
        docAContent = (doc?.versions[0] as any)?.content || '';
      }

      if (versionB !== undefined) {
        const version = await prisma.collaborateVersion.findFirst({
          where: { documentId: documentIdB || documentIdA, version: versionB }
        });
        docBContent = version?.content || '';
      } else if (documentIdB) {
        const doc = await prisma.collaborateDocument.findUnique({
          where: { id: documentIdB },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });
        docBContent = (doc?.versions[0] as any)?.content || '';
      } else {
        docBContent = docAContent;
      }
    }

    // Generate diff
    const comparison = diffDocuments(docAContent, docBContent);

    res.json({
      comparison,
      contentA: docAContent,
      contentB: docBContent
    });
  } catch (error) {
    console.error('[Collaborate] Compare error:', error);
    res.status(500).json({ error: 'Failed to compare documents' });
  }
});

// Get AI explanation for changes
router.post('/api/collaborate/compare/explain', async (req, res) => {
  try {
    const { contentA, contentB, comparison, contentType } = req.body;

    const explanation = await generateAIExplanation(contentA, contentB, comparison, contentType);

    res.json(explanation);
  } catch (error) {
    console.error('[Collaborate] AI explanation error:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

// Merge documents
router.post('/api/collaborate/merge', async (req, res) => {
  try {
    const { base, left, right, resolveWithAI } = req.body;

    const mergeResult = threeWayMerge(base, left, right);

    // Generate AI resolutions if requested and there are conflicts
    if (resolveWithAI && mergeResult.conflicts.length > 0) {
      const aiResolutions = await generateAIMergeResolutions(mergeResult.conflicts, {
        contentType: req.body.contentType
      });
      mergeResult.aiResolutions = aiResolutions;
    }

    res.json(mergeResult);
  } catch (error) {
    console.error('[Collaborate] Merge error:', error);
    res.status(500).json({ error: 'Failed to merge documents' });
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
