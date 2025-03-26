const Router = require('express');
const router = new Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// Создать отчет о симптомах
router.post('/symptoms',  reportController.createSymptomReport);

// Создать отчет о лекарствах
router.post('/medications', reportController.createMedicationReport);

// Получение списка отчетов пользователя по ID
router.get('/user/:userId', authMiddleware, reportController.getUserReports);

// Открытие отчетов на сайте
router.get('/:reportId/download', authMiddleware, reportController.getReportFile);

// Удалить отчет
router.delete('/:reportId', authMiddleware, reportController.deleteReport); 

module.exports = router;