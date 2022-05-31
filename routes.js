import express from 'express';
import healthRoute from './api/controllers/health.js';
import v1 from './api/controllers/v1.js';
import content from './api/controllers/content.js';
const router = express.Router();

// Api V1 Routes Start -------------------

// Get Routes

router.get('/search', v1.search);
router.get('/canAccess', v1.canAccess);
router.get('/content-entries', content.contentfulEntries);
router.get('/getSpecialtyYears', v1.getSpecialtyYears);
router.get('/getPrintIssues', v1.getPrintIssues);

// Post Routes

router.post('/article', v1.article);
router.post('/login', v1.login);
router.post('/athensLogin', v1.loginAthens);
router.post('/azureLogin', v1.loginAzure);
router.post('/refresh-token', v1.refresh_token);

// Health Api

router.get('/v1/health', healthRoute);


export default router;