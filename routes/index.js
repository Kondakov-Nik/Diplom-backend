const Router = require('express');
const router = new Router();

// Импортируем маршруты
const userRouter = require('./userRouter');
const symptomRouter = require('./symptomRouter');
const medicationRouter = require('./medicationRouter');
const healthrecordRouter = require('./healthrecordRouter');
const reportRouter = require('./reportRouter');
const aiRouter = require('./aiRouter');
const kpRouter = require('./kpRouter'); // Убедитесь, что путь правильный
const analysisRouter = require('./analysisRouter'); // Импортируем маршруты для анализов

// Настройка маршрутов
router.use('/user', userRouter);
router.use('/symptom', symptomRouter);
router.use('/medication', medicationRouter);
router.use('/healthRecords', healthrecordRouter);
router.use('/reports', reportRouter);
router.use('/ai', aiRouter);
router.use('/kp-index', kpRouter); // Путь для KP-индекса
router.use('/analysis', analysisRouter);

module.exports = router;