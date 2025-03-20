const { HealthRecord, Symptom, Medication } = require('../models/models');
const dotenv = require("dotenv");
const { Op } = require('sequelize');
const unirest = require('unirest');

dotenv.config();

const apiKey = process.env.GEN_API_KEY;

class aiController {
  static async getAIRecommendations(userId, startDate, endDate) {
    try {
      console.log(`Получаем записи для userId: ${userId} с ${startDate} по ${endDate}`);

      const healthRecords = await HealthRecord.findAll({
        where: {
          userId,
          recordDate: { [Op.between]: [startDate, endDate] },
        },
        include: [
          { model: Symptom, as: 'symptom', attributes: ['name'], required: false },
          { model: Medication, as: 'medication', attributes: ['name'], required: false },
        ],
      });

      if (healthRecords.length === 0) {
        console.error('Нет записей для этого пользователя за указанный период.');
        return "Нет данных о симптомах или медикаментах за указанный период.";
      }

      const symptomsCount = {};
      const medicationsCount = {};
      healthRecords.forEach(record => {
        if (record.symptom) symptomsCount[record.symptom.name] = (symptomsCount[record.symptom.name] || 0) + 1;
        if (record.medication) medicationsCount[record.medication.name] = (medicationsCount[record.medication.name] || 0) + 1;
      });

      const symptomsText = Object.entries(symptomsCount)
        .map(([name, count]) => `${name}: ${count} раз`)
        .join(", ") || "отсутствуют";
      const medicationsText = Object.entries(medicationsCount)
        .map(([name, count]) => `${name}: ${count} раз`)
        .join(", ") || "отсутствуют";

        const prompt = `Ты врач с высшей категорией. У пользователя за период наблюдения были зафиксированы следующие симптомы: ${symptomsText}.
        За тот же период он принимал следующие лекарства: ${medicationsText}. Проанализируй эти данные и дай развернутые рекомендации по лечению. Укажи:
        1. Объясни, что могут значить симптомы.
        2. Расскажи, как лекарства влияют на ситуацию.
        3. Рекомендации по дальнейшему лечению, включая возможные изменения в приеме лекарств или дополнительные препараты.
        4. Изменения в образе жизни для улучшения состояния.
        5. Когда стоит обратиться к врачу.
        Не ставь точный диагноз, а предоставь общие рекомендации на основе симптомов и медикаментов.`;    
        console.log("Промпт для отправки:", prompt);

      const response = await unirest('POST', 'https://api.gen-api.ru/api/v1/networks/gpt-4o-mini')
        .headers({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        })
        .send({
          "is_sync": true,
          "messages": [
            { "role": "user", "content": prompt }
          ]
        });

      // Логируем полный ответ от API
      console.log("Полный ответ API:", JSON.stringify(response.body, null, 2));

      if (response.error) {
        throw new Error(`Ошибка API: ${response.error.message}`);
      }

      // Проверяем структуру ответа и извлекаем результат
      const aiResponse = response.body.response?.[0]?.message?.content || "Ответ не получен";
            console.log("Ответ AI:", aiResponse);
      return aiResponse;
    } catch (error) {
      console.error("Ошибка:", error.message);
      throw error;
    }
  }
}

module.exports = aiController;