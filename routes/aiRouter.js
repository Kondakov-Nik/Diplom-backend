const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');  // Импортируем контроллер
const Bottleneck = require("bottleneck");

// Создаем лимитер, который ограничивает количество запросов
const limiter = new Bottleneck({
  minTime: 1000, // Задержка между запросами в 1 секунду
  maxConcurrent: 1, // Одновременные запросы, можно настроить
  strategy: Bottleneck.strategy.LEAK // Стратегия "поступления" запросов
});

// Оборачиваем запрос с лимитированием
const apiRequest = limiter.wrap(async (userId, startDate, endDate) => {
  return await aiController.getAIRecommendations(userId, startDate, endDate); // Передаем данные о пользователе и датах
});

// POST-запрос для получения рекомендаций по лечению
router.post('/recommendations', async (req, res) => {
  const { userId, startDate, endDate } = req.body; // Извлекаем данные из тела запроса

  // Проверка на наличие обязательных данных
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Missing required fields: userId, startDate, endDate' });
  }

  try {
    // Получаем рекомендации от AI с учетом лимитатора запросов
    const recommendations = await apiRequest(userId, startDate, endDate);
    return res.status(200).json({ recommendations }); // Отправляем рекомендации в ответ
  } catch (error) {
    console.error('Error during AI recommendation request:', error);
    return res.status(500).json({ message: 'Error processing the request.' }); // Отправляем ошибку при проблемах
  }
});

module.exports = router;
