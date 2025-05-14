const Router = require('express');
const router = new Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// Получение списка отчетов пользователя по ID
router.get('/user/:userId', authMiddleware, reportController.getUserReports);

// Открытие отчетов на сайте
router.get('/:reportId/download', authMiddleware, reportController.getReportFile);

// Удалить отчет
router.delete('/:reportId', authMiddleware, reportController.deleteReport); 

// Получение списка отчетов
router.post('/:type/:format', authMiddleware, (req, res, next) => {
    const { type, format } = req.params;
    if (type === 'symptoms' && format === 'pdf') {
      reportController.createSymptomReport(req, res, next);
    } else if (type === 'symptoms' && format === 'excel') {
      reportController.createSymptomReportExcel(req, res, next);
    } else if (type === 'medications' && format === 'pdf') {
      reportController.createMedicationReport(req, res, next);
    } else if (type === 'medications' && format === 'excel') {
      reportController.createMedicationReportExcel(req, res, next);
    } else {
      return res.status(400).json({ message: 'Invalid type or format' });
    }
  });
module.exports = router;