const Router = require('express');
const router = new Router();
const reportController = require('../controllers/reportController');

// Создать отчет о симптомах
router.post('/symptoms', reportController.createSymptomReport);

// Создать отчет о лекарствах
router.post('/medications', reportController.createMedicationReport);

// Получить отчет по ID
router.get('/:id', reportController.getOne);

// Получить все отчеты пользователя
router.get('/user/:userId', reportController.getAll);

// Удалить отчет
router.delete('/:id', reportController.delete);

module.exports = router;
