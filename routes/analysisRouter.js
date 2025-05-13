const Router = require('express');
const router = new Router();
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middleware/authMiddleware');

// Маршрут для загрузки анализа (требуется аутентификация)
router.post('/upload', authMiddleware, analysisController.uploadAnalysis);  

// Маршрут для получения списка анализов пользователя
router.get('/user/:userId', authMiddleware, analysisController.getUserAnalyses);

// Маршрут для удаления анализа
router.delete('/:analysisId', authMiddleware, analysisController.deleteAnalysis);

// Маршрут для скачивания файла анализа
router.get('/file/:analysisId', authMiddleware, analysisController.getAnalysisFile);

module.exports = router;