const Router = require('express');
const router = new Router();
const symptomController = require('../controllers/symptomController');

// Получить все симптомы ??????
router.get('/', symptomController.getAll);

// Получить все симптомы пользователя по userId
router.get('/user/:userId', symptomController.getByUserId);

// Получить все симптомы (шаблонные и пользовательские) для конкретного пользователя
router.get('/all/:userId', symptomController.getAllSymptoms);

// Получить определенный симптом по его id
router.get('/:id', symptomController.getOne);

// Создать новый симптом
router.post('/', symptomController.create);

// Обновить симптом
router.put('/:id', symptomController.update);

// Удалить симптом
router.delete('/:id', symptomController.delete);

module.exports = router;
