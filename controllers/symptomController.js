const ApiError = require('../error/ApiError');
const { Symptom } = require('../models/models');

class SymptomController {
  // Получить все симптомы
  async getAll(req, res, next) {
    try {
      let symptoms = await Symptom.findAll();
      return res.json(symptoms);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Получить симптомы, добавленные пользователем по ID
  async getByUserId(req, res, next) {
    try {
      const { userId } = req.params;  // Извлекаем userId из параметров запроса
      let symptoms = await Symptom.findAll({ where: { userId } });

      if (symptoms.length === 0) {
        return res.status(404).json({ message: 'No symptoms found for this user' });
      }

      return res.json(symptoms);  // Возвращаем все симптомы, связанные с данным userId
    } catch (error) {
      next(ApiError.badRequest(error.message));  // Обработка ошибок
    }
  }

  // Получить все симптомы: шаблонные + пользовательские
  async getAllSymptoms(req, res, next) {
    try {
      const { userId } = req.params;  // Получаем userId из параметров запроса

      // Получаем шаблонные симптомы
      const templateSymptoms = await Symptom.findAll({ where: { isCustom: false } });

      // Получаем пользовательские симптомы
      const userSymptoms = await Symptom.findAll({ where: { userId, isCustom: true } });

      // Объединяем два списка: шаблонные симптомы + пользовательские
      const allSymptoms = [...templateSymptoms, ...userSymptoms];

      // Отправляем объединенный список симптомов
      return res.json(allSymptoms);
    } catch (error) {
      next(ApiError.badRequest(error.message)); // Обработка ошибки
    }
  }


  // Получить симптом по id
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      let symptom = await Symptom.findOne({ where: { id } });

      if (!symptom) {
        return res.status(404).json({ message: 'Symptom not found' });
      }

      return res.json(symptom);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Создать новый симптом
  async create(req, res, next) {
    try {
      const { name, description, isCustom, userId } = req.body;
      let symptom = await Symptom.create({ name, description, isCustom, userId });

      return res.status(201).json(symptom);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Обновить существующий симптом
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, isCustom, userId } = req.body;

      let symptom = await Symptom.findOne({ where: { id } });

      if (!symptom) {
        return res.status(404).json({ message: 'Symptom not found' });
      }

      symptom.name = name || symptom.name;
      symptom.description = description || symptom.description;
      symptom.isCustom = isCustom || symptom.isCustom;
      symptom.userId = userId || symptom.userId;

      await symptom.save();

      return res.json(symptom);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Удалить симптом
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      let symptom = await Symptom.findOne({ where: { id } });

      if (!symptom) {
        return res.status(404).json({ message: 'Symptom not found' });
      }

      await symptom.destroy();
      return res.json({ message: 'Symptom deleted successfully' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new SymptomController();
