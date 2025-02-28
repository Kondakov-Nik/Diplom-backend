const Router = require('express');
const router = new Router();

// Импортируем маршруты
const userRouter = require('./userRouter')
const symptomRouter = require('./symptomRouter');
const medicationRouter = require('./medicationRouter');
const healthrecordRouter = require('./healthrecordRouter');
const reportRouter = require('./reportRouter');
const aiRouter = require('./aiRouter');  


// Настройка маршрутов
router.use('/user', userRouter)
router.use('/symptom', symptomRouter);
router.use('/medication', medicationRouter);
router.use('/healthRecords', healthrecordRouter);
router.use('/reports', reportRouter);
router.use('/ai', aiRouter);  


module.exports = router;
