import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { userTokenRepository } from '../../../infrastructure/persistence/UserTokenRepository';
import { newsSourceRepository } from '../../../infrastructure/persistence/NewsSourceRepository';
import { adminChannelAccessRepository } from '../../../infrastructure/persistence/AdminChannelAccessRepository';
import { auditLogger } from '../../../infrastructure/audit/AuditLogger';
import { BadRequestError } from '../../../../shared/utils/errors';

const router = Router();

router.use(authenticateAdmin);

// GET /api/admin/admin-channels/token
router.get('/token', asyncHandler(async (req, res) => {
  const adminToken = await userTokenRepository.findAdminToken();
  
  if (!adminToken) {
    res.status(404).json({ error: 'Admin token not found' });
    return;
  }

  res.json({
    success: true,
    token: {
      id: adminToken.id,
      token: adminToken.token,
      label: adminToken.label,
      isActive: adminToken.isActive,
      createdAt: adminToken.createdAt,
      expiresAt: adminToken.expiresAt,
      lastUsedAt: adminToken.lastUsedAt,
    },
  });
}));

// GET /api/admin/admin-channels/sources
router.get('/sources', asyncHandler(async (req, res) => {
  const sources = await newsSourceRepository.findAll();
  console.log('[Zone O] Total sources:', sources.length);
  
  const privateSources = sources.filter(s => {
    console.log(`[Zone O] Source ${s.id} (${s.name}): isPrivate=${s.isPrivate}, type=${typeof s.isPrivate}`);
    return s.isPrivate === true;
  });
  console.log('[Zone O] Private sources:', privateSources.length);
  console.log('[Zone O] Private sources details:', privateSources.map(s => ({ id: s.id, name: s.name, type: s.sourceType, isPrivate: s.isPrivate })));

  const sourcesWithAccess = await Promise.all(
    privateSources.map(async (source) => {
      const adminTokenIds = await adminChannelAccessRepository.getAdminsWithAccess(source.id);
      return {
        ...source,
        adminTokenIds,
      };
    })
  );

  res.json({
    success: true,
    sources: sourcesWithAccess,
  });
}));

// POST /api/admin/admin-channels/sources
router.post('/sources', asyncHandler(async (req, res) => {
  const { name, url, sourceType, region, category, username, channelId } = req.body;
  let { rssUrl } = req.body;

  if (!name || !url || !sourceType) {
    throw new BadRequestError('Missing required fields');
  }

  if (sourceType !== 'telegram' && sourceType !== 'youtube') {
    throw new BadRequestError('sourceType must be telegram or youtube');
  }

  // Автогенерация RSS URL для YouTube
  if (sourceType === 'youtube') {
    if (!channelId) {
      throw new BadRequestError('channelId required for YouTube channels');
    }
    rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }

  if (!rssUrl) {
    throw new BadRequestError('rssUrl required');
  }

  const source = await newsSourceRepository.insert({
    name,
    url,
    rssUrl,
    sourceType,
    region: region || 'russia',
    category: category || 'other',
    city: null,
    isActive: true,
    isFeatured: false,
  });

  await newsSourceRepository.update(source.id, {
    isPrivate: true,
    username: sourceType === 'telegram' ? username : null,
    channelId: sourceType === 'youtube' ? channelId : null,
  });

  const adminToken = await userTokenRepository.findAdminToken();
  if (adminToken) {
    await adminChannelAccessRepository.grantAccess(adminToken.id, source.id);
  }

  await auditLogger.log({
    adminToken: req.headers.authorization?.split(' ')[1] || '',
    action: 'CREATE',
    resource: 'admin_private_channel',
    resourceId: String(source.id),
    newValue: { name, sourceType, isPrivate: true },
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || undefined,
    success: true,
  });

  res.json({ success: true, source });
}));

// PUT /api/admin/admin-channels/sources/:id
router.put('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  const source = await newsSourceRepository.findById(id);
  if (!source || !source.isPrivate) {
    res.status(404).json({ error: 'Private channel not found' });
    return;
  }

  const { name, url, sourceType, region, category, username, channelId } = req.body;
  let { rssUrl } = req.body;

  if (!name || !url || !sourceType) {
    throw new BadRequestError('Missing required fields');
  }

  if (sourceType !== 'telegram' && sourceType !== 'youtube') {
    throw new BadRequestError('sourceType must be telegram or youtube');
  }

  // Автогенерация RSS URL для YouTube
  if (sourceType === 'youtube') {
    if (!channelId) {
      throw new BadRequestError('channelId required for YouTube channels');
    }
    rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }

  if (!rssUrl) {
    throw new BadRequestError('rssUrl required');
  }

  await newsSourceRepository.update(id, {
    name,
    url,
    rssUrl,
    sourceType,
    region: region || source.region,
    category: category || source.category,
    username: sourceType === 'telegram' ? username : null,
    channelId: sourceType === 'youtube' ? channelId : null,
  });

  await auditLogger.log({
    adminToken: req.headers.authorization?.split(' ')[1] || '',
    action: 'UPDATE',
    resource: 'admin_private_channel',
    resourceId: String(id),
    oldValue: source,
    newValue: { name, url, rssUrl, sourceType, username, channelId },
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || undefined,
    success: true,
  });

  res.json({ success: true });
}));

// DELETE /api/admin/admin-channels/sources/:id
router.delete('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  const source = await newsSourceRepository.findById(id);
  if (!source || !source.isPrivate) {
    res.status(404).json({ error: 'Private channel not found' });
    return;
  }

  await adminChannelAccessRepository.revokeAllAccess(id);
  await newsSourceRepository.delete(id);

  await auditLogger.log({
    adminToken: req.headers.authorization?.split(' ')[1] || '',
    action: 'DELETE',
    resource: 'admin_private_channel',
    resourceId: String(id),
    oldValue: source,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || undefined,
    success: true,
  });

  res.json({ success: true });
}));

export default router;
