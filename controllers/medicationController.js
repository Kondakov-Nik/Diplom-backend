const ApiError = require('../error/ApiError');
const { Medication } = require('../models/models');


class MedicationController {
  // Получить все лекарства
  async getAll(req, res, next) {
    try {
      let medications = await Medication.findAll();
      return res.json(medications);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Получить лекарство, добавленные пользователем по ID
  async getByUserId(req, res, next) {
    try {
      const { userId } = req.params;  // Извлекаем userId из параметров запроса
      let medication = await Medication.findAll({ where: { userId } });

      if (medication.length === 0) {
        return res.status(404).json({ message: 'No Medication found for this user' });
      }

      return res.json(medication);  // Возвращаем все симптомы, связанные с данным userId
    } catch (error) {
      next(ApiError.badRequest(error.message));  // Обработка ошибок
    }
  }

  // Получить все симптомы: шаблонные + пользовательские
  async getAllMedication(req, res, next) {
    try {
      const { userId } = req.params;  // Получаем userId из параметров запроса

      // Получаем шаблонные симптомы
      const templateMedication = await Medication.findAll({ where: { isCustom: false } });

      // Получаем пользовательские симптомы
      const userMedication = await Medication.findAll({ where: { userId, isCustom: true } });

      // Объединяем два списка: шаблонные симптомы + пользовательские
      const allMedication = [...templateMedication, ...userMedication];

      // Отправляем объединенный список симптомов
      return res.json(allMedication);
    } catch (error) {
      next(ApiError.badRequest(error.message)); // Обработка ошибки
    }
  }

  // Получить лекарство по id
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      let medication = await Medication.findOne({ where: { id } });

      if (!medication) {
        return res.status(404).json({ message: 'Medication not found' });
      }

      return res.json(medication);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Создать новое лекарство
  async create(req, res, next) {
    try {
      const { name, description, isCustom, userId } = req.body;
      let medication = await Medication.create({ name, description, isCustom, userId });

      return res.status(201).json(medication);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Обновить существующее лекарство
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, isCustom, userId } = req.body;

      let medication = await Medication.findOne({ where: { id } });

      if (!medication) {
        return res.status(404).json({ message: 'Medication not found' });
      }

      medication.name = name || medication.name;
      medication.description = description || medication.description;
      medication.isCustom = isCustom || medication.isCustom;
      medication.userId = userId || medication.userId;

      await medication.save();

      return res.json(medication);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Удалить лекарство
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      let medication = await Medication.findOne({ where: { id } });

      if (!medication) {
        return res.status(404).json({ message: 'Medication not found' });
      }

      await medication.destroy();
      return res.json({ message: 'Medication deleted successfully' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new MedicationController();
