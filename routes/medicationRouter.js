const Router = require('express');
const router = new Router();
const medicationController = require('../controllers/medicationController');

// Получить все лекарства
router.get('/', medicationController.getAll);

// Получить все лекарство пользователя по userId
router.get('/user/:userId', medicationController.getByUserId);

// Получить все лекарство (шаблонные и пользовательские) для конкретного пользователя
router.get('/all/:userId', medicationController.getAllMedication);

// Получить лекарство по id
router.get('/:id', medicationController.getOne);

// Создать новое лекарство
router.post('/', medicationController.create);

// Обновить лекарство
router.put('/:id', medicationController.update);

// Удалить лекарство
router.delete('/:id', medicationController.delete);

module.exports = router;
