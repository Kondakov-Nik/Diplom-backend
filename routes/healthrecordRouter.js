const Router = require('express');
const router = new Router();
const healthRecordController = require('../controllers/healthrecordController');

// Получить все записи о симптомах и лекарствах
router.get('/', healthRecordController.getAll);

// Получить записи для определенного пользователя на определенную дату
router.get('/user/:userId/date/:recordDate', healthRecordController.getByUserAndDate);

// Получить запись по id
router.get('/:id', healthRecordController.getOne);

// Создать новую запись симптома
router.post('/symptoms', healthRecordController.createSymptom);

// Создать новую запись лекарства
router.post('/medications', healthRecordController.createMedication);

// Обновить запись
router.put('/:id', healthRecordController.update);

// Удалить запись
router.delete('/:id', healthRecordController.delete);

module.exports = router;
