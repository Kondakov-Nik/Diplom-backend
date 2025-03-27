const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController'); // Импортируем контроллер
const Bottleneck = require('bottleneck');

// Создаём лимитер для ограничения количества запросов
const limiter = new Bottleneck({
  minTime: 1000, // Задержка между запросами в 1 секунду
  maxConcurrent: 1, // Одновременные запросы
  strategy: Bottleneck.strategy.LEAK, // Стратегия "поступления" запросов
});

// Оборачиваем запросы с лимитированием
const getHealthDataRequest = limiter.wrap(aiController.getHealthData);
const getAIResponseRequest = limiter.wrap(aiController.getAIResponse);

// POST-запрос для получения данных о здоровье http://localhost:5001/api/ai/health-data
router.post('/health-data', async (req, res) => {
  console.log('Запрос на /ai/health-data получен:', req.body);
  try {
    await getHealthDataRequest(req, res);
  } catch (error) {
    console.error('Ошибка при запросе данных о здоровье:', error.message);
    res.status(500).json({ message: 'Ошибка обработки запроса', error: error.message });
  }
});

// POST-запрос для отправки запроса в GPT http://localhost:5001/api/ai/chat
router.post('/chat', async (req, res) => {
  console.log('Запрос на /ai/chat получен:', req.body);
  try {
    await getAIResponseRequest(req, res);
  } catch (error) {
    console.error('Ошибка при запросе ответа от GPT:', error.message);
    res.status(500).json({ message: 'Ошибка обработки запроса', error: error.message });
  }
});

module.exports = router;