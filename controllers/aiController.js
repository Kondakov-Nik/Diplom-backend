const { OpenAI } = require("openai");
const { HealthRecord, Symptom, Medication } = require('../models/models');
const dotenv = require("dotenv");
const { Op } = require('sequelize');

dotenv.config();  // Убедитесь, что переменные окружения загружены из .env

const apiKey = process.env.OPENAI_API_KEY;  // Используем API ключ OpenAI из переменных окружения
const api = new OpenAI({
  apiKey,
  baseURL: "https://api.aimlapi.com/v1",
});

class aiController {
  static async getAIRecommendations(userId, startDate, endDate) {
    try {
      console.log(`Получаем записи для userId: ${userId} с ${startDate} по ${endDate}`);

      // Получаем записи о здоровье пользователя из базы данных за указанный период
      const healthRecords = await HealthRecord.findAll({
        where: {
          userId,
          recordDate: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          { 
            model: Symptom, 
            as: 'symptom',
            attributes: ['name'],  // Оставляем только имя симптома
            required: false // Убираем required: true, чтобы даже без симптомов данные могли быть возвращены
          },
          { 
            model: Medication, 
            as: 'medication',
            attributes: ['name'],  // Оставляем только имя лекарства
            required: false // Убираем required: true, чтобы даже без медикаментов данные могли быть возвращены
          },
        ],
      });

      // Если записи не найдены, возвращаем ошибку
      if (healthRecords.length === 0) {
        console.error('Нет записей для этого пользователя за указанный период.');
        return;
      }

      // Собираем и подсчитываем количество симптомов и медикаментов
      const symptomsCount = {};
      const medicationsCount = {};

      healthRecords.forEach(record => {
        if (record.symptom) {
          const symptomName = record.symptom.name;
          symptomsCount[symptomName] = (symptomsCount[symptomName] || 0) + 1;
        }
        if (record.medication) {
          const medicationName = record.medication.name;
          medicationsCount[medicationName] = (medicationsCount[medicationName] || 0) + 1;
        }
      });

      // Формируем строки для симптомов и медикаментов
      const symptomsText = Object.entries(symptomsCount)
        .map(([name, count]) => `${name}: ${count} раз`)
        .join(", ");

      const medicationsText = Object.entries(medicationsCount)
        .map(([name, count]) => `${name}: ${count} раз`)
        .join(", ");

      // Формируем промт
      const prompt = `У пользователя следующие симптомы: ${symptomsText}. Он принимает следующие лекарства: ${medicationsText}. что это такое.`;

      // Логируем промт перед отправкой
      console.log("Промт перед отправкой в OpenAI:", prompt);

      // Отправляем запрос в OpenAI
      const completion = await api.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Вы врач с высшей категорией"  },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 190,
      });

      const response = completion.choices[0].message.content;
      console.log("Ответ AI:", response);

      // Возвращаем рекомендации от AI
      return response;
    } catch (error) {
      console.error("Ошибка:", error.message);
      throw error;  // Бросаем ошибку дальше для обработки на уровне роутера
    }
  }
}

module.exports = aiController;
