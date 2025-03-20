const Router = require('express');
const router = new Router();
const kpController = require('../controllers/kpController');

router.get('/', kpController.getKpIndex); // Существующий маршрут
router.get('/forecast', kpController.getKpIndexForecast); // Новый маршрут для прогноза

module.exports = router;