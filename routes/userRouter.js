// userRoutes.js

const Router = require('express');
const router = new Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Маршруты для регистрации и авторизации
router.post('/registration', userController.registration);
router.post('/login', userController.login);

// Защищенные маршруты с аутентификацией
router.get('/auth', authMiddleware, userController.check);

// Маршрут для получения данных пользователя по id
router.get('/:id', authMiddleware, userController.getUserDataById);


module.exports = router;
